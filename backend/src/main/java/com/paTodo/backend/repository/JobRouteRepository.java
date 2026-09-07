package com.paTodo.backend.repository;

import com.paTodo.backend.model.JobRoute;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface JobRouteRepository extends MongoRepository<JobRoute, String> {
    List<JobRoute> findByJobId(String jobId);
    Optional<JobRoute> findByJobIdAndType(String jobId, String type);
}