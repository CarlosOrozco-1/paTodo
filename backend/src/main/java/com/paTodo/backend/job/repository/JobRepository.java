package com.paTodo.backend.job.repository;

import com.paTodo.backend.job.model.Job;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface JobRepository extends MongoRepository<Job, String> {
    List<Job> findByClientId(String clientId);
    List<Job> findByWorkerId(String workerId);
    List<Job> findByStatus(String status);
    List<Job> findByDetailsCategoryId(String categoryId);
    Page<Job> findByStatus(String status, Pageable pageable);
    Page<Job> findByDetailsCategoryId(String categoryId, Pageable pageable);
    Page<Job> findByStatusAndDetailsCategoryId(String status, String categoryId, Pageable pageable);
    List<Job> findByStatusInAndDetailsCategoryIdIn(List<String> statuses, List<String> categoryIds);
    List<Job> findByLocationCoordinatesNearAndStatus(org.springframework.data.geo.Point location, org.springframework.data.geo.Distance distance, String status);
    List<Job> findByLocationCoordinatesNearAndStatusAndDetailsCategoryId(org.springframework.data.geo.Point location, org.springframework.data.geo.Distance distance, String status, String categoryId);
}
