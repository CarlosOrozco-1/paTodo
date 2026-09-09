package com.paTodo.backend.job.dto;

import java.time.Instant;

/**
 * DTO (Data Transfer Object) para devolver la información de una Oferta (Offer).
 * 
 * ====================================================================================
 * EXPLICACIÓN DEL FLUJO DE DATOS
 * ====================================================================================
 * 
 * 1. El Trabajador (Worker) envía un OfferCreateRequest con su precio y tiempo estimado.
 * 2. El OfferService crea el modelo interno "Offer" en MongoDB. Al hacerlo, toma
 *    una "foto" (WorkerSnapshot) del nombre, rating y avatar actual del trabajador,
 *    para que si el trabajador cambia su nombre mañana, esta oferta conserve el nombre
 *    con el que aplicó originalmente.
 * 3. Cuando el Cliente pide listar las ofertas de su trabajo (GET /jobs/{id}/offers),
 *    el OfferService lee los "Offer" de MongoDB y los transforma a "OfferResponse".
 * 4. El controlador devuelve una lista de "OfferResponse" al Frontend.
 */
public class OfferResponse {
    private String id;
    private String jobId;
    private String workerId;
    private WorkerSnapshot workerSnapshot;
    private double price;
    private String currency;
    private int estimatedTime;
    private String message;
    private String status;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant updatedAt;

    public OfferResponse() {}

    // Getters y Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getWorkerId() { return workerId; }
    public void setWorkerId(String workerId) { this.workerId = workerId; }

    public WorkerSnapshot getWorkerSnapshot() { return workerSnapshot; }
    public void setWorkerSnapshot(WorkerSnapshot workerSnapshot) { this.workerSnapshot = workerSnapshot; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public int getEstimatedTime() { return estimatedTime; }
    public void setEstimatedTime(int estimatedTime) { this.estimatedTime = estimatedTime; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class WorkerSnapshot {
        private String name;
        private double rating;
        private int completedJobs;
        private String avatarUrl;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public double getRating() { return rating; }
        public void setRating(double rating) { this.rating = rating; }

        public int getCompletedJobs() { return completedJobs; }
        public void setCompletedJobs(int completedJobs) { this.completedJobs = completedJobs; }

        public String getAvatarUrl() { return avatarUrl; }
        public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    }
}
