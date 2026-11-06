package com.jamkkanjeju.server.domain.mypage.dto;

import static org.assertj.core.api.Assertions.*;

import com.jamkkanjeju.server.common.exception.BusinessException;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

/** multipart 문자열 필드의 선택 개수·엄격한 ID·사진 개수 검증이다. */
class CreateTravelEndingContentRequestTest {
    private final JsonMapper mapper = JsonMapper.builder().build();

    @ParameterizedTest
    @ValueSource(strings = {"[1]", "[3,2,1]"})
    void 경계개수와요청순서를유지한다(String ids) {
        var request = request(ids, ids, 3);
        var selected = request.selections(mapper);
        assertThat(selected.visitedLocationIds()).isEqualTo(selected.missionIds());
        assertThat(selected.visitedLocationIds().getFirst()).isEqualTo(ids.equals("[1]") ? 1L : 3L);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"[]|[1]|TRAVEL_ENDING_SELECTION_TOO_FEW",
            "[1]|[]|TRAVEL_ENDING_SELECTION_TOO_FEW", "[1,2,3,4]|[1]|TRAVEL_ENDING_SELECTION_TOO_MANY",
            "[1]|[1,2,3,4]|TRAVEL_ENDING_SELECTION_TOO_MANY", "[]|[1,2,3,4]|TRAVEL_ENDING_SELECTION_TOO_FEW"})
    void 최소와최대오류를구분하고_최소미달을우선한다(String places, String missions, String code) {
        assertCode(request(places, missions, 1), code);
    }

    @Test
    void 누락필드는최소미달이고_여행한줄은정규화한다() {
        assertCode(request(null, "[1]", 1), "TRAVEL_ENDING_SELECTION_TOO_FEW");
        assertThat(new CreateTravelEndingContentRequest("[1]", "[1]", null, " 내용 ").travelNote()).isEqualTo("내용");
        assertThat(new CreateTravelEndingContentRequest("[1]", "[1]", null, " ").travelNote()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"broken", "null", "{}", "[0]", "[-1]", "[1,1]", "[\"1\"]", "[true]", "[null]", "[1.0]", "[9223372036854775808]"})
    void 잘못된배열과ID는양쪽필드에서공통오류다(String ids) {
        assertCode(request(ids, "[1]", 1), "INVALID_REQUEST");
        assertCode(request("[1]", ids, 1), "INVALID_REQUEST");
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 4})
    void 사진개수위반은공통오류다(int count) {
        assertCode(request("[1]", "[1]", count), "INVALID_REQUEST");
    }

    private CreateTravelEndingContentRequest request(String places, String missions, int count) {
        return new CreateTravelEndingContentRequest(places, missions,
                Collections.nCopies(count, new MockMultipartFile("photos", new byte[]{1})), null);
    }

    private void assertCode(CreateTravelEndingContentRequest request, String code) {
        assertThatThrownBy(() -> request.selections(mapper)).isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode().code()).isEqualTo(code));
    }
}
