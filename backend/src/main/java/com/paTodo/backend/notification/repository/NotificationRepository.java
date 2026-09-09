package com.paTodo.backend.notification.repository;

import com.paTodo.backend.notification.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    Page<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
    List<Notification> findByUserIdAndReadAtIsNull(String userId);
    List<Notification> findByUserIdAndType(String userId, String type);
}
