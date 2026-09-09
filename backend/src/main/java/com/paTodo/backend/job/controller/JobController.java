package com.paTodo.backend.job.controller;

import com.paTodo.backend.job.dto.JobCreateRequest;
import com.paTodo.backend.job.dto.JobResponse;
import com.paTodo.backend.common.dto.PageResponse;
import com.paTodo.backend.job.service.JobService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/jobs")
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping
    public ResponseEntity<JobResponse> create(Authentication authentication,
                                              @Valid @RequestBody JobCreateRequest request) {
        String userId = authentication.getName();
        JobResponse job = jobService.createJob(userId, request);
        return ResponseEntity.status(201).body(job);
    }

    @GetMapping
    public ResponseEntity<PageResponse<JobResponse>> getAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        PageResponse<JobResponse> response = jobService.getJobs(status, categoryId, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<JobResponse>> getNearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "10000") double radius,
            @RequestParam(required = false) String category) {
        
        List<JobResponse> jobs = jobService.getNearbyJobs(lat, lng, radius, category);
        return ResponseEntity.ok(jobs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(jobService.getJobById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<JobResponse> cancelJob(@PathVariable String id, Authentication authentication) {
        String userId = authentication.getName();
        JobResponse job = jobService.deleteJob(id, userId);
        return ResponseEntity.ok(job);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<JobResponse> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        JobResponse job = jobService.updateJobStatus(id, status);
        return ResponseEntity.ok(job);
    }

    @GetMapping("/my-jobs")
    public ResponseEntity<List<JobResponse>> getMyJobs(Authentication authentication) {
        return ResponseEntity.ok(jobService.getMyJobs(authentication.getName()));
    }

    @GetMapping("/assigned")
    public ResponseEntity<List<JobResponse>> getAssignedJobs(Authentication authentication) {
        return ResponseEntity.ok(jobService.getAssignedJobs(authentication.getName()));
    }
}
