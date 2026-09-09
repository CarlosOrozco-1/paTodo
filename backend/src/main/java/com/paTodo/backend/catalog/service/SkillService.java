package com.paTodo.backend.catalog.service;

import com.paTodo.backend.catalog.model.Skill;
import com.paTodo.backend.catalog.repository.SkillRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class SkillService {

    private final SkillRepository skillRepository;

    public SkillService(SkillRepository skillRepository) {
        this.skillRepository = skillRepository;
    }

    public List<Skill> getAll(String categoryId) {
        if (categoryId != null) {
            return skillRepository.findByCategoryIdsContaining(categoryId);
        }
        return skillRepository.findByIsActiveTrue();
    }

    public Optional<Skill> getById(String id) {
        return skillRepository.findById(id);
    }

    public Skill getBySlug(String slug) {
        return skillRepository.findBySlug(slug);
    }
}
