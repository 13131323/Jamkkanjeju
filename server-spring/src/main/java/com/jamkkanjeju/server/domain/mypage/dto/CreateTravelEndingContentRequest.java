package com.jamkkanjeju.server.domain.mypage.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.mypage.exception.MyPageErrorCode;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** JSON 배열 문자열과 반복 사진 필드를 받는 엽서 생성 multipart 요청이다. */
public record CreateTravelEndingContentRequest(
        @Schema(description = "방문 장소 ID JSON 배열 문자열", example = "[1,2]") String visitedLocationIds,
        @Schema(description = "공통 미션 ID JSON 배열 문자열", example = "[1,32]") String missionIds,
        List<MultipartFile> photos,
        String travelNote
) {
    /** 여행 한 줄의 앞뒤 공백을 제거하고 공백 입력은 미입력으로 취급한다. */
    public CreateTravelEndingContentRequest {
        travelNote = travelNote == null || travelNote.isBlank() ? null : travelNote.strip();
    }

    /** 배열 개수와 정수 ID·중복·사진 개수를 확인하고 선택한 ID를 구성한다. */
    @JsonIgnore
    @Schema(hidden = true)
    public Selection selections(JsonMapper mapper) {
        JsonNode locations = array(visitedLocationIds, mapper);
        JsonNode missions = array(missionIds, mapper);
        if (locations.size() < 1 || missions.size() < 1) {
            throw new BusinessException(MyPageErrorCode.TRAVEL_ENDING_SELECTION_TOO_FEW);
        }
        if (locations.size() > 3 || missions.size() > 3) {
            throw new BusinessException(MyPageErrorCode.TRAVEL_ENDING_SELECTION_TOO_MANY);
        }
        if (photos == null || photos.isEmpty() || photos.size() > 3) {
            throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
        }
        return new Selection(ids(locations), ids(missions));
    }

    /** 필드 누락은 빈 목록이며 잘못된 JSON·배열 외 형식은 공통 요청 오류다. */
    private static JsonNode array(String value, JsonMapper mapper) {
        if (value == null) return mapper.createArrayNode();
        JsonNode node;
        try {
            node = mapper.readTree(value);
        } catch (RuntimeException exception) {
            throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
        }
        if (node == null || !node.isArray()) throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
        return node;
    }

    /** 문자열·소수·불리언 변환 없이 양의 long ID만 허용한다. */
    private static List<Long> ids(JsonNode array) {
        List<Long> ids = new ArrayList<>();
        for (JsonNode node : array) {
            if (!node.isIntegralNumber() || !node.canConvertToLong() || node.asLong() < 1) {
                throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
            }
            ids.add(node.asLong());
        }
        if (new HashSet<>(ids).size() != ids.size()) throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
        return List.copyOf(ids);
    }

    /** 검증된 ID 목록은 원래 요청의 순서를 유지한다. */
    public record Selection(List<Long> visitedLocationIds, List<Long> missionIds) { }
}
