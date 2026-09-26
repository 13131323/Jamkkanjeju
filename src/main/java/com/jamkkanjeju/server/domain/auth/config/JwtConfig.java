package com.jamkkanjeju.server.domain.auth.config;

import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

    private static final int MINIMUM_KEY_SIZE_BYTES = 32;

    @Bean
    public SecretKey jwtSigningKey(JwtProperties properties) {
        byte[] keyBytes;

        try {
            keyBytes = Decoders.BASE64.decode(properties.secretKey());
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("app.jwt.secret-key는 유효한 Base64 문자열이어야 합니다.", exception);
        }

        if (keyBytes.length < MINIMUM_KEY_SIZE_BYTES) {
            throw new IllegalArgumentException("app.jwt.secret-key는 디코딩 기준 32바이트 이상이어야 합니다.");
        }

        return Keys.hmacShaKeyFor(keyBytes);
    }
}
