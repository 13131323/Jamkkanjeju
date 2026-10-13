package com.jamkkanjeju.server.domain.auth.jwt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

/** 리프레시 토큰 원문을 DB 저장·조회용 해시로 변환한다. */
@Component
public class TokenHasher {

    /** 토큰 원문의 해시 값을 구한다. */
    public String hash(String rawToken) {
        // SHA-256 해시를 소문자 hex 64자로 만든다. (refresh_token.token_hash CHAR(64))
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", exception);
        }
    }
}
