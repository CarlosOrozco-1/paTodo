package com.paTodo.backend.user.dto;

public class PublicUserDto {

    private String id;
    private String name;
    private String avatarUrl;
    private double rating;
    private int completedJobs;

    public PublicUserDto() {}

    public PublicUserDto(String id, String name, String avatarUrl, double rating, int completedJobs) {
        this.id = id;
        this.name = name;
        this.avatarUrl = avatarUrl;
        this.rating = rating;
        this.completedJobs = completedJobs;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public int getCompletedJobs() { return completedJobs; }
    public void setCompletedJobs(int completedJobs) { this.completedJobs = completedJobs; }
}
