package com.paTodo.backend.catalog.service;

import com.paTodo.backend.catalog.dto.SkillResponse;
import com.paTodo.backend.catalog.model.Skill;
import com.paTodo.backend.catalog.repository.SkillRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SkillService {

    private final SkillRepository skillRepository;

    public SkillService(SkillRepository skillRepository) {
        this.skillRepository = skillRepository;
    }

    public List<SkillResponse> getAll(String categoryId) {
        if (categoryId != null) {
            return skillRepository.findByCategoryIdsContaining(categoryId).stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
        }
        return skillRepository.findByIsActiveTrue().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public Optional<SkillResponse> getById(String id) {
        return skillRepository.findById(id).map(this::toDto);
    }

    public SkillResponse getBySlug(String slug) {
        Skill skill = skillRepository.findBySlug(slug);
        return skill != null ? toDto(skill) : null;
    }

    private SkillResponse toDto(Skill skill) {
        SkillResponse dto = new SkillResponse();
        dto.setId(skill.getId());
        dto.setName(skill.getName());
        dto.setSlug(skill.getSlug());
        dto.setDescription(skill.getDescription());
        dto.setIcon(skill.getIcon());
        dto.setCategoryIds(skill.getCategoryIds());
        dto.setActive(skill.isActive());
        dto.setCreatedAt(skill.getCreatedAt());
        dto.setUpdatedAt(skill.getUpdatedAt());
        return dto;
    }
}