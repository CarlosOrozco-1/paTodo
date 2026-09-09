package com.paTodo.backend.user.controller;

import com.paTodo.backend.user.dto.LocationUpdateRequest;
import com.paTodo.backend.user.dto.ProfileUpdateRequest;
import com.paTodo.backend.user.dto.UserResponse;
import com.paTodo.backend.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<UserResponse> getMe(Authentication authentication) {
        return ResponseEntity.ok(userService.getMe(authentication.getName()));
    }

    @PutMapping
    public ResponseEntity<UserResponse> updateMe(Authentication authentication,
                                                 @Valid @RequestBody ProfileUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(authentication.getName(), request));
    }

    @PutMapping("/location")
    public ResponseEntity<UserResponse> updateLocation(Authentication authentication,
                                                       @Valid @RequestBody LocationUpdateRequest request) {
        return ResponseEntity.ok(userService.updateLocation(authentication.getName(), request));
    }
}
