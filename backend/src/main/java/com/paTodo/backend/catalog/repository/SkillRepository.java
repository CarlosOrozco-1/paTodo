package com.paTodo.backend.catalog.repository;

import com.paTodo.backend.catalog.model.Skill;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SkillRepository extends MongoRepository<Skill, String> {
    Skill findBySlug(String slug);
    List<Skill> findByIsActiveTrue();
    List<Skill> findByCategoryIdsContaining(String categoryId);
}
