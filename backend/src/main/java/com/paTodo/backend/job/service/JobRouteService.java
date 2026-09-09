package com.paTodo.backend.job.service;

import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.job.dto.JobRouteRequest;
import com.paTodo.backend.job.dto.JobRouteResponse;
import com.paTodo.backend.job.model.JobRoute;
import com.paTodo.backend.job.repository.JobRouteRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class JobRouteService {

    private final JobRouteRepository jobRouteRepository;

    public JobRouteService(JobRouteRepository jobRouteRepository) {
        this.jobRouteRepository = jobRouteRepository;
    }

    public JobRouteResponse saveRoute(String jobId, JobRouteRequest request) {
        JobRoute route = new JobRoute();
        route.setJobId(jobId);
        route.setType(request.getType());
        route.setPolyline(request.getPolyline());
        route.setDistance(request.getDistance());
        route.setDuration(request.getDuration());
        route.setSource(request.getSource() != null ? request.getSource() : "manual");
        route.setCreatedAt(Instant.now());

        if (request.getGeometry() != null) {
            JobRoute.Geometry geometry = new JobRoute.Geometry();
            geometry.setType(request.getGeometry().getType() != null ? request.getGeometry().getType() : "LineString");
            geometry.setCoordinates(request.getGeometry().getCoordinates());
            route.setGeometry(geometry);
        }

        if (request.getWaypoints() != null) {
            List<JobRoute.Waypoint> waypoints = request.getWaypoints().stream().map(w -> {
                JobRoute.Waypoint waypoint = new JobRoute.Waypoint();
                waypoint.setType(w.getType() != null ? w.getType() : "Point");
                waypoint.setCoordinates(w.getCoordinates());
                waypoint.setName(w.getName());
                return waypoint;
            }).collect(Collectors.toList());
            route.setWaypoints(waypoints);
        }

        return mapToResponse(jobRouteRepository.save(route));
    }

    public JobRouteResponse getLatestRoute(String jobId) {
        List<JobRoute> routes = jobRouteRepository.findByJobId(jobId);
        if (routes.isEmpty()) {
            throw new ResourceNotFoundException("Ruta no encontrada para el trabajo: " + jobId);
        }
        return mapToResponse(routes.get(routes.size() - 1));
    }

    private JobRouteResponse mapToResponse(JobRoute route) {
        JobRouteResponse response = new JobRouteResponse();
        response.setId(route.getId());
        response.setJobId(route.getJobId());
        response.setType(route.getType());
        response.setPolyline(route.getPolyline());
        response.setDistance(route.getDistance());
        response.setDuration(route.getDuration());
        response.setSource(route.getSource());
        response.setCreatedAt(route.getCreatedAt());
        response.setExpiresAt(route.getExpiresAt());

        if (route.getGeometry() != null) {
            JobRouteResponse.Geometry geometry = new JobRouteResponse.Geometry();
            geometry.setType(route.getGeometry().getType());
            geometry.setCoordinates(route.getGeometry().getCoordinates());
            response.setGeometry(geometry);
        }

        if (route.getWaypoints() != null) {
            List<JobRouteResponse.Waypoint> waypoints = route.getWaypoints().stream().map(w -> {
                JobRouteResponse.Waypoint waypoint = new JobRouteResponse.Waypoint();
                waypoint.setType(w.getType());
                waypoint.setCoordinates(w.getCoordinates());
                waypoint.setName(w.getName());
                return waypoint;
            }).collect(Collectors.toList());
            response.setWaypoints(waypoints);
        }
        return response;
    }
}
