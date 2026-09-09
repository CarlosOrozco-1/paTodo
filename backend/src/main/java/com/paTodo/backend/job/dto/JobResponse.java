package com.paTodo.backend.job.dto;

import java.time.Instant;
import java.util.List;

/**
 * DTO (Data Transfer Object) para devolver la información de un Trabajo (Job).
 * 
 * ====================================================================================
 * EXPLICACIÓN DEL FLUJO DE DATOS (BD -> SERVICIO -> DTO -> CLIENTE)
 * ====================================================================================
 * 
 * 1. Base de Datos (MongoDB): Almacena la entidad "Job.java" (con su @Id, versiones, 
 *    auditoría o referencias de base de datos que el cliente no necesita conocer).
 * 
 * 2. Repository: Spring Data lee el documento BSON y lo convierte a la entidad Java "Job".
 * 
 * 3. Service Layer (JobService): Recibe la entidad "Job" del repositorio, aplica
 *    lógica de negocio (ej. validar si el usuario tiene permiso para verlo), y finalmente
 *    CONVIERTE el "Job" original en este DTO "JobResponse".
 * 
 * 4. Controller (JobController): Retorna este DTO serializado a JSON.
 * 
 * ¿Por qué usamos DTOs y no devolvemos la entidad Job directamente?
 * - Seguridad: Evita filtrar accidentalmente datos internos o contraseñas.
 * - Flexibilidad: Si cambiamos el esquema de MongoDB, la API no se rompe porque el 
 *   DTO actúa como un "contrato" estable (basado en openapi.yaml).
 * - Desacoplamiento: El Frontend (React/Flutter) depende de este DTO, no de la BD.
 */
public class JobResponse {
    private String id;
    private String clientId;
    private String workerId;
    private String status;
    private String acceptedOfferId;
    private Instant scheduledFor;
    private Instant startedAt;
    private Instant completedAt;
    private Instant cancelledAt;
    private String cancellationReason;
    private Instant createdAt;
    private Instant updatedAt;

    private Details details;
    private Location location;
    private Pricing pricing;

    public JobResponse() {}

    // Getters y Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getWorkerId() { return workerId; }
    public void setWorkerId(String workerId) { this.workerId = workerId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAcceptedOfferId() { return acceptedOfferId; }
    public void setAcceptedOfferId(String acceptedOfferId) { this.acceptedOfferId = acceptedOfferId; }

    public Instant getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(Instant scheduledFor) { this.scheduledFor = scheduledFor; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public Details getDetails() { return details; }
    public void setDetails(Details details) { this.details = details; }

    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }

    public Pricing getPricing() { return pricing; }
    public void setPricing(Pricing pricing) { this.pricing = pricing; }

    // Clases internas para la estructura anidada (idénticas a la especificación pública)
    public static class Details {
        private String title;
        private String description;
        private String categoryId;
        private List<String> skillIds;

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getCategoryId() { return categoryId; }
        public void setCategoryId(String categoryId) { this.categoryId = categoryId; }
        public List<String> getSkillIds() { return skillIds; }
        public void setSkillIds(List<String> skillIds) { this.skillIds = skillIds; }
    }

    public static class Location {
        private String type;
        private double[] coordinates;
        private String address;
        private String placeId;

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public double[] getCoordinates() { return coordinates; }
        public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        public String getPlaceId() { return placeId; }
        public void setPlaceId(String placeId) { this.placeId = placeId; }
    }

    public static class Pricing {
        private double proposedPrice;
        private String currency;
        private String priceType;

        public double getProposedPrice() { return proposedPrice; }
        public void setProposedPrice(double proposedPrice) { this.proposedPrice = proposedPrice; }
        public String getCurrency() { return currency; }
        public void setCurrency(String currency) { this.currency = currency; }
        public String getPriceType() { return priceType; }
        public void setPriceType(String priceType) { this.priceType = priceType; }
    }
}
