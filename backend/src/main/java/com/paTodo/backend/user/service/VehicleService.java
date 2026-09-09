package com.paTodo.backend.user.service;

import com.paTodo.backend.common.exception.BadRequestException;
import com.paTodo.backend.user.dto.VehicleCreateRequest;
import com.paTodo.backend.user.dto.VehicleResponse;
import com.paTodo.backend.user.model.Vehicle;
import com.paTodo.backend.user.repository.UserRepository;
import com.paTodo.backend.user.repository.VehicleRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;

    public VehicleService(VehicleRepository vehicleRepository, UserRepository userRepository) {
        this.vehicleRepository = vehicleRepository;
        this.userRepository = userRepository;
    }

    public VehicleResponse createVehicle(String ownerId, VehicleCreateRequest request) {
        if (vehicleRepository.findByPlate(request.getPlate()) != null) {
            throw new BadRequestException("Ya existe un vehículo con esa placa");
        }

        Vehicle vehicle = new Vehicle();
        vehicle.setOwnerId(ownerId);
        vehicle.setType(request.getType());
        vehicle.setBrand(request.getBrand());
        vehicle.setModel(request.getModel());
        vehicle.setYear(request.getYear());
        vehicle.setColor(request.getColor());
        vehicle.setPlate(request.getPlate());
        vehicle.setVin(request.getVin());
        vehicle.setStatus(request.getStatus() != null ? request.getStatus() : "active");
        vehicle.setFeatures(request.getFeatures());
        vehicle.setCreatedAt(Instant.now());
        vehicle.setUpdatedAt(Instant.now());

        if (request.getCapacity() != null) {
            Vehicle.Capacity capacity = new Vehicle.Capacity();
            capacity.setPassengers(request.getCapacity().getPassengers());
            capacity.setCargoKg(request.getCapacity().getCargoKg());
            capacity.setCargoVolume(request.getCapacity().getCargoVolume());
            vehicle.setCapacity(capacity);
        }

        if (request.getDocuments() != null) {
            Vehicle.Documents documents = new Vehicle.Documents();
            documents.setRegistration(request.getDocuments().getRegistration());
            documents.setInsurance(request.getDocuments().getInsurance());
            documents.setInsuranceExpiry(request.getDocuments().getInsuranceExpiry());
            documents.setTechnicalInspection(request.getDocuments().getTechnicalInspection());
            documents.setTechnicalInspectionExpiry(request.getDocuments().getTechnicalInspectionExpiry());
            vehicle.setDocuments(documents);
        }

        Vehicle saved = vehicleRepository.save(vehicle);
        linkVehicleToOwner(saved);
        return mapToResponse(saved);
    }

    public List<VehicleResponse> getMyVehicles(String ownerId) {
        return vehicleRepository.findByOwnerId(ownerId).stream()
                .map(this::mapToResponse)
                .collect(java.util.stream.Collectors.toList());
    }

    private VehicleResponse mapToResponse(Vehicle vehicle) {
        VehicleResponse response = new VehicleResponse();
        response.setId(vehicle.getId());
        response.setOwnerId(vehicle.getOwnerId());
        response.setType(vehicle.getType());
        response.setBrand(vehicle.getBrand());
        response.setModel(vehicle.getModel());
        response.setYear(vehicle.getYear());
        response.setColor(vehicle.getColor());
        response.setPlate(vehicle.getPlate());
        response.setVin(vehicle.getVin());
        response.setStatus(vehicle.getStatus());
        response.setFeatures(vehicle.getFeatures());
        response.setCreatedAt(vehicle.getCreatedAt());
        response.setUpdatedAt(vehicle.getUpdatedAt());

        if (vehicle.getCapacity() != null) {
            VehicleCreateRequest.Capacity capacity = new VehicleCreateRequest.Capacity();
            capacity.setPassengers(vehicle.getCapacity().getPassengers());
            capacity.setCargoKg(vehicle.getCapacity().getCargoKg());
            capacity.setCargoVolume(vehicle.getCapacity().getCargoVolume());
            response.setCapacity(capacity);
        }

        if (vehicle.getDocuments() != null) {
            VehicleCreateRequest.Documents documents = new VehicleCreateRequest.Documents();
            documents.setRegistration(vehicle.getDocuments().getRegistration());
            documents.setInsurance(vehicle.getDocuments().getInsurance());
            documents.setInsuranceExpiry(vehicle.getDocuments().getInsuranceExpiry());
            documents.setTechnicalInspection(vehicle.getDocuments().getTechnicalInspection());
            documents.setTechnicalInspectionExpiry(vehicle.getDocuments().getTechnicalInspectionExpiry());
            response.setDocuments(documents);
        }
        return response;
    }

    private void linkVehicleToOwner(Vehicle vehicle) {
        userRepository.findById(vehicle.getOwnerId()).ifPresent(user -> {
            List<String> vehicleIds = user.getVehicleIds() != null
                    ? new ArrayList<>(user.getVehicleIds())
                    : new ArrayList<>();
            if (!vehicleIds.contains(vehicle.getId())) {
                vehicleIds.add(vehicle.getId());
                user.setVehicleIds(vehicleIds);
                user.setUpdatedAt(Instant.now());
                userRepository.save(user);
            }
        });
    }
}
