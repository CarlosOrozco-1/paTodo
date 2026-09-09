package com.paTodo.backend.job.controller;

import com.paTodo.backend.common.dto.PageResponse;
import com.paTodo.backend.job.dto.LocationCreateRequest;
import com.paTodo.backend.job.dto.LocationResponse;
import com.paTodo.backend.job.service.LocationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @GetMapping("/jobs/{id}/locations")
    public ResponseEntity<PageResponse<LocationResponse>> getHistory(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("timestamp").ascending());
        return ResponseEntity.ok(locationService.getHistory(id, pageable));
    }

    @PostMapping("/jobs/{id}/locations")
    public ResponseEntity<LocationResponse> record(@PathVariable String id,
                                                   Authentication authentication,
                                                   @Valid @RequestBody LocationCreateRequest request) {
        LocationResponse response = locationService.recordLocation(authentication.getName(), id, request);
        return ResponseEntity.status(201).body(response);
    }
}
