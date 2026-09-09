package com.paTodo.backend.message.controller;

import com.paTodo.backend.message.dto.MessageCreateRequest;
import com.paTodo.backend.message.dto.MessageResponse;
import com.paTodo.backend.message.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping("/jobs/{id}/messages")
    public ResponseEntity<MessageResponse> send(@PathVariable String id,
                                                Authentication authentication,
                                                @Valid @RequestBody MessageCreateRequest request) {
        request.setJobId(id);
        MessageResponse message = messageService.sendMessage(authentication.getName(), id, request);
        return ResponseEntity.status(201).body(message);
    }

    @GetMapping("/jobs/{id}/messages")
    public ResponseEntity<List<MessageResponse>> getByJob(@PathVariable String id,
                                                          Authentication authentication) {
        return ResponseEntity.ok(messageService.getMessagesByJob(id, authentication.getName()));
    }
}
