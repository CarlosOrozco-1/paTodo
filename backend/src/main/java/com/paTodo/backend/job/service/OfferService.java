package com.paTodo.backend.job.service;

import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.job.dto.OfferCreateRequest;
import com.paTodo.backend.job.dto.OfferResponse;
import com.paTodo.backend.job.model.Job;
import com.paTodo.backend.job.model.Offer;
import com.paTodo.backend.job.repository.JobRepository;
import com.paTodo.backend.job.repository.OfferRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OfferService {

    private final OfferRepository offerRepository;
    private final JobRepository jobRepository;

    public OfferService(OfferRepository offerRepository, JobRepository jobRepository) {
        this.offerRepository = offerRepository;
        this.jobRepository = jobRepository;
    }

    public OfferResponse createOffer(String workerId, String jobId, OfferCreateRequest request) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado con id: " + jobId));

        // TODO: Validar que el job esté en estado 'pending'
        
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

        // Snapshot del trabajador (Datos simulados hasta integrar con UserService)
        Offer.WorkerSnapshot snapshot = new Offer.WorkerSnapshot();
        snapshot.setName("Trabajador " + workerId.substring(0, 4));
        snapshot.setRating(5.0);
        snapshot.setCompletedJobs(10);
        snapshot.setAvatarUrl("https://ui-avatars.com/api/?name=Worker");
        offer.setWorkerSnapshot(snapshot);

        Offer savedOffer = offerRepository.save(offer);
        return mapToResponse(savedOffer);
    }

    public List<OfferResponse> getOffersForJob(String jobId) {
        return offerRepository.findByJobId(jobId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public OfferResponse acceptOffer(String offerId, String clientId) {
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Oferta no encontrada con id: " + offerId));

        Job job = jobRepository.findById(offer.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado"));

        // TODO: Validar que el clientId coincide con el del job

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

        return mapToResponse(offer);
    }

    public OfferResponse rejectOffer(String offerId, String clientId) {
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Oferta no encontrada con id: " + offerId));

        offer.setStatus("rejected");
        offer.setUpdatedAt(Instant.now());
        return mapToResponse(offerRepository.save(offer));
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
