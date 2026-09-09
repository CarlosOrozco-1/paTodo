package com.paTodo.backend.job.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public class JobCreateRequest {

    @Valid
    @NotNull
    private Details details;

    @Valid
    @NotNull
    private Location location;

    @Valid
    @NotNull
    private Pricing pricing;

    public JobCreateRequest() {}

    public JobCreateRequest(Details details, Location location, Pricing pricing) {
        this.details = details;
        this.location = location;
        this.pricing = pricing;
    }

    public Details getDetails() { return details; }
    public void setDetails(Details details) { this.details = details; }

    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }

    public Pricing getPricing() { return pricing; }
    public void setPricing(Pricing pricing) { this.pricing = pricing; }

    public static class Details {
        @NotBlank
        @Size(min = 5, max = 100)
        private String title;

        @NotBlank
        @Size(min = 10, max = 2000)
        private String description;

        @NotBlank
        private String categoryId;

        private List<String> skillIds;

        public Details() {}

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
        @NotNull
        private double[] coordinates;

        @NotBlank
        private String address;

        private String placeId;

        public Location() {}

        public Location(double[] coordinates, String address, String placeId) {
            this.coordinates = coordinates;
            this.address = address;
            this.placeId = placeId;
        }

        public double[] getCoordinates() { return coordinates; }
        public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }

        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }

        public String getPlaceId() { return placeId; }
        public void setPlaceId(String placeId) { this.placeId = placeId; }
    }

    public static class Pricing {
        @Positive
        private double proposedPrice;

        private String currency = "GTQ";

        private String priceType = "fixed";

        public Pricing() {}

        public Pricing(double proposedPrice, String currency, String priceType) {
            this.proposedPrice = proposedPrice;
            this.currency = currency;
            this.priceType = priceType;
        }

        public double getProposedPrice() { return proposedPrice; }
        public void setProposedPrice(double proposedPrice) { this.proposedPrice = proposedPrice; }

        public String getCurrency() { return currency; }
        public void setCurrency(String currency) { this.currency = currency; }

        public String getPriceType() { return priceType; }
        public void setPriceType(String priceType) { this.priceType = priceType; }
    }
}
