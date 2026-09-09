package com.paTodo.backend.user.controller;

import com.paTodo.backend.user.dto.VehicleCreateRequest;
import com.paTodo.backend.user.dto.VehicleResponse;
import com.paTodo.backend.user.service.VehicleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users/me/vehicles")
public class VehicleController {

    private final VehicleService vehicleService;

    public VehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('WORKER', 'BOTH')")
    public ResponseEntity<VehicleResponse> create(Authentication authentication,
                                                  @Valid @RequestBody VehicleCreateRequest request) {
        VehicleResponse vehicle = vehicleService.createVehicle(authentication.getName(), request);
        return ResponseEntity.status(201).body(vehicle);
    }

    @GetMapping
    public ResponseEntity<List<VehicleResponse>> getMine(Authentication authentication) {
        return ResponseEntity.ok(vehicleService.getMyVehicles(authentication.getName()));
    }
}
