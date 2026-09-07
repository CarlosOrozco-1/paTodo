package com.paTodo.backend.mapper;

import com.paTodo.backend.dto.AuthResponse;
import com.paTodo.backend.model.User;

public class UserMapper {

    public static AuthResponse.UserDto toUserDto(User user) {
        return new AuthResponse.UserDto(
                user.getId(),
                user.getProfile().getFirstName(),
                user.getProfile().getLastName(),
                user.getAccount().getEmail(),
                user.getRole(),
                user.getProfile() != null ? user.getProfile().getAvatarUrl() : null
        );
    }
}