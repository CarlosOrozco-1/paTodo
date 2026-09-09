package com.paTodo.backend.job.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;

public class JobRouteRequest {

    @NotBlank
    private String type;

    private Geometry geometry;
    private String polyline;
    private double distance;
    private double duration;
    private String source;
    private List<Waypoint> waypoints;

    public JobRouteRequest() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Geometry getGeometry() { return geometry; }
    public void setGeometry(Geometry geometry) { this.geometry = geometry; }

    public String getPolyline() { return polyline; }
    public void setPolyline(String polyline) { this.polyline = polyline; }

    public double getDistance() { return distance; }
    public void setDistance(double distance) { this.distance = distance; }

    public double getDuration() { return duration; }
    public void setDuration(double duration) { this.duration = duration; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public List<Waypoint> getWaypoints() { return waypoints; }
    public void setWaypoints(List<Waypoint> waypoints) { this.waypoints = waypoints; }

    public static class Geometry {
        private String type = "LineString";
        private List<double[]> coordinates;

        public Geometry() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public List<double[]> getCoordinates() { return coordinates; }
        public void setCoordinates(List<double[]> coordinates) { this.coordinates = coordinates; }
    }

    public static class Waypoint {
        private String type = "Point";
        private double[] coordinates;
        private String name;

        public Waypoint() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public double[] getCoordinates() { return coordinates; }
        public void setCoordinates(double[] coordinates) { this.coordinates = coordinates; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }
}
