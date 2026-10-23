package com.jamkkanjeju.server.domain.map.service;

/** 장소와 길바닥 방명록 조회에 공통으로 사용하는 위도·경도 사각 범위이다. */
public record MapViewport(double minLatitude, double maxLatitude, double minLongitude, double maxLongitude) {

    private static final double EXPANSION_RATIO = 0.2;

    /** 검증된 두 꼭짓점으로 사방에 원래 폭의 20%씩 추가하여 가로·세로 1.4배 범위를 만든다. */
    public static MapViewport expanded(double leftTopLatitude, double leftTopLongitude,
                                       double rightBottomLatitude, double rightBottomLongitude) {
        double latitudeMargin = (leftTopLatitude - rightBottomLatitude) * EXPANSION_RATIO;
        double longitudeMargin = (rightBottomLongitude - leftTopLongitude) * EXPANSION_RATIO;
        return new MapViewport(rightBottomLatitude - latitudeMargin, leftTopLatitude + latitudeMargin,
                leftTopLongitude - longitudeMargin, rightBottomLongitude + longitudeMargin);
    }
}
