package com.paTodo.backend.catalog.controller;

import com.paTodo.backend.catalog.dto.SkillResponse;
import com.paTodo.backend.catalog.service.SkillService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/skills")
public class SkillController {

    private final SkillService skillService;

    public SkillController(SkillService skillService) {
        this.skillService = skillService;
    }

    @GetMapping
    public ResponseEntity<List<SkillResponse>> getAll(@RequestParam(required = false) String categoryId) {
        return ResponseEntity.ok(skillService.getAll(categoryId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SkillResponse> getById(@PathVariable String id) {
        return skillService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<SkillResponse> getBySlug(@PathVariable String slug) {
        SkillResponse skill = skillService.getBySlug(slug);
        if (skill == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(skill);
    }
}