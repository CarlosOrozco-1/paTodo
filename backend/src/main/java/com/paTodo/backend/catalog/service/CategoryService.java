package com.paTodo.backend.catalog.service;

import com.paTodo.backend.catalog.dto.CategoryResponse;
import com.paTodo.backend.catalog.model.Category;
import com.paTodo.backend.catalog.repository.CategoryRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<CategoryResponse> getAll() {
        return categoryRepository.findByIsActiveTrue().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public Optional<CategoryResponse> getById(String id) {
        return categoryRepository.findById(id).map(this::toDto);
    }

    public CategoryResponse getBySlug(String slug) {
        Category category = categoryRepository.findBySlug(slug);
        return category != null ? toDto(category) : null;
    }

    public List<CategoryResponse> getRootCategories() {
        return categoryRepository.findByParentIdIsNull().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<CategoryResponse> getChildren(String parentId) {
        return categoryRepository.findByParentId(parentId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private CategoryResponse toDto(Category category) {
        CategoryResponse dto = new CategoryResponse();
        dto.setId(category.getId());
        dto.setName(category.getName());
        dto.setSlug(category.getSlug());
        dto.setDescription(category.getDescription());
        dto.setIcon(category.getIcon());
        dto.setColor(category.getColor());
        dto.setImageUrl(category.getImageUrl());
        dto.setParentId(category.getParentId());
        dto.setSkillIds(category.getSkillIds());
        dto.setActive(category.isActive());
        dto.setSortOrder(category.getSortOrder());
        dto.setCreatedAt(category.getCreatedAt());
        dto.setUpdatedAt(category.getUpdatedAt());
        return dto;
    }
}