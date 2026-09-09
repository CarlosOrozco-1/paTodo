package com.paTodo.backend.job.controller;

import com.paTodo.backend.job.dto.LocationCreateRequest;
import com.paTodo.backend.job.dto.LocationInbound;
import com.paTodo.backend.job.service.LocationService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class LocationSocketController {

    private final LocationService locationService;

    public LocationSocketController(LocationService locationService) {
        this.locationService = locationService;
    }

    @MessageMapping("/location.update")
    public void updateLocation(@Valid LocationInbound inbound, Principal principal) {
        LocationCreateRequest request = new LocationCreateRequest();
        request.setCoordinates(inbound.getCoordinates());
        request.setAccuracy(inbound.getAccuracy());
        request.setSpeed(inbound.getSpeed());
        request.setHeading(inbound.getHeading());
        locationService.recordLocation(principal.getName(), inbound.getJobId(), request);
    }
}
