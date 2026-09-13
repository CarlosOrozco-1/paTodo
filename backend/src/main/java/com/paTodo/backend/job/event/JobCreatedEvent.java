package com.paTodo.backend.job.event;

import java.time.Instant;

public record JobCreatedEvent(String jobId, String clientId, String categoryId, Instant createdAt) {}