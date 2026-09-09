package com.paTodo.backend.job.repository;

import com.paTodo.backend.job.model.LocationHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface LocationHistoryRepository extends MongoRepository<LocationHistory, String> {
    Page<LocationHistory> findByUserIdOrderByTimestampDesc(String userId, Pageable pageable);
    Page<LocationHistory> findByJobIdOrderByTimestampAsc(String jobId, Pageable pageable);
    List<LocationHistory> findByTimestampBefore(Instant timestamp);
}
