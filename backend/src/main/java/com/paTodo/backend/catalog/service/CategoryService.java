package com.paTodo.backend.catalog.service;

import com.paTodo.backend.catalog.model.Category;
import com.paTodo.backend.catalog.repository.CategoryRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<Category> getAll() {
        return categoryRepository.findByIsActiveTrue();
    }

    public Optional<Category> getById(String id) {
        return categoryRepository.findById(id);
    }

    public Category getBySlug(String slug) {
        return categoryRepository.findBySlug(slug);
    }

    public List<Category> getRootCategories() {
        return categoryRepository.findByParentIdIsNull();
    }

    public List<Category> getChildren(String parentId) {
        return categoryRepository.findByParentId(parentId);
    }
}
