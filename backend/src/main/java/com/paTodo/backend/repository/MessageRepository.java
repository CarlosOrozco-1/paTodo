package com.paTodo.backend.repository;

import com.paTodo.backend.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {
    Page<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);
    List<Message> findByJobIdOrderByCreatedAtAsc(String jobId);
    List<Message> findByConversationIdAndReadAtIsNullAndReceiverId(String conversationId, String receiverId);
}