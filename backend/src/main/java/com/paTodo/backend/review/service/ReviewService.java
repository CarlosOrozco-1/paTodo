package com.paTodo.backend.review.service;

import com.paTodo.backend.common.exception.BadRequestException;
import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.review.dto.ReviewCreateRequest;
import com.paTodo.backend.review.dto.ReviewResponse;
import com.paTodo.backend.review.model.Review;
import com.paTodo.backend.review.repository.ReviewRepository;
import com.paTodo.backend.user.service.UserService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserService userService;

    public ReviewService(ReviewRepository reviewRepository, UserService userService) {
        this.reviewRepository = reviewRepository;
        this.userService = userService;
    }

    public ReviewResponse createReview(String reviewerId, String jobId, ReviewCreateRequest request) {
        if (revieweeEqualsReviewer(reviewerId, request.getRevieweeId())) {
            throw new BadRequestException("No puedes calificarte a ti mismo");
        }
        if (reviewRepository.findByJobId(jobId).isPresent()) {
            throw new BadRequestException("Este trabajo ya tiene una reseña");
        }

        Review review = new Review();
        review.setJobId(jobId);
        review.setReviewerId(reviewerId);
        review.setRevieweeId(request.getRevieweeId());
        review.setRating(request.getRating());
        review.setComment(request.getComment());
        review.setPublic(true);
        review.setCreatedAt(Instant.now());
        review.setUpdatedAt(Instant.now());

        if (request.getAspects() != null) {
            Review.Aspects aspects = new Review.Aspects();
            aspects.setQuality(request.getAspects().getQuality());
            aspects.setPunctuality(request.getAspects().getPunctuality());
            aspects.setCommunication(request.getAspects().getCommunication());
            aspects.setValue(request.getAspects().getValue());
            review.setAspects(aspects);
        }

        Review saved = reviewRepository.save(review);
        userService.updateStatsAfterReview(request.getRevieweeId(), request.getRating());
        return mapToResponse(saved);
    }

    public ReviewResponse getByJob(String jobId) {
        Review review = reviewRepository.findByJobId(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Reseña no encontrada para el trabajo: " + jobId));
        return mapToResponse(review);
    }

    public List<ReviewResponse> getByUser(String userId) {
        return reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private boolean revieweeEqualsReviewer(String reviewerId, String revieweeId) {
        return reviewerId != null && reviewerId.equals(revieweeId);
    }

    private ReviewResponse mapToResponse(Review review) {
        ReviewResponse response = new ReviewResponse();
        response.setId(review.getId());
        response.setJobId(review.getJobId());
        response.setReviewerId(review.getReviewerId());
        response.setRevieweeId(review.getRevieweeId());
        response.setRating(review.getRating());
        response.setComment(review.getComment());
        response.setPublic(review.isPublic());
        response.setCreatedAt(review.getCreatedAt());
        response.setUpdatedAt(review.getUpdatedAt());

        if (review.getAspects() != null) {
            ReviewResponse.Aspects aspects = new ReviewResponse.Aspects();
            aspects.setQuality(review.getAspects().getQuality());
            aspects.setPunctuality(review.getAspects().getPunctuality());
            aspects.setCommunication(review.getAspects().getCommunication());
            aspects.setValue(review.getAspects().getValue());
            response.setAspects(aspects);
        }
        return response;
    }
}
