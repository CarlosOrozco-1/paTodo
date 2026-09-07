package com.paTodo.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ReviewCreateRequest {

    @NotBlank
    private String jobId;

    @NotBlank
    private String revieweeId;

    @NotNull
    @Min(1)
    @Max(5)
    private Integer rating;

    @Size(max = 1000)
    private String comment;

    private Aspects aspects;

    public ReviewCreateRequest() {}

    public ReviewCreateRequest(String jobId, String revieweeId, Integer rating, String comment, Aspects aspects) {
        this.jobId = jobId;
        this.revieweeId = revieweeId;
        this.rating = rating;
        this.comment = comment;
        this.aspects = aspects;
    }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getRevieweeId() { return revieweeId; }
    public void setRevieweeId(String revieweeId) { this.revieweeId = revieweeId; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public Aspects getAspects() { return aspects; }
    public void setAspects(Aspects aspects) { this.aspects = aspects; }

    public static class Aspects {
        @Min(1)
        @Max(5)
        private Integer quality;

        @Min(1)
        @Max(5)
        private Integer punctuality;

        @Min(1)
        @Max(5)
        private Integer communication;

        @Min(1)
        @Max(5)
        private Integer value;

        public Aspects() {}

        public Aspects(Integer quality, Integer punctuality, Integer communication, Integer value) {
            this.quality = quality;
            this.punctuality = punctuality;
            this.communication = communication;
            this.value = value;
        }

        public Integer getQuality() { return quality; }
        public void setQuality(Integer quality) { this.quality = quality; }

        public Integer getPunctuality() { return punctuality; }
        public void setPunctuality(Integer punctuality) { this.punctuality = punctuality; }

        public Integer getCommunication() { return communication; }
        public void setCommunication(Integer communication) { this.communication = communication; }

        public Integer getValue() { return value; }
        public void setValue(Integer value) { this.value = value; }
    }
}