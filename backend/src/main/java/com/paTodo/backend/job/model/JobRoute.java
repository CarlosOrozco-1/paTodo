package com.paTodo.backend.job.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "job_routes")
public class JobRoute {

    @Id
    private String id;

    private String jobId;

    private String type;

    private Geometry geometry;

    private String polyline;

    private double distance;

    private double duration;

    private String source;

    private List<Waypoint> waypoints;

    private Instant createdAt;

    private Instant expiresAt;

    public JobRoute() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

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

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

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
