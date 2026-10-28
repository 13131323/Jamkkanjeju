package com.jamkkanjeju.server.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** 엔티티의 생성·수정 시각을 자동으로 기록하는 JPA Auditing을 활성화하는 설정이다. */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
