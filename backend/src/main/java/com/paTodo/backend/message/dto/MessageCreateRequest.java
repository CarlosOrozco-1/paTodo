package com.paTodo.backend.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class MessageCreateRequest {

    @NotBlank
    private String jobId;

    @NotBlank
    private String conversationId;

    @NotBlank
    private String receiverId;

    @NotNull
    private String type = "text";

    @NotBlank
    @Size(max = 5000)
    private String content;

    private String replyTo;

    public MessageCreateRequest() {}

    public MessageCreateRequest(String jobId, String conversationId, String receiverId, String type, String content, String replyTo) {
        this.jobId = jobId;
        this.conversationId = conversationId;
        this.receiverId = receiverId;
        this.type = type;
        this.content = content;
        this.replyTo = replyTo;
    }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getReceiverId() { return receiverId; }
    public void setReceiverId(String receiverId) { this.receiverId = receiverId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getReplyTo() { return replyTo; }
    public void setReplyTo(String replyTo) { this.replyTo = replyTo; }
}
