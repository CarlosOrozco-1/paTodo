package com.paTodo.backend.job.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class LocationCreateRequest {

    @NotNull
    @Size(min = 2, max = 2)
    private double[] coordinates;

    private Double accuracy;
    private Double altitude;
    private Double speed;
    private Double heading;
    private String source = "gps";

    public LocationCreateRequest() {}

    public double[] getCoordinates() { return coordinates; }
    public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }

    public Double getAccuracy() { return accuracy; }
    public void setAccuracy(Double accuracy) { this.accuracy = accuracy; }

    public Double getAltitude() { return altitude; }
    public void setAltitude(Double altitude) { this.altitude = altitude; }

    public Double getSpeed() { return speed; }
    public void setSpeed(Double speed) { this.speed = speed; }

    public Double getHeading() { return heading; }
    public void setHeading(Double heading) { this.heading = heading; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
}
