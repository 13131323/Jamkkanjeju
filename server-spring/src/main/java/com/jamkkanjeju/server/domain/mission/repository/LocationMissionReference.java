package com.jamkkanjeju.server.domain.mission.repository;

import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;

/** 장소별 미션 조회 결과의 공통 식별 정보. 엔티티나 미션 제목을 로딩하지 않는 인터페이스 프로젝션이다. */
public interface LocationMissionReference {

    /** 미션이 연결된 장소 ID이다. */
    Long getLocationId();

    /** 공통 MISSION ID이다. */
    Long getMissionId();

    /** 공통 미션 유형 코드이다. */
    MissionTypeCode getMissionType();
}
