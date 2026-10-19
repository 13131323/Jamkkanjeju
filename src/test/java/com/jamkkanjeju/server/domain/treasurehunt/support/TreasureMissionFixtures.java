package com.jamkkanjeju.server.domain.treasurehunt.support;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import java.time.LocalDateTime;
import org.springframework.test.util.ReflectionTestUtils;

/** 보물찾기 단위 테스트의 고정 진행도와 아이템을 만든다. */
public final class TreasureMissionFixtures {
    public static final LocalDateTime COMPLETED_AT = LocalDateTime.of(2026, 10, 1, 12, 0);

    private TreasureMissionFixtures() {
    }

    /** ID를 가진 진행 중 기록을 만든다. */
    public static TreasureMissionProgress progress(User user, TreasureMission mission) {
        TreasureMissionProgress progress = TreasureMissionProgress.builder().user(user).treasureMission(mission).build();
        ReflectionTestUtils.setField(progress, "id", 72L);
        return progress;
    }

    /** 번호와 발견 여부가 지정된 고정 좌표 아이템을 만든다. */
    public static TreasureMissionProgressItem item(TreasureMissionProgress progress, int index, boolean found) {
        return TreasureMissionProgressItem.builder().treasureMissionProgress(progress).itemIndex(index)
                .latitude(33.3).longitude(126.3).itemStatus(found ? TreasureItemStatus.FOUND : TreasureItemStatus.UNFOUND)
                .foundAt(found ? COMPLETED_AT : null).build();
    }

    /** 테스트에서 독립적으로 사용하는 두 좌표 간 구면 거리(m)이다. */
    public static double distance(double lat, double lng, double targetLat, double targetLng) {
        double a = Math.pow(Math.sin(Math.toRadians(targetLat - lat) / 2), 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(targetLat))
                * Math.pow(Math.sin(Math.toRadians(targetLng - lng) / 2), 2);
        return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.clamp(a, 0.0, 1.0)));
    }
}
