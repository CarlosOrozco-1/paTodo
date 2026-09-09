package com.paTodo.backend.message.controller;

import com.paTodo.backend.message.dto.ChatInbound;
import com.paTodo.backend.message.dto.MessageCreateRequest;
import com.paTodo.backend.message.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatSocketController {

    private final MessageService messageService;

    public ChatSocketController(MessageService messageService) {
        this.messageService = messageService;
    }

    @MessageMapping("/chat.send")
    public void sendChat(@Valid ChatInbound inbound, Principal principal) {
        MessageCreateRequest request = new MessageCreateRequest();
        request.setJobId(inbound.getJobId());
        request.setReceiverId(inbound.getReceiverId());
        request.setType(inbound.getType());
        request.setContent(inbound.getContent());
        request.setReplyTo(inbound.getReplyTo());
        messageService.sendMessage(principal.getName(), inbound.getJobId(), request);
    }
}
