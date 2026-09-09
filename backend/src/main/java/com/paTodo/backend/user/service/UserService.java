package com.paTodo.backend.user.service;

import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.user.dto.LocationUpdateRequest;
import com.paTodo.backend.user.dto.ProfileUpdateRequest;
import com.paTodo.backend.user.dto.PublicUserDto;
import com.paTodo.backend.user.dto.UserResponse;
import com.paTodo.backend.user.model.User;
import com.paTodo.backend.user.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserResponse getMe(String userId) {
        User user = findById(userId);
        return mapToResponse(user);
    }

    public UserResponse updateProfile(String userId, ProfileUpdateRequest request) {
        User user = findById(userId);

        if (user.getProfile() == null) {
            user.setProfile(new User.Profile());
        }
        if (request.getFirstName() != null) {
            user.getProfile().setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            user.getProfile().setLastName(request.getLastName());
        }
        if (request.getAvatarUrl() != null) {
            user.getProfile().setAvatarUrl(request.getAvatarUrl());
        }
        if (request.getBio() != null) {
            user.getProfile().setBio(request.getBio());
        }
        if (request.getPhone() != null) {
            if (user.getContact() == null) {
                user.setContact(new User.Contact());
            }
            user.getContact().setPhone(request.getPhone());
        }
        if (request.getSkillIds() != null) {
            user.setSkillIds(request.getSkillIds());
        }
        if (request.getOnline() != null) {
            ensureAvailability(user);
            user.getAvailability().setOnline(request.getOnline());
        }
        user.setUpdatedAt(Instant.now());

        return mapToResponse(userRepository.save(user));
    }

    public UserResponse updateLocation(String userId, LocationUpdateRequest request) {
        User user = findById(userId);

        User.Location location = new User.Location();
        location.setType("Point");
        location.setCoordinates(request.getCoordinates());
        user.setLocation(location);

        if (request.getOnline() != null) {
            ensureAvailability(user);
            user.getAvailability().setOnline(request.getOnline());
        }
        user.setUpdatedAt(Instant.now());

        return mapToResponse(userRepository.save(user));
    }

    public PublicUserDto getPublicProfile(String userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return new PublicUserDto(userId, "Trabajador", null, 0.0, 0);
        }
        String name = "Trabajador";
        String avatarUrl = null;
        if (user.getProfile() != null) {
            String first = user.getProfile().getFirstName() != null ? user.getProfile().getFirstName() : "";
            String last = user.getProfile().getLastName() != null ? user.getProfile().getLastName() : "";
            name = (first + " " + last).trim();
            if (name.isEmpty()) {
                name = "Trabajador";
            }
            avatarUrl = user.getProfile().getAvatarUrl();
        }
        double rating = 0.0;
        int completedJobs = 0;
        if (user.getStats() != null) {
            rating = user.getStats().getRating();
            completedJobs = user.getStats().getCompletedJobs();
        }
        return new PublicUserDto(user.getId(), name, avatarUrl, rating, completedJobs);
    }

    public void updateStatsAfterReview(String revieweeId, int rating) {
        User user = userRepository.findById(revieweeId).orElse(null);
        if (user == null) {
            return;
        }
        if (user.getStats() == null) {
            user.setStats(new User.Stats());
        }
        User.Stats stats = user.getStats();
        double total = stats.getRating() * stats.getRatingCount() + rating;
        stats.setRatingCount(stats.getRatingCount() + 1);
        stats.setRating(total / stats.getRatingCount());
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
    }

    private User findById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con id: " + userId));
    }

    private void ensureAvailability(User user) {
        if (user.getAvailability() == null) {
            user.setAvailability(new User.Availability());
        }
    }

    private UserResponse mapToResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setRole(user.getRole());
        if (user.getAccount() != null) {
            response.setEmail(user.getAccount().getEmail());
        }
        if (user.getProfile() != null) {
            response.setFirstName(user.getProfile().getFirstName());
            response.setLastName(user.getProfile().getLastName());
            response.setAvatarUrl(user.getProfile().getAvatarUrl());
            response.setBio(user.getProfile().getBio());
        }
        if (user.getContact() != null) {
            response.setPhone(user.getContact().getPhone());
        }
        response.setSkillIds(user.getSkillIds());
        if (user.getStats() != null) {
            response.setRating(user.getStats().getRating());
            response.setRatingCount(user.getStats().getRatingCount());
            response.setCompletedJobs(user.getStats().getCompletedJobs());
        }
        if (user.getAvailability() != null) {
            response.setOnline(user.getAvailability().isOnline());
        }
        if (user.getLocation() != null) {
            response.setCoordinates(user.getLocation().getCoordinates());
        }
        response.setCreatedAt(user.getCreatedAt());
        response.setUpdatedAt(user.getUpdatedAt());
        return response;
    }
}
