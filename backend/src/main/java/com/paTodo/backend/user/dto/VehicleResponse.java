package com.paTodo.backend.user.dto;

import java.time.Instant;
import java.util.List;

public class VehicleResponse {

    private String id;
    private String ownerId;
    private String type;
    private String brand;
    private String model;
    private int year;
    private String color;
    private String plate;
    private String vin;
    private VehicleCreateRequest.Capacity capacity;
    private VehicleCreateRequest.Documents documents;
    private String status;
    private List<String> features;
    private Instant createdAt;
    private Instant updatedAt;

    public VehicleResponse() {}

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

    public VehicleCreateRequest.Capacity getCapacity() { return capacity; }
    public void setCapacity(VehicleCreateRequest.Capacity capacity) { this.capacity = capacity; }

    public VehicleCreateRequest.Documents getDocuments() { return documents; }
    public void setDocuments(VehicleCreateRequest.Documents documents) { this.documents = documents; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getFeatures() { return features; }
    public void setFeatures(List<String> features) { this.features = features; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
