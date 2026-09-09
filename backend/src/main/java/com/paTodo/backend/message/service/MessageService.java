package com.paTodo.backend.message.service;

import com.paTodo.backend.common.exception.BadRequestException;
import com.paTodo.backend.common.exception.ResourceNotFoundException;
import com.paTodo.backend.message.dto.MessageCreateRequest;
import com.paTodo.backend.message.dto.MessageResponse;
import com.paTodo.backend.message.model.Conversation;
import com.paTodo.backend.message.model.Message;
import com.paTodo.backend.message.repository.ConversationRepository;
import com.paTodo.backend.message.repository.MessageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public MessageService(MessageRepository messageRepository,
                          ConversationRepository conversationRepository,
                          SimpMessagingTemplate messagingTemplate) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    public MessageResponse sendMessage(String senderId, String jobId, MessageCreateRequest request) {
        Conversation conversation;
        if (request.getConversationId() != null && !request.getConversationId().isBlank()) {
            conversation = conversationRepository.findById(request.getConversationId())
                    .orElseThrow(() -> new ResourceNotFoundException("Conversación no encontrada con id: " + request.getConversationId()));
            if (!jobId.equals(conversation.getJobId())) {
                throw new BadRequestException("La conversación no pertenece a este trabajo");
            }
        } else {
            conversation = conversationRepository.findByJobId(jobId)
                    .orElseGet(() -> createConversation(jobId, senderId, request.getReceiverId()));
        }

        if (!conversation.getParticipantIds().contains(senderId)) {
            throw new AccessDeniedException("No participas en esta conversación");
        }
        if (!conversation.getParticipantIds().contains(request.getReceiverId())) {
            throw new AccessDeniedException("El receptor no participa en esta conversación");
        }

        Message message = new Message();
        message.setJobId(jobId);
        message.setConversationId(conversation.getId());
        message.setSenderId(senderId);
        message.setReceiverId(request.getReceiverId());
        message.setType(request.getType() != null ? request.getType() : "text");
        message.setContent(request.getContent());
        message.setReplyTo(request.getReplyTo());
        message.setDeliveredAt(Instant.now());
        message.setCreatedAt(Instant.now());
        message.setUpdatedAt(Instant.now());

        Message saved = messageRepository.save(message);
        updateConversation(conversation, saved);

        MessageResponse response = mapToResponse(saved);
        messagingTemplate.convertAndSend("/topic/chat." + jobId, response);
        return response;
    }

    public List<MessageResponse> getMessagesByJob(String jobId, String userId) {
        Conversation conversation = conversationRepository.findByJobId(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversación no encontrada para el trabajo: " + jobId));
        if (!conversation.getParticipantIds().contains(userId)) {
            throw new AccessDeniedException("No participas en esta conversación");
        }
        return messageRepository.findByJobIdOrderByCreatedAtAsc(jobId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public Page<MessageResponse> getConversationHistory(String conversationId, String userId, Pageable pageable) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversación no encontrada con id: " + conversationId));
        if (!conversation.getParticipantIds().contains(userId)) {
            throw new AccessDeniedException("No participas en esta conversación");
        }
        return messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable)
                .map(this::mapToResponse);
    }

    public int markConversationAsRead(String conversationId, String userId) {
        List<Message> unread = messageRepository
                .findByConversationIdAndReadAtIsNullAndReceiverId(conversationId, userId);
        Instant now = Instant.now();
        unread.forEach(m -> {
            m.setReadAt(now);
            m.setUpdatedAt(now);
        });
        messageRepository.saveAll(unread);
        return unread.size();
    }

    private Conversation createConversation(String jobId, String senderId, String receiverId) {
        Conversation conversation = new Conversation();
        conversation.setJobId(jobId);
        conversation.setParticipantIds(List.of(senderId, receiverId));
        Map<String, Integer> unreadCount = new HashMap<>();
        unreadCount.put(senderId, 0);
        unreadCount.put(receiverId, 0);
        conversation.setUnreadCount(unreadCount);
        conversation.setActive(true);
        conversation.setCreatedAt(Instant.now());
        conversation.setUpdatedAt(Instant.now());
        return conversationRepository.save(conversation);
    }

    private void updateConversation(Conversation conversation, Message message) {
        Conversation.LastMessage lastMessage = new Conversation.LastMessage();
        lastMessage.setContent(message.getContent());
        lastMessage.setSenderId(message.getSenderId());
        lastMessage.setType(message.getType());
        lastMessage.setCreatedAt(message.getCreatedAt());
        conversation.setLastMessage(lastMessage);

        Map<String, Integer> unreadCount = conversation.getUnreadCount() != null
                ? new HashMap<>(conversation.getUnreadCount())
                : new HashMap<>();
        conversation.getParticipantIds().forEach(participant -> {
            if (!participant.equals(message.getSenderId())) {
                unreadCount.put(participant, unreadCount.getOrDefault(participant, 0) + 1);
            }
        });
        conversation.setUnreadCount(unreadCount);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
    }

    private MessageResponse mapToResponse(Message message) {
        MessageResponse response = new MessageResponse();
        response.setId(message.getId());
        response.setJobId(message.getJobId());
        response.setConversationId(message.getConversationId());
        response.setSenderId(message.getSenderId());
        response.setReceiverId(message.getReceiverId());
        response.setType(message.getType());
        response.setContent(message.getContent());
        response.setMetadata(message.getMetadata());
        response.setReplyTo(message.getReplyTo());
        response.setReadAt(message.getReadAt());
        response.setDeliveredAt(message.getDeliveredAt());
        response.setCreatedAt(message.getCreatedAt());
        return response;
    }
}
