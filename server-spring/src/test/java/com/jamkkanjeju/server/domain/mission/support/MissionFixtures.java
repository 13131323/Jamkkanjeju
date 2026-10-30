package com.jamkkanjeju.server.domain.mission.support;

import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionStep;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import java.util.List;

/** 미션 홈 단위 테스트에서 사용하는 고정 미션·보상 도우미이다. */
public final class MissionFixtures {

    private MissionFixtures() {
    }

    /** 정렬되지 않은 안내 단계를 가진 공통 미션을 만든다. */
    public static Mission mission(MissionTypeCode code) {
        return Mission.builder().id(31L).missionType(MissionType.builder().type(code)
                .title("미션 제목").description("미션 설명")
                .steps(List.of(new MissionStep(2, "두 번째", "설명2"), new MissionStep(1, "첫 번째", "설명1")))
                .build()).build();
    }

    /** 공개 보상 정보가 채워진 캐릭터를 만든다. */
    public static ArCharacter character() {
        return ArCharacter.builder().requiredFragmentCount(10).id(9L).name("돌담이").imgUrl("https://example.com/character.png").build();
    }

    /** 장소 유무를 선택할 수 있는 보상 쿠폰을 만든다. */
    public static Coupon coupon(boolean withLocation) {
        return Coupon.builder().id(10L).couponPrice(3000)
                .location(withLocation ? Location.builder().title("쿠폰 사용처").build() : null).build();
    }
}
