package com.paTodo.backend.user.repository;

import com.paTodo.backend.user.model.Vehicle;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface VehicleRepository extends MongoRepository<Vehicle, String> {
    List<Vehicle> findByOwnerId(String ownerId);
    Vehicle findByPlate(String plate);
}
