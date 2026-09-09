package com.paTodo.backend.common.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.SystemEnvironmentPropertySource;

import java.util.LinkedHashMap;
import java.util.Map;

@Order(Ordered.LOWEST_PRECEDENCE)
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "dotenv";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Dotenv dotenv = Dotenv.configure()
                .ignoreIfMissing()
                .ignoreIfMalformed()
                .load();

        Map<String, Object> properties = new LinkedHashMap<>();
        dotenv.entries().forEach(entry -> {
            if (environment.getProperty(entry.getKey()) == null) {
                properties.put(entry.getKey(), entry.getValue());
            }
        });

        if (!properties.isEmpty()) {
            MutablePropertySources sources = environment.getPropertySources();
            sources.addFirst(new SystemEnvironmentPropertySource(PROPERTY_SOURCE_NAME, properties));
        }
    }
}
