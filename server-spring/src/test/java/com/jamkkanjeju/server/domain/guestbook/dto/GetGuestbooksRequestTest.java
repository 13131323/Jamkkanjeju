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
        assertThat(new GetGuestbooksRequest(null, null, null, null, null, null)).isEqualTo(new GetGuestbooksRequest(0, 10, 0, 10, null, null));
    }

    @Test void 한쪽_조건만_지정해도_다른쪽은_기본값이다() {
        assertThat(new GetGuestbooksRequest(2, 3, null, null, null, null)).isEqualTo(new GetGuestbooksRequest(2, 3, 0, 10, null, null));
        assertThat(new GetGuestbooksRequest(null, null, 4, 5, null, null)).isEqualTo(new GetGuestbooksRequest(0, 10, 4, 5, null, null));
        assertThat(validator.validate(new GetGuestbooksRequest(0, 1, 0, 1, null, null))).isEmpty();
    }

    @ParameterizedTest @CsvSource({"-1,10,0,10", "0,0,0,10", "0,-1,0,10", "0,10,-1,10", "0,10,0,0", "0,10,0,-1"})
    void 음수페이지와_양수가아닌_크기는_거절한다(int generalPage, int generalSize, int roadPage, int roadSize) {
        assertThat(validator.validate(new GetGuestbooksRequest(generalPage, generalSize, roadPage, roadSize, null, null))).hasSize(1);
    }

    @Test void 필터기본값은_전체최신순이다() {
        GetGuestbooksRequest request = new GetGuestbooksRequest(null, null, null, null, null, null);
        assertThat(request.guestbookType()).isEqualTo("ALL");
        assertThat(request.sort()).isEqualTo("LATEST");
        assertThat(validator.validate(request)).isEmpty();
    }

    @ParameterizedTest @CsvSource({"ALL,LATEST", "GENERAL,POPULAR", "ROAD,MINE", "ALL,LIKED"})
    void 허용된필터조합은_검증을통과한다(String type, String sort) {
        assertThat(validator.validate(new GetGuestbooksRequest(0, 10, 0, 10, type, sort))).isEmpty();
    }

    @ParameterizedTest @CsvSource({"WRONG,LATEST", "all,LATEST", "'',LATEST", "ALL,NEW", "ALL,''"})
    void 잘못된필터값과_빈값은_거절한다(String type, String sort) {
        assertThat(validator.validate(new GetGuestbooksRequest(0, 10, 0, 10, type, sort))).hasSize(1);
    }

    @ParameterizedTest @CsvSource({"11,10", "10,11"})
    void 유형별크기는_10을넘길수없다(int general, int road) {
        assertThat(validator.validate(new GetGuestbooksRequest(0, general, 0, road, null, null))).hasSize(1);
    }
}
