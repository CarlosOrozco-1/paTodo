package com.paTodo.backend.repository;

import com.paTodo.backend.model.Skill;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SkillRepository extends MongoRepository<Skill, String> {
    Skill findBySlug(String slug);
    List<Skill> findByIsActiveTrue();
    List<Skill> findByCategoryIdsContaining(String categoryId);
}