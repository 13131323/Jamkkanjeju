package com.jamkkanjeju.server.domain.cooperativemission.support;

import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.mission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import java.util.List;
import org.springframework.test.util.ReflectionTestUtils;

/** 상태 조회 테스트에서 사용하는 보상과 팀·역할 카드의 고정 데이터를 만든다. */
public final class CooperativeMissionStatusFixtures {
    private CooperativeMissionStatusFixtures() { }

    /** 미션에 보상 세 항목을 모두 설정한다. */
    public static CooperativeMission rewardedMission() {
        var result = CooperativeMission.builder().mission(mission(31L, MissionTypeCode.COOPERATIVE))
                .status(MissionActivationStatus.ACTIVE).point(200)
                .arCharacter(ArCharacter.builder().requiredFragmentCount(10).id(1L).name("감귤").imgUrl("character.png").build())
                .coupon(Coupon.builder().id(1L).couponPrice(5000).build()).build();
        ReflectionTestUtils.setField(result, "missionId", 31L);
        return result;
    }

    /** 지정 단계의 팀을 생성하고 테스트용 ID를 부여한다. */
    public static CooperativeMissionProgress statusProgress(Long id, CooperativeMission mission, int step) {
        var result = CooperativeMissionProgress.builder().cooperativeMission(mission).currentStep(step)
                .teamToken("status-" + id).build();
        ReflectionTestUtils.setField(result, "id", id);
        return result;
    }

    /** 역할 카드의 이름·설명·대상을 고정한다. */
    public static CooperativeRoleCard card(Long id) {
        return CooperativeRoleCard.builder().id(id).roleName("역할" + id).roleDescription("설명")
                .locationToFind(List.of("돌담")).build();
    }
}
