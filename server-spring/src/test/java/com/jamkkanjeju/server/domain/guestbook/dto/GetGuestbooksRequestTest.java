package com.jamkkanjeju.server.domain.guestbook.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** 두 유형의 페이지 기본값과 입력 경계를 Spring·DB 없이 검증한다. */
class GetGuestbooksRequestTest {
    static ValidatorFactory factory;
    static Validator validator;
    @BeforeAll static void setup() { factory = Validation.buildDefaultValidatorFactory(); validator = factory.getValidator(); }
    @AfterAll static void close() { factory.close(); }

    @Test void 생략한_두페이지는_각각_0과10이다() {
        assertThat(new GetGuestbooksRequest(null, null, null, null)).isEqualTo(new GetGuestbooksRequest(0, 10, 0, 10));
    }

    @Test void 한쪽_조건만_지정해도_다른쪽은_기본값이다() {
        assertThat(new GetGuestbooksRequest(2, 3, null, null)).isEqualTo(new GetGuestbooksRequest(2, 3, 0, 10));
        assertThat(new GetGuestbooksRequest(null, null, 4, 5)).isEqualTo(new GetGuestbooksRequest(0, 10, 4, 5));
        assertThat(validator.validate(new GetGuestbooksRequest(0, 1, 0, 1))).isEmpty();
    }

    @ParameterizedTest @CsvSource({"-1,10,0,10", "0,0,0,10", "0,-1,0,10", "0,10,-1,10", "0,10,0,0", "0,10,0,-1"})
    void 음수페이지와_양수가아닌_크기는_거절한다(int generalPage, int generalSize, int roadPage, int roadSize) {
        assertThat(validator.validate(new GetGuestbooksRequest(generalPage, generalSize, roadPage, roadSize))).hasSize(1);
    }
}
