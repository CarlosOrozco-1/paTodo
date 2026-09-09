package com.paTodo.backend.review.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "reviews")
public class Review {

    @Id
    private String id;

    @Indexed(unique = true)
    private String jobId;

    private String reviewerId;

    private String revieweeId;

    private int rating;

    private String comment;

    private Aspects aspects;

    private boolean isPublic = true;

    private Response response;

    private Instant createdAt;

    private Instant updatedAt;

    public Review() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getReviewerId() { return reviewerId; }
    public void setReviewerId(String reviewerId) { this.reviewerId = reviewerId; }

    public String getRevieweeId() { return revieweeId; }
    public void setRevieweeId(String revieweeId) { this.revieweeId = revieweeId; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public Aspects getAspects() { return aspects; }
    public void setAspects(Aspects aspects) { this.aspects = aspects; }

    public boolean isPublic() { return isPublic; }
    public void setPublic(boolean aPublic) { isPublic = aPublic; }

    public Response getResponse() { return response; }
    public void setResponse(Response response) { this.response = response; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Aspects {
        private Integer quality;
        private Integer punctuality;
        private Integer communication;
        private Integer value;

        public Aspects() {}

        public Integer getQuality() { return quality; }
        public void setQuality(Integer quality) { this.quality = quality; }

        public Integer getPunctuality() { return punctuality; }
        public void setPunctuality(Integer punctuality) { this.punctuality = punctuality; }

        public Integer getCommunication() { return communication; }
        public void setCommunication(Integer communication) { this.communication = communication; }

        public Integer getValue() { return value; }
        public void setValue(Integer value) { this.value = value; }
    }

    public static class Response {
        private String comment;
        private Instant createdAt;

        public Response() {}

        public String getComment() { return comment; }
        public void setComment(String comment) { this.comment = comment; }

        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    }
}
