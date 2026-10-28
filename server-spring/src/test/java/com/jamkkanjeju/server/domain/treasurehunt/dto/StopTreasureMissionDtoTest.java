package com.jamkkanjeju.server.domain.treasurehunt.dto;

import static org.assertj.core.api.Assertions.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.*;

import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import jakarta.validation.Validation;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 중단 좌표와 응답의 목록 복사·공개 필드·nullable 정보 변환을 검증한다. */
class StopTreasureMissionDtoTest {
    @Test
    void 좌표는_필수이고_허용경계를_포함한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new StopTreasureMissionLocationRequest(null, null))).hasSize(2);
            for (double[] value : List.of(new double[]{-90, -180}, new double[]{90, 180})) {
                assertThat(validator.validate(new StopTreasureMissionLocationRequest(value[0], value[1]))).isEmpty();
            }
            for (double[] value : List.of(new double[]{-90.01, 0}, new double[]{90.01, 0},
                    new double[]{0, -180.01}, new double[]{0, 180.01})) {
                assertThat(validator.validate(new StopTreasureMissionLocationRequest(value[0], value[1]))).hasSize(1);
            }
        }
    }

    @Test
    void 완료응답은_목록을_복사하고_보상필드를_노출하지_않는다() {
        var progress = progress(null, null);
        progress.complete(COMPLETED_AT);
        var indexes = new ArrayList<>(List.of(2, 4));
        var next = StopTreasureMissionResponse.NextLocation.of(location(8L, "다음", 10, 10), null, 42, null);
        var response = StopTreasureMissionResponse.of(progress, 5, indexes, next);
        indexes.clear();
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(response.treasureCount()).isEqualTo(5);
        assertThat(response.foundTreasureIndexes()).containsExactly(2, 4);
        assertThatThrownBy(() -> response.foundTreasureIndexes().add(9)).isInstanceOf(UnsupportedOperationException.class);
        var json = JsonMapper.builder().build().valueToTree(response);
        assertThat(json.has("reward")).isFalse();
        assertThat(json.get("nextLocation").isObject()).isTrue();
        assertThat(json.at("/nextLocation/locationImageUrl").isNull()).isTrue();
        assertThat(json.at("/nextLocation/mission").isNull()).isTrue();
    }

    @Test
    void 장소와_공통미션의_공개정보를_변환한다() {
        var next = StopTreasureMissionResponse.NextLocation.of(location(8L, "다음", 10, 10), "image.png", 42,
                StopTreasureMissionResponse.NextMission.from(mission(31L, MissionTypeCode.TREASURE)));
        assertThat(next.id()).isEqualTo(8L);
        assertThat(next.locationTitle()).isEqualTo("다음");
        assertThat(next.locationImageUrl()).isEqualTo("image.png");
        assertThat(next.distanceMeter()).isEqualTo(42);
        assertThat(next.mission()).isEqualTo(new StopTreasureMissionResponse.NextMission(31L, "TREASURE"));
    }
}
