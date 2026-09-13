package com.paTodo.backend.common.event;

public interface EventPublisher {
    void publish(Object event);
}