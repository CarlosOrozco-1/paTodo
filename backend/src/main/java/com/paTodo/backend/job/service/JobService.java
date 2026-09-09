package com.paTodo.backend.job.service;

import com.paTodo.backend.common.dto.PageResponse;
import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.job.dto.JobCreateRequest;
import com.paTodo.backend.job.dto.JobResponse;
import com.paTodo.backend.job.model.Job;
import com.paTodo.backend.job.repository.JobRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class JobService {

    private final JobRepository jobRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public JobService(JobRepository jobRepository, SimpMessagingTemplate messagingTemplate) {
        this.jobRepository = jobRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public JobResponse createJob(String clientId, JobCreateRequest request) {
        Job.Details details = new Job.Details();
        details.setTitle(request.getDetails().getTitle());
        details.setDescription(request.getDetails().getDescription());
        details.setCategoryId(request.getDetails().getCategoryId());
        details.setSkillIds(request.getDetails().getSkillIds());

        Job.Location location = new Job.Location();
        location.setType("Point");
        location.setCoordinates(request.getLocation().getCoordinates());
        location.setAddress(request.getLocation().getAddress());
        location.setPlaceId(request.getLocation().getPlaceId());

        Job.Pricing pricing = new Job.Pricing();
        pricing.setProposedPrice(request.getPricing().getProposedPrice());
        pricing.setCurrency(request.getPricing().getCurrency());
        pricing.setPriceType(request.getPricing().getPriceType());

        Job job = new Job();
        job.setClientId(clientId);
        job.setDetails(details);
        job.setLocation(location);
        job.setPricing(pricing);
        job.setStatus("pending");
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());

        Job savedJob = jobRepository.save(job);
        JobResponse response = mapToResponse(savedJob);
        messagingTemplate.convertAndSend("/topic/jobs", response);
        return response;
    }

    public PageResponse<JobResponse> getJobs(String status, String categoryId, Pageable pageable) {
        Page<Job> jobPage;

        if (status != null && categoryId != null) {
            jobPage = jobRepository.findByStatusAndDetailsCategoryId(status, categoryId, pageable);
        } else if (status != null) {
            jobPage = jobRepository.findByStatus(status, pageable);
        } else if (categoryId != null) {
            jobPage = jobRepository.findByDetailsCategoryId(categoryId, pageable);
        } else {
            jobPage = jobRepository.findAll(pageable);
        }

        PageResponse<JobResponse> response = new PageResponse<>();
        response.setContent(jobPage.getContent().stream().map(this::mapToResponse).collect(Collectors.toList()));
        response.setPage(jobPage.getNumber());
        response.setSize(jobPage.getSize());
        response.setTotalElements(jobPage.getTotalElements());
        response.setTotalPages(jobPage.getTotalPages());
        response.setFirst(jobPage.isFirst());
        response.setLast(jobPage.isLast());

        return response;
    }

    public List<JobResponse> getNearbyJobs(double lat, double lng, double radiusInMeters, String categoryId) {
        Point point = new Point(lng, lat);
        Distance distance = new Distance(radiusInMeters / 1000.0, Metrics.KILOMETERS);

        List<Job> jobs;
        if (categoryId != null && !categoryId.isEmpty()) {
            jobs = jobRepository.findByLocationCoordinatesNearAndStatusAndDetailsCategoryId(point, distance, "pending",
                    categoryId);
        } else {
            jobs = jobRepository.findByLocationCoordinatesNearAndStatus(point, distance, "pending");
        }

        return jobs.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public JobResponse getJobById(String id) {
        Job job = jobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado con id: " + id));
        return mapToResponse(job);
    }

    public List<JobResponse> getMyJobs(String clientId) {
        return jobRepository.findByClientId(clientId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<JobResponse> getAssignedJobs(String workerId) {
        return jobRepository.findByWorkerId(workerId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public JobResponse deleteJob(String id, String userId) {
        Job job = jobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado"));

        if (!userId.equals(job.getClientId())) {
            throw new AccessDeniedException("Solo el cliente dueño puede cancelar este trabajo");
        }

        job.setStatus("cancelled");
        job.setCancelledAt(Instant.now());
        job.setCancellationReason("Cancelado por el usuario");
        job.setUpdatedAt(Instant.now());

        JobResponse response = mapToResponse(jobRepository.save(job));
        messagingTemplate.convertAndSend("/topic/jobs." + id, response);
        return response;
    }

    public JobResponse updateJobStatus(String id, String status) {
        Job job = jobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trabajo no encontrado"));

        job.setStatus(status);
        job.setUpdatedAt(Instant.now());
        if ("completed".equals(status)) {
            job.setCompletedAt(Instant.now());
        }

        JobResponse response = mapToResponse(jobRepository.save(job));
        messagingTemplate.convertAndSend("/topic/jobs." + id, response);
        return response;
    }

    // Método utilitario para convertir la Entidad (Job) al DTO (JobResponse)
    private JobResponse mapToResponse(Job job) {
        JobResponse response = new JobResponse();
        response.setId(job.getId());
        response.setClientId(job.getClientId());
        response.setWorkerId(job.getWorkerId());
        response.setStatus(job.getStatus());
        response.setAcceptedOfferId(job.getAcceptedOfferId());
        response.setScheduledFor(job.getScheduledFor());
        response.setStartedAt(job.getStartedAt());
        response.setCompletedAt(job.getCompletedAt());
        response.setCancelledAt(job.getCancelledAt());
        response.setCancellationReason(job.getCancellationReason());
        response.setCreatedAt(job.getCreatedAt());
        response.setUpdatedAt(job.getUpdatedAt());

        if (job.getDetails() != null) {
            JobResponse.Details details = new JobResponse.Details();
            details.setTitle(job.getDetails().getTitle());
            details.setDescription(job.getDetails().getDescription());
            details.setCategoryId(job.getDetails().getCategoryId());
            details.setSkillIds(job.getDetails().getSkillIds());
            response.setDetails(details);
        }

        if (job.getLocation() != null) {
            JobResponse.Location location = new JobResponse.Location();
            location.setType(job.getLocation().getType());
            location.setCoordinates(job.getLocation().getCoordinates());
            location.setAddress(job.getLocation().getAddress());
            location.setPlaceId(job.getLocation().getPlaceId());
            response.setLocation(location);
        }

        if (job.getPricing() != null) {
            JobResponse.Pricing pricing = new JobResponse.Pricing();
            pricing.setProposedPrice(job.getPricing().getProposedPrice());
            pricing.setCurrency(job.getPricing().getCurrency());
            pricing.setPriceType(job.getPricing().getPriceType());
            response.setPricing(pricing);
        }

        return response;
    }
}
