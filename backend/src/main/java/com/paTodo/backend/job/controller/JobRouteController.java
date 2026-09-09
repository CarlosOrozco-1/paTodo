package com.paTodo.backend.job.controller;

import com.paTodo.backend.job.dto.JobRouteRequest;
import com.paTodo.backend.job.dto.JobRouteResponse;
import com.paTodo.backend.job.service.JobRouteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class JobRouteController {

    private final JobRouteService jobRouteService;

    public JobRouteController(JobRouteService jobRouteService) {
        this.jobRouteService = jobRouteService;
    }

    @GetMapping("/jobs/{id}/route")
    public ResponseEntity<JobRouteResponse> get(@PathVariable String id) {
        return ResponseEntity.ok(jobRouteService.getLatestRoute(id));
    }

    @PostMapping("/jobs/{id}/route")
    public ResponseEntity<JobRouteResponse> save(@PathVariable String id,
                                                 @Valid @RequestBody JobRouteRequest request) {
        JobRouteResponse route = jobRouteService.saveRoute(id, request);
        return ResponseEntity.status(201).body(route);
    }
}
