package com.jamkkanjeju.server.domain.treasurehunt.service;

/** 새 보물 배치에 사용하는 도메인 공통 설정이다. 응답의 실제 개수와는 구분한다. */
public final class TreasureMissionConstants {

    public static final int TREASURE_ITEM_COUNT = 3;

    // TODO: 추후 확정된 보물 등장 반경으로 상수 값을 조정한다.
    public static final double TREASURE_APPEAR_RADIUS_METER = 100;

    private TreasureMissionConstants() {
    }
}
