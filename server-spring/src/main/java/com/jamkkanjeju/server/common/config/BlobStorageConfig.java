package com.jamkkanjeju.server.common.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** 공통 Blob 스토리지 설정값을 Spring 빈으로 등록한다. */
@Configuration
@EnableConfigurationProperties(BlobStorageProperties.class)
public class BlobStorageConfig {
}
