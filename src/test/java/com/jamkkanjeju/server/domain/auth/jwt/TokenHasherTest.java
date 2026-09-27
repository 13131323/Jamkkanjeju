package com.jamkkanjeju.server.domain.auth.jwt;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TokenHasherTest {

    private final TokenHasher tokenHasher = new TokenHasher();

    @Test
    void SHA_256_해시를_소문자_hex_64자로_반환한다() {
        // SHA-256("abc")의 표준 테스트 벡터
        assertThat(tokenHasher.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
                .matches("^[0-9a-f]{64}$");
    }

    @Test
    void 같은_입력은_같은_해시_다른_입력은_다른_해시를_만든다() {
        assertThat(tokenHasher.hash("token-a")).isEqualTo(tokenHasher.hash("token-a"));
        assertThat(tokenHasher.hash("token-a")).isNotEqualTo(tokenHasher.hash("token-b"));
    }
}
