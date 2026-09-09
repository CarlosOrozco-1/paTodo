package com.paTodo.backend.user.service;

import com.paTodo.backend.user.dto.AuthResponse;
import com.paTodo.backend.user.dto.LoginRequest;
import com.paTodo.backend.user.dto.RefreshRequest;
import com.paTodo.backend.user.dto.RegisterRequest;
import com.paTodo.backend.common.exception.BadRequestException;
import com.paTodo.backend.user.mapper.UserMapper;
import com.paTodo.backend.user.model.User;
import com.paTodo.backend.user.repository.UserRepository;
import com.paTodo.backend.common.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByAccountEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("Email ya registrado");
        }

        User.Account account = new User.Account();
        account.setEmail(request.getEmail());
        account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        account.setVerified(false);

        User.Profile profile = new User.Profile();
        profile.setFirstName(request.getFirstName());
        profile.setLastName(request.getLastName());

        User.Address address = new User.Address();
        address.setCountry("GT");

        User.Contact contact = new User.Contact();
        contact.setPhone(request.getPhone());
        contact.setAddress(address);

        User.Location center = new User.Location();
        center.setType("Point");
        center.setCoordinates(new double[]{0, 0});

        User.ServiceArea serviceArea = new User.ServiceArea();
        serviceArea.setCenter(center);
        serviceArea.setRadiusKm(10);

        User.Availability availability = new User.Availability();
        availability.setOnline(false);
        availability.setServiceArea(serviceArea);

        User user = new User();
        user.setRole(request.getRole());
        user.setAccount(account);
        user.setProfile(profile);
        user.setContact(contact);
        user.setStats(new User.Stats());
        user.setAvailability(availability);
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());

        user = userRepository.save(user);

        return createAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByAccountEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("Usuario no encontrado"));

        user.getAccount().setLastLogin(Instant.now());
        userRepository.save(user);

        return createAuthResponse(user);
    }

    public AuthResponse refresh(RefreshRequest request) {
        String refreshToken = request.getRefreshToken();
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new BadRequestException("Refresh token inválido o expirado");
        }

        String userId = jwtTokenProvider.getUserId(refreshToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("Usuario no encontrado"));

        return createAuthResponse(user);
    }

    private AuthResponse createAuthResponse(User user) {
        String accessToken = jwtTokenProvider.createAccessToken(user.getId(), user.getAccount().getEmail(), user.getRole());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

        AuthResponse response = new AuthResponse();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setExpiresIn(900);
        response.setUser(UserMapper.toUserDto(user));

        return response;
    }
}
