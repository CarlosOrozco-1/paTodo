package com.paTodo.backend.job.controller;

import com.paTodo.backend.job.dto.OfferCreateRequest;
import com.paTodo.backend.job.dto.OfferResponse;
import com.paTodo.backend.job.service.OfferService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class OfferController {

    private final OfferService offerService;

    public OfferController(OfferService offerService) {
        this.offerService = offerService;
    }

    // Endpoints relacionados al trabajo (Jobs) pero enfocados en ofertas
    @PostMapping("/jobs/{jobId}/offers")
    public ResponseEntity<OfferResponse> createOffer(
            @PathVariable String jobId,
            Authentication authentication,
            @Valid @RequestBody OfferCreateRequest request) {
        
        String workerId = authentication.getName();
        OfferResponse response = offerService.createOffer(workerId, jobId, request);
        return ResponseEntity.status(201).body(response);
    }

    @GetMapping("/jobs/{jobId}/offers")
    public ResponseEntity<List<OfferResponse>> getJobOffers(
            @PathVariable String jobId,
            Authentication authentication) {

        String clientId = authentication.getName();
        List<OfferResponse> offers = offerService.getOffersForJob(jobId, clientId);
        return ResponseEntity.ok(offers);
    }

    // Endpoints directos de ofertas
    @PutMapping("/offers/{id}/accept")
    public ResponseEntity<OfferResponse> acceptOffer(
            @PathVariable String id,
            Authentication authentication) {
        
        String clientId = authentication.getName();
        OfferResponse response = offerService.acceptOffer(id, clientId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/offers/{id}/reject")
    public ResponseEntity<OfferResponse> rejectOffer(
            @PathVariable String id,
            Authentication authentication) {
        
        String clientId = authentication.getName();
        OfferResponse response = offerService.rejectOffer(id, clientId);
        return ResponseEntity.ok(response);
    }
}
