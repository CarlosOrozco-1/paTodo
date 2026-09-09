package com.paTodo.backend.user.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "vehicles")
public class Vehicle {

    @Id
    private String id;

    private String ownerId;

    private String type;

    private String brand;

    private String model;

    private int year;

    private String color;

    private String plate;

    private String vin;

    private Capacity capacity;

    private Documents documents;

    private String status;

    private List<String> features;

    private Instant createdAt;

    private Instant updatedAt;

    public Vehicle() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getPlate() { return plate; }
    public void setPlate(String plate) { this.plate = plate; }

    public String getVin() { return vin; }
    public void setVin(String vin) { this.vin = vin; }

    public Capacity getCapacity() { return capacity; }
    public void setCapacity(Capacity capacity) { this.capacity = capacity; }

    public Documents getDocuments() { return documents; }
    public void setDocuments(Documents documents) { this.documents = documents; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getFeatures() { return features; }
    public void setFeatures(List<String> features) { this.features = features; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Capacity {
        private int passengers = 0;
        private double cargoKg = 0;
        private double cargoVolume = 0;

        public Capacity() {}

        public int getPassengers() { return passengers; }
        public void setPassengers(int passengers) { this.passengers = passengers; }

        public double getCargoKg() { return cargoKg; }
        public void setCargoKg(double cargoKg) { this.cargoKg = cargoKg; }

        public double getCargoVolume() { return cargoVolume; }
        public void setCargoVolume(double cargoVolume) { this.cargoVolume = cargoVolume; }
    }

    public static class Documents {
        private String registration;
        private String insurance;
        private String insuranceExpiry;
        private String technicalInspection;
        private String technicalInspectionExpiry;

        public Documents() {}

        public String getRegistration() { return registration; }
        public void setRegistration(String registration) { this.registration = registration; }

        public String getInsurance() { return insurance; }
        public void setInsurance(String insurance) { this.insurance = insurance; }

        public String getInsuranceExpiry() { return insuranceExpiry; }
        public void setInsuranceExpiry(String insuranceExpiry) { this.insuranceExpiry = insuranceExpiry; }

        public String getTechnicalInspection() { return technicalInspection; }
        public void setTechnicalInspection(String technicalInspection) { this.technicalInspection = technicalInspection; }

        public String getTechnicalInspectionExpiry() { return technicalInspectionExpiry; }
        public void setTechnicalInspectionExpiry(String technicalInspectionExpiry) { this.technicalInspectionExpiry = technicalInspectionExpiry; }
    }
}
