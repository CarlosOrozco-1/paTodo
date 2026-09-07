package com.paTodo.backend.repository;

import com.paTodo.backend.model.Offer;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface OfferRepository extends MongoRepository<Offer, String> {
    List<Offer> findByJobId(String jobId);
    List<Offer> findByWorkerId(String workerId);
    List<Offer> findByJobIdAndStatus(String jobId, String status);
    List<Offer> findByWorkerIdAndStatus(String workerId, String status);
}