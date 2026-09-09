package com.paTodo.backend.user.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String role;

    private List<String> skillIds;

    private Account account;

    private Profile profile;

    private Contact contact;

    private Location location;

    private Stats stats;

    private Availability availability;

    private List<String> vehicleIds;

    private Map<String, Object> notificationSettings;

    private Instant createdAt;

    private Instant updatedAt;

    public User() {}

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public List<String> getSkillIds() { return skillIds; }
    public void setSkillIds(List<String> skillIds) { this.skillIds = skillIds; }

    public Account getAccount() { return account; }
    public void setAccount(Account account) { this.account = account; }

    public Profile getProfile() { return profile; }
    public void setProfile(Profile profile) { this.profile = profile; }

    public Contact getContact() { return contact; }
    public void setContact(Contact contact) { this.contact = contact; }

    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }

    public Stats getStats() { return stats; }
    public void setStats(Stats stats) { this.stats = stats; }

    public Availability getAvailability() { return availability; }
    public void setAvailability(Availability availability) { this.availability = availability; }

    public List<String> getVehicleIds() { return vehicleIds; }
    public void setVehicleIds(List<String> vehicleIds) { this.vehicleIds = vehicleIds; }

    public Map<String, Object> getNotificationSettings() { return notificationSettings; }
    public void setNotificationSettings(Map<String, Object> notificationSettings) { this.notificationSettings = notificationSettings; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class Account {
        @Indexed(unique = true)
        private String email;
        private String passwordHash;
        private boolean verified = false;
        private Instant lastLogin;
        private int loginAttempts = 0;
        private Instant lockUntil;

        public Account() {}

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPasswordHash() { return passwordHash; }
        public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

        public boolean isVerified() { return verified; }
        public void setVerified(boolean verified) { this.verified = verified; }

        public Instant getLastLogin() { return lastLogin; }
        public void setLastLogin(Instant lastLogin) { this.lastLogin = lastLogin; }

        public int getLoginAttempts() { return loginAttempts; }
        public void setLoginAttempts(int loginAttempts) { this.loginAttempts = loginAttempts; }

        public Instant getLockUntil() { return lockUntil; }
        public void setLockUntil(Instant lockUntil) { this.lockUntil = lockUntil; }
    }

    public static class Profile {
        private String firstName;
        private String lastName;
        private String avatarUrl;
        private String bio;
        private String gender;
        private String birthdate;

        public Profile() {}

        public String getFirstName() { return firstName; }
        public void setFirstName(String firstName) { this.firstName = firstName; }

        public String getLastName() { return lastName; }
        public void setLastName(String lastName) { this.lastName = lastName; }

        public String getAvatarUrl() { return avatarUrl; }
        public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

        public String getBio() { return bio; }
        public void setBio(String bio) { this.bio = bio; }

        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }

        public String getBirthdate() { return birthdate; }
        public void setBirthdate(String birthdate) { this.birthdate = birthdate; }
    }

    public static class Contact {
        private String phone;
        private String alternatePhone;
        private Address address;

        public Contact() {}

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getAlternatePhone() { return alternatePhone; }
        public void setAlternatePhone(String alternatePhone) { this.alternatePhone = alternatePhone; }

        public Address getAddress() { return address; }
        public void setAddress(Address address) { this.address = address; }
    }

    public static class Address {
        private String street;
        private String city;
        private String state;
        private String zip;
        private String country = "GT";

        public Address() {}

        public String getStreet() { return street; }
        public void setStreet(String street) { this.street = street; }

        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }

        public String getState() { return state; }
        public void setState(String state) { this.state = state; }

        public String getZip() { return zip; }
        public void setZip(String zip) { this.zip = zip; }

        public String getCountry() { return country; }
        public void setCountry(String country) { this.country = country; }
    }

    public static class Location {
        private String type = "Point";
        private double[] coordinates;

        public Location() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public double[] getCoordinates() { return coordinates; }
        public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }
    }

    public static class Stats {
        private double rating = 0;
        private int ratingCount = 0;
        private int completedJobs = 0;
        private int cancelledJobs = 0;
        private int responseTimeMin = 0;

        public Stats() {}

        public double getRating() { return rating; }
        public void setRating(double rating) { this.rating = rating; }

        public int getRatingCount() { return ratingCount; }
        public void setRatingCount(int ratingCount) { this.ratingCount = ratingCount; }

        public int getCompletedJobs() { return completedJobs; }
        public void setCompletedJobs(int completedJobs) { this.completedJobs = completedJobs; }

        public int getCancelledJobs() { return cancelledJobs; }
        public void setCancelledJobs(int cancelledJobs) { this.cancelledJobs = cancelledJobs; }

        public int getResponseTimeMin() { return responseTimeMin; }
        public void setResponseTimeMin(int responseTimeMin) { this.responseTimeMin = responseTimeMin; }
    }

    public static class Availability {
        private boolean isOnline = false;
        private List<WorkingHours> workingHours;
        private ServiceArea serviceArea;

        public Availability() {}

        public boolean isOnline() { return isOnline; }
        public void setOnline(boolean online) { isOnline = online; }

        public List<WorkingHours> getWorkingHours() { return workingHours; }
        public void setWorkingHours(List<WorkingHours> workingHours) { this.workingHours = workingHours; }

        public ServiceArea getServiceArea() { return serviceArea; }
        public void setServiceArea(ServiceArea serviceArea) { this.serviceArea = serviceArea; }
    }

    public static class WorkingHours {
        private String day;
        private String start;
        private String end;

        public WorkingHours() {}

        public String getDay() { return day; }
        public void setDay(String day) { this.day = day; }

        public String getStart() { return start; }
        public void setStart(String start) { this.start = start; }

        public String getEnd() { return end; }
        public void setEnd(String end) { this.end = end; }
    }

    public static class ServiceArea {
        private Location center;
        private double radiusKm = 10;

        public ServiceArea() {}

        public Location getCenter() { return center; }
        public void setCenter(Location center) { this.center = center; }

        public double getRadiusKm() { return radiusKm; }
        public void setRadiusKm(double radiusKm) { this.radiusKm = radiusKm; }
    }
}
