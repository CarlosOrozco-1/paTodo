package com.paTodo.backend.notification.service;

import com.paTodo.backend.common.dto.PageResponse;
import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.notification.dto.NotificationResponse;
import com.paTodo.backend.notification.model.Notification;
import com.paTodo.backend.notification.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(NotificationRepository notificationRepository,
                               SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public NotificationResponse notify(String userId, String type, String title, String body,
                                       Map<String, Object> data) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setData(data);
        notification.setChannels(List.of("inapp"));
        notification.setSentAt(Instant.now());
        notification.setCreatedAt(Instant.now());

        Notification saved = notificationRepository.save(notification);
        NotificationResponse response = mapToResponse(saved);
        messagingTemplate.convertAndSendToUser(userId, "/notifications", response);
        return response;
    }

    public PageResponse<NotificationResponse> getMine(String userId, Pageable pageable) {
        Page<Notification> page = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);

        PageResponse<NotificationResponse> response = new PageResponse<>();
        response.setContent(page.getContent().stream().map(this::mapToResponse).collect(Collectors.toList()));
        response.setPage(page.getNumber());
        response.setSize(page.getSize());
        response.setTotalElements(page.getTotalElements());
        response.setTotalPages(page.getTotalPages());
        response.setFirst(page.isFirst());
        response.setLast(page.isLast());
        return response;
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.findByUserIdAndReadAtIsNull(userId).size();
    }

    public NotificationResponse markAsRead(String id, String userId) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notificación no encontrada con id: " + id));
        if (!notification.getUserId().equals(userId)) {
            throw new AccessDeniedException("No tienes permiso para esta notificación");
        }
        notification.setReadAt(Instant.now());
        return mapToResponse(notificationRepository.save(notification));
    }

    private NotificationResponse mapToResponse(Notification notification) {
        NotificationResponse response = new NotificationResponse();
        response.setId(notification.getId());
        response.setUserId(notification.getUserId());
        response.setType(notification.getType());
        response.setTitle(notification.getTitle());
        response.setBody(notification.getBody());
        response.setData(notification.getData());
        response.setChannels(notification.getChannels());
        response.setReadAt(notification.getReadAt());
        response.setCreatedAt(notification.getCreatedAt());
        return response;
    }
}
