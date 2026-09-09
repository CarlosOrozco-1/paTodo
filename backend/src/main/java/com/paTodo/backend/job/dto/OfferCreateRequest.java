package com.paTodo.backend.job.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public class OfferCreateRequest {

    @NotBlank
    private String jobId;

    @NotNull
    @Positive
    private Double price;

    private String currency = "GTQ";

    @NotNull
    @Positive
    private Integer estimatedTime;

    @Size(max = 500)
    private String message;

    public OfferCreateRequest() {}

    public OfferCreateRequest(String jobId, Double price, String currency, Integer estimatedTime, String message) {
        this.jobId = jobId;
        this.price = price;
        this.currency = currency;
        this.estimatedTime = estimatedTime;
        this.message = message;
    }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public Integer getEstimatedTime() { return estimatedTime; }
    public void setEstimatedTime(Integer estimatedTime) { this.estimatedTime = estimatedTime; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
