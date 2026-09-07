package com.paTodo.backend.repository;

import com.paTodo.backend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByAccountEmail(String email);
    List<User> findByRole(String role);
    List<User> findBySkillIdsIn(List<String> skillIds);
    List<User> findByAvailabilityIsOnlineTrueAndRoleIn(List<String> roles);
}