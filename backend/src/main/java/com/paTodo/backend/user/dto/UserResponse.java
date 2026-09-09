package com.paTodo.backend.user.dto;

import java.time.Instant;
import java.util.List;

public class UserResponse {

    private String id;
    private String email;
    private String role;
    private String firstName;
    private String lastName;
    private String avatarUrl;
    private String bio;
    private String phone;
    private List<String> skillIds;
    private double rating;
    private int ratingCount;
    private int completedJobs;
    private boolean online;
    private double[] coordinates;
    private Instant createdAt;
    private Instant updatedAt;

    public UserResponse() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public List<String> getSkillIds() { return skillIds; }
    public void setSkillIds(List<String> skillIds) { this.skillIds = skillIds; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public int getRatingCount() { return ratingCount; }
    public void setRatingCount(int ratingCount) { this.ratingCount = ratingCount; }

    public int getCompletedJobs() { return completedJobs; }
    public void setCompletedJobs(int completedJobs) { this.completedJobs = completedJobs; }

    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }

    public double[] getCoordinates() { return coordinates; }
    public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
