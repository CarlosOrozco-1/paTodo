package com.paTodo.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document(collection = "conversations")
public class Conversation {

    @Id
    private String id;

    @Indexed(unique = true)
    private String jobId;

    private List<String> participantIds;

    private LastMessage lastMessage;

    private Map<String, Integer> unreadCount;

    private boolean isActive = true;

    private Instant createdAt;

    private Instant updatedAt;

    public Conversation() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public List<String> getParticipantIds() { return participantIds; }
    public void setParticipantIds(List<String> participantIds) { this.participantIds = participantIds; }

    public LastMessage getLastMessage() { return lastMessage; }
    public void setLastMessage(LastMessage lastMessage) { this.lastMessage = lastMessage; }

    public Map<String, Integer> getUnreadCount() { return unreadCount; }
    public void setUnreadCount(Map<String, Integer> unreadCount) { this.unreadCount = unreadCount; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public static class LastMessage {
        private String content;
        private String senderId;
        private String type;
        private Instant createdAt;

        public LastMessage() {}

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getSenderId() { return senderId; }
        public void setSenderId(String senderId) { this.senderId = senderId; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    }
}