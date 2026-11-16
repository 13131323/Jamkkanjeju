package com.jamkkanjeju.server.domain.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 에이전트 전용 API의 고정 비밀 토큰 설정이다. */
@ConfigurationProperties(prefix = "app.agent")
public record AgentApiProperties(String token) {

    /** 설정 객체 출력 시 토큰 원문을 숨긴다. */
    @Override
    public String toString() {
        return "AgentApiProperties[token=****]";
    }
}
