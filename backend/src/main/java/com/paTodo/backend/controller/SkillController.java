package com.paTodo.backend.controller;

import com.paTodo.backend.model.Skill;
import com.paTodo.backend.repository.SkillRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/skills")
public class SkillController {

    private final SkillRepository skillRepository;

    public SkillController(SkillRepository skillRepository) {
        this.skillRepository = skillRepository;
    }

    @GetMapping
    public ResponseEntity<List<Skill>> getAll(@RequestParam(required = false) String categoryId) {
        if (categoryId != null) {
            return ResponseEntity.ok(skillRepository.findByCategoryIdsContaining(categoryId));
        }
        return ResponseEntity.ok(skillRepository.findByIsActiveTrue());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Skill> getById(@PathVariable String id) {
        return skillRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<Skill> getBySlug(@PathVariable String slug) {
        Skill skill = skillRepository.findBySlug(slug);
        if (skill == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(skill);
    }
}