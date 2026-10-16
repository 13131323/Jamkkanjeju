package com.jamkkanjeju.server.domain.treasurehunt.dto;

import static org.assertj.core.api.Assertions.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;

import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import jakarta.validation.Validation;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 요청 좌표 검증과 공개 응답·재시작 상태 변경을 검증한다. */
class StartTreasureMissionDtoTest {
    @Test
    void 좌표_필수와_범위를_검증하고_경계를_허용한다() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new StartTreasureMissionLocationRequest(null, null))).hasSize(2);
            for (double[] values : List.of(new double[]{-90, -180}, new double[]{90, 180}, new double[]{33.3, 126.3})) {
                assertThat(validator.validate(new StartTreasureMissionLocationRequest(values[0], values[1]))).isEmpty();
            }
            for (double[] values : List.of(new double[]{-90.01, 0}, new double[]{90.01, 0},
                    new double[]{0, -180.01}, new double[]{0, 180.01})) {
                assertThat(validator.validate(new StartTreasureMissionLocationRequest(values[0], values[1]))).hasSize(1);
            }
        }
    }

    @Test
    void 응답은_좌표와_발견여부를_복사하고_created를_JSON에서_숨긴다() {
        var progress = progress(null, null);
        var found = item(progress, 2, true);
        var items = new ArrayList<>(List.of(StartTreasureMissionResponse.TreasureItem.of(found,
                StartTreasureMissionResponse.TreasureItemLocation.of(found))));
        var response = StartTreasureMissionResponse.of(progress, null, 1, items, true);
        items.clear();
        assertThat(response.treasureItems()).hasSize(1);
        assertThat(response.treasureItems().getFirst().isFound()).isTrue();
        assertThat(response.treasureItems().getFirst().location().lat()).isEqualTo(33.3);
        var json = JsonMapper.builder().build().valueToTree(response);
        assertThat(json.has("created")).isFalse();
        assertThat(json.get("location").isNull()).isTrue();
        assertThat(json.get("missionProgressStatus").asString()).isEqualTo("IN_PROGRESS");
        assertThat(json.at("/treasureItems/0/isFound").asBoolean()).isTrue();
        assertThat(StartTreasureMissionResponse.TreasureItem.of(item(progress, 1, false), null).isFound()).isFalse();
    }

    @Test
    void 재시작은_ID를_유지하고_카운트와_완료시각을_초기화한다() {
        TreasureMissionProgress progress = progress(null, null);
        progress.increaseFoundItemCount();
        progress.complete(COMPLETED_AT);
        progress.restart();
        assertThat(progress.getId()).isEqualTo(72L);
        assertThat(progress.getMissionStatus().name()).isEqualTo("IN_PROGRESS");
        assertThat(progress.getFoundItemCount()).isZero();
        assertThat(progress.getCompletedAt()).isNull();
    }
}
