package com.paTodo.backend.job.controller;

import com.paTodo.backend.job.dto.JobCreateRequest;
import com.paTodo.backend.common.dto.PageResponse;
import com.paTodo.backend.job.model.Job;
import com.paTodo.backend.job.repository.JobRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/jobs")
public class JobController {

    private final JobRepository jobRepository;

    public JobController(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    @PostMapping
    public ResponseEntity<Job> create(Authentication authentication,
                                       @RequestBody JobCreateRequest request) {
        String userId = authentication.getName();

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
        job.setClientId(userId);
        job.setDetails(details);
        job.setLocation(location);
        job.setPricing(pricing);
        job.setStatus("pending");
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());

        return ResponseEntity.ok(jobRepository.save(job));
    }

    @GetMapping
    public ResponseEntity<PageResponse<Job>> getAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
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

        PageResponse<Job> response = new PageResponse<>();
        response.setContent(jobPage.getContent());
        response.setPage(jobPage.getNumber());
        response.setSize(jobPage.getSize());
        response.setTotalElements(jobPage.getTotalElements());
        response.setTotalPages(jobPage.getTotalPages());
        response.setFirst(jobPage.isFirst());
        response.setLast(jobPage.isLast());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Job> getById(@PathVariable String id) {
        return jobRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/my-jobs")
    public ResponseEntity<List<Job>> getMyJobs(Authentication authentication) {
        return ResponseEntity.ok(jobRepository.findByClientId(authentication.getName()));
    }

    @GetMapping("/assigned")
    public ResponseEntity<List<Job>> getAssignedJobs(Authentication authentication) {
        return ResponseEntity.ok(jobRepository.findByWorkerId(authentication.getName()));
    }
}
