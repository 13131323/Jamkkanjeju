package com.jamkkanjeju.server.domain.auth.jwt;

import java.time.Instant;

/** 발급한 토큰과 그 발급·만료 시각을 함께 전달하는 값이다. */
public record IssuedToken(String value, Instant issuedAt, Instant expiresAt) {
}
