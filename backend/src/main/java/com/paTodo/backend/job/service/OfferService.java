package com.paTodo.backend.job.service;

import com.paTodo.backend.common.exception.BadRequestException;
import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.job.dto.OfferCreateRequest;
import com.paTodo.backend.job.dto.OfferResponse;
import com.paTodo.backend.job.model.Job;
import com.paTodo.backend.job.model.Offer;
import com.paTodo.backend.job.repository.JobRepository;
import com.paTodo.backend.job.repository.OfferRepository;
import com.paTodo.backend.notification.service.NotificationService;
import com.paTodo.backend.user.dto.PublicUserDto;
import com.paTodo.backend.user.service.UserService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class OfferService {

    private final OfferRepository offerRepository;
    private final JobRepository jobRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    public OfferService(OfferRepository offerRepository,
                        JobRepository jobRepository,
                        UserService userService,
                        NotificationService notificationService,
                        SimpMessagingTemplate messagingTemplate) {
        this.offerRepository = offerRepository;
        this.jobRepository = jobRepository;
        this.userService = userService;
        this.notificationService = notificationService;
        this.messagingTemplate = messagingTemplate;
    }

    public OfferResponse createOffer(String workerId, String jobId, OfferCreateRequest request) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado con id: " + jobId));

        if (!"pending".equals(job.getStatus())) {
            throw new BadRequestException("Solo se puede ofertar en trabajos pendientes");
        }
        if (workerId.equals(job.getClientId())) {
            throw new BadRequestException("No puedes ofertar en tu propio trabajo");
        }

        Offer offer = new Offer();
        offer.setJobId(jobId);
        offer.setWorkerId(workerId);
        offer.setPrice(request.getPrice());
        offer.setCurrency(request.getCurrency());
        offer.setEstimatedTime(request.getEstimatedTime());
        offer.setMessage(request.getMessage());
        offer.setStatus("pending");
        offer.setCreatedAt(Instant.now());
        offer.setUpdatedAt(Instant.now());
        offer.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS)); // Expira en 24h por defecto

        PublicUserDto worker = userService.getPublicProfile(workerId);
        Offer.WorkerSnapshot snapshot = new Offer.WorkerSnapshot();
        snapshot.setName(worker.getName());
        snapshot.setRating(worker.getRating());
        snapshot.setCompletedJobs(worker.getCompletedJobs());
        snapshot.setAvatarUrl(worker.getAvatarUrl());
        offer.setWorkerSnapshot(snapshot);

        Offer savedOffer = offerRepository.save(offer);
        OfferResponse response = mapToResponse(savedOffer);
        messagingTemplate.convertAndSend("/topic/offers." + jobId, response);
        notificationService.notify(job.getClientId(), "new_offer",
                "Nueva oferta recibida",
                worker.getName() + " ofertó " + request.getPrice() + " " + request.getCurrency(),
                Map.of("jobId", jobId, "offerId", savedOffer.getId()));
        return response;
    }

    public List<OfferResponse> getOffersForJob(String jobId, String clientId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado con id: " + jobId));
        if (!clientId.equals(job.getClientId())) {
            throw new AccessDeniedException("Solo el cliente dueño puede ver las ofertas");
        }
        return offerRepository.findByJobId(jobId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public OfferResponse acceptOffer(String offerId, String clientId) {
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Oferta no encontrada con id: " + offerId));

        Job job = jobRepository.findById(offer.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado"));

        if (!clientId.equals(job.getClientId())) {
            throw new AccessDeniedException("Solo el cliente dueño puede aceptar ofertas");
        }

        // Actualizar estado de la oferta
        offer.setStatus("accepted");
        offer.setUpdatedAt(Instant.now());
        offerRepository.save(offer);

        // Rechazar las demás ofertas
        List<Offer> otherOffers = offerRepository.findByJobId(job.getId()).stream()
                .filter(o -> !o.getId().equals(offerId) && "pending".equals(o.getStatus()))
                .collect(Collectors.toList());
        otherOffers.forEach(o -> {
            o.setStatus("rejected");
            o.setUpdatedAt(Instant.now());
        });
        offerRepository.saveAll(otherOffers);

        // Actualizar el trabajo
        job.setStatus("accepted");
        job.setAcceptedOfferId(offer.getId());
        job.setWorkerId(offer.getWorkerId());
        job.setUpdatedAt(Instant.now());
        jobRepository.save(job);

        OfferResponse response = mapToResponse(offer);
        messagingTemplate.convertAndSend("/topic/offers." + job.getId(), response);
        notificationService.notify(offer.getWorkerId(), "offer_accepted",
                "¡Oferta aceptada!",
                "Tu oferta para el trabajo fue aceptada",
                Map.of("jobId", job.getId(), "offerId", offer.getId()));
        return response;
    }

    public OfferResponse rejectOffer(String offerId, String clientId) {
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Oferta no encontrada con id: " + offerId));

        Job job = jobRepository.findById(offer.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado"));
        if (!clientId.equals(job.getClientId())) {
            throw new AccessDeniedException("Solo el cliente dueño puede rechazar ofertas");
        }

        offer.setStatus("rejected");
        offer.setUpdatedAt(Instant.now());
        OfferResponse response = mapToResponse(offerRepository.save(offer));
        messagingTemplate.convertAndSend("/topic/offers." + job.getId(), response);
        return response;
    }

    private OfferResponse mapToResponse(Offer offer) {
        OfferResponse response = new OfferResponse();
        response.setId(offer.getId());
        response.setJobId(offer.getJobId());
        response.setWorkerId(offer.getWorkerId());
        response.setPrice(offer.getPrice());
        response.setCurrency(offer.getCurrency());
        response.setEstimatedTime(offer.getEstimatedTime());
        response.setMessage(offer.getMessage());
        response.setStatus(offer.getStatus());
        response.setExpiresAt(offer.getExpiresAt());
        response.setCreatedAt(offer.getCreatedAt());
        response.setUpdatedAt(offer.getUpdatedAt());

        if (offer.getWorkerSnapshot() != null) {
            OfferResponse.WorkerSnapshot snapshot = new OfferResponse.WorkerSnapshot();
            snapshot.setName(offer.getWorkerSnapshot().getName());
            snapshot.setRating(offer.getWorkerSnapshot().getRating());
            snapshot.setCompletedJobs(offer.getWorkerSnapshot().getCompletedJobs());
            snapshot.setAvatarUrl(offer.getWorkerSnapshot().getAvatarUrl());
            response.setWorkerSnapshot(snapshot);
        }

        return response;
    }
}
