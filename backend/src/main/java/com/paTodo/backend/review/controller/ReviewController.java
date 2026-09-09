package com.paTodo.backend.review.controller;

import com.paTodo.backend.review.dto.ReviewCreateRequest;
import com.paTodo.backend.review.dto.ReviewResponse;
import com.paTodo.backend.review.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/jobs/{id}/review")
    public ResponseEntity<ReviewResponse> create(@PathVariable String id,
                                                 Authentication authentication,
                                                 @Valid @RequestBody ReviewCreateRequest request) {
        request.setJobId(id);
        ReviewResponse review = reviewService.createReview(authentication.getName(), id, request);
        return ResponseEntity.status(201).body(review);
    }

    @GetMapping("/jobs/{id}/review")
    public ResponseEntity<ReviewResponse> getByJob(@PathVariable String id) {
        return ResponseEntity.ok(reviewService.getByJob(id));
    }

    @GetMapping("/users/{id}/reviews")
    public ResponseEntity<List<ReviewResponse>> getByUser(@PathVariable String id) {
        return ResponseEntity.ok(reviewService.getByUser(id));
    }
}
