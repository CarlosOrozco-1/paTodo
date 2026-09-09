package com.paTodo.backend.user.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class LocationUpdateRequest {

    @NotNull
    @Size(min = 2, max = 2)
    private double[] coordinates;

    private Boolean online;

    public LocationUpdateRequest() {}

    public LocationUpdateRequest(double[] coordinates, Boolean online) {
        this.coordinates = coordinates;
        this.online = online;
    }

    public double[] getCoordinates() { return coordinates; }
    public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }

    public Boolean getOnline() { return online; }
    public void setOnline(Boolean online) { this.online = online; }
}
