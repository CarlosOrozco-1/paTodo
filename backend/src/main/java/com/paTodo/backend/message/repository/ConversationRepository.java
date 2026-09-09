package com.paTodo.backend.message.repository;

import com.paTodo.backend.message.model.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    Optional<Conversation> findByJobId(String jobId);
    List<Conversation> findByParticipantIdsContaining(String userId);
}
