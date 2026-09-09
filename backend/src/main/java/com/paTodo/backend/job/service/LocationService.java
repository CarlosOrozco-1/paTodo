package com.paTodo.backend.job.service;

import com.paTodo.backend.common.dto.PageResponse;
import com.paTodo.backend.job.dto.LocationCreateRequest;
import com.paTodo.backend.job.dto.LocationResponse;
import com.paTodo.backend.job.model.LocationHistory;
import com.paTodo.backend.job.repository.LocationHistoryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.stream.Collectors;

@Service
public class LocationService {

    private final LocationHistoryRepository locationHistoryRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public LocationService(LocationHistoryRepository locationHistoryRepository,
                           SimpMessagingTemplate messagingTemplate) {
        this.locationHistoryRepository = locationHistoryRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public LocationResponse recordLocation(String userId, String jobId, LocationCreateRequest request) {
        LocationHistory history = new LocationHistory();
        history.setJobId(jobId);
        history.setUserId(userId);

        LocationHistory.Location location = new LocationHistory.Location();
        location.setType("Point");
        location.setCoordinates(request.getCoordinates());
        history.setLocation(location);

        history.setAccuracy(request.getAccuracy());
        history.setAltitude(request.getAltitude());
        history.setSpeed(request.getSpeed());
        history.setHeading(request.getHeading());
        history.setSource(request.getSource() != null ? request.getSource() : "gps");
        history.setTimestamp(Instant.now());
        history.setReceivedAt(Instant.now());

        LocationHistory saved = locationHistoryRepository.save(history);
        LocationResponse response = mapToResponse(saved);
        messagingTemplate.convertAndSend("/topic/location." + jobId, response);
        return response;
    }

    public PageResponse<LocationResponse> getHistory(String jobId, Pageable pageable) {
        Page<LocationHistory> page = locationHistoryRepository.findByJobIdOrderByTimestampAsc(jobId, pageable);

        PageResponse<LocationResponse> response = new PageResponse<>();
        response.setContent(page.getContent().stream().map(this::mapToResponse).collect(Collectors.toList()));
        response.setPage(page.getNumber());
        response.setSize(page.getSize());
        response.setTotalElements(page.getTotalElements());
        response.setTotalPages(page.getTotalPages());
        response.setFirst(page.isFirst());
        response.setLast(page.isLast());
        return response;
    }

    private LocationResponse mapToResponse(LocationHistory history) {
        LocationResponse response = new LocationResponse();
        response.setId(history.getId());
        response.setJobId(history.getJobId());
        response.setUserId(history.getUserId());
        if (history.getLocation() != null) {
            response.setType(history.getLocation().getType());
            response.setCoordinates(history.getLocation().getCoordinates());
        }
        response.setAccuracy(history.getAccuracy());
        response.setAltitude(history.getAltitude());
        response.setSpeed(history.getSpeed());
        response.setHeading(history.getHeading());
        response.setSource(history.getSource());
        response.setTimestamp(history.getTimestamp());
        return response;
    }
}
