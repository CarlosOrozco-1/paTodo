package com.paTodo.backend.review.repository;

import com.paTodo.backend.review.model.Review;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends MongoRepository<Review, String> {
    Optional<Review> findByJobId(String jobId);
    List<Review> findByRevieweeIdOrderByCreatedAtDesc(String revieweeId);
    List<Review> findByReviewerId(String reviewerId);
}
