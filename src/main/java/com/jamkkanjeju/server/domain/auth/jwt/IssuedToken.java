package com.jamkkanjeju.server.domain.auth.jwt;

import java.time.Instant;

/** 발급된 토큰 원문과 발급·만료 시각 */
public record IssuedToken(String value, Instant issuedAt, Instant expiresAt) {
}
