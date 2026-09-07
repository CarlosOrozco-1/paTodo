package com.paTodo.backend.repository;

import com.paTodo.backend.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CategoryRepository extends MongoRepository<Category, String> {
    Category findBySlug(String slug);
    List<Category> findByParentIdIsNull();
    List<Category> findByParentId(String parentId);
    List<Category> findByIsActiveTrue();
}