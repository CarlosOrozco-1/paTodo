package com.paTodo.backend.user.dto;

import jakarta.validation.constraints.Size;
import java.util.List;

public class ProfileUpdateRequest {

    @Size(min = 2, max = 50)
    private String firstName;

    @Size(min = 2, max = 50)
    private String lastName;

    private String avatarUrl;

    @Size(max = 500)
    private String bio;

    private String phone;

    private List<String> skillIds;

    private Boolean online;

    public ProfileUpdateRequest() {}

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

    public Boolean getOnline() { return online; }
    public void setOnline(Boolean online) { this.online = online; }
}
