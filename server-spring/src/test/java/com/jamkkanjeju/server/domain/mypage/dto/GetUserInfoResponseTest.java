package com.jamkkanjeju.server.domain.mypage.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.onboarding.entity.*;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 현재 스키마의 선택 코드·프로필·빈 값을 전용 응답으로 변환하는지 검증한다. */
class GetUserInfoResponseTest {
    @Test void 여행유형과이미지_복수기대항목_단일선택값을반환한다() {
        User user=User.builder().nickname("여행자").targetStep(12345).onboardingResult(onboardingResult(2L,"사진가")).build();
        var response=GetUserInfoResponse.of(user,
                List.of(userExpectation(user,ExpectationType.PHOTO),userExpectation(user,ExpectationType.CAFE)),
                UserTransportation.builder().user(user).transportation(transportation(TransportationType.BUS)).build(),
                UserTravelStyle.builder().user(user).travelStyle(travelStyle(TravelStyleType.NEAR_AROUND)).build());
        assertThat(response.userType()).isEqualTo("사진가");
        assertThat(response.characterImgUrl()).isEqualTo("https://example.com/2.png");
        assertThat(response.nickname()).isEqualTo("여행자");
        assertThat(response.expectations()).containsExactly("PHOTO","CAFE");
        assertThat(response.transportation()).isEqualTo("BUS");
        assertThat(response.travelStyle()).isEqualTo("NEAR_AROUND");
        assertThat(response.targetStepCount()).isEqualTo(12345);
    }

    @Test void 결과와선택내역이없으면_null과빈배열이며_저장된목표를대체하지않는다() {
        var response=GetUserInfoResponse.of(User.builder().targetStep(0).build(),List.of(),null,null);
        assertThat(response.userType()).isNull();
        assertThat(response.characterImgUrl()).isNull();
        assertThat(response.nickname()).isNull();
        assertThat(response.expectations()).isEmpty();
        assertThat(response.transportation()).isNull();
        assertThat(response.travelStyle()).isNull();
        assertThat(response.targetStepCount()).isZero();
    }

    @Test void 온보딩결과가없어도_저장된선택항목은반환한다() {
        User user=User.builder().build();
        var response=GetUserInfoResponse.of(user,List.of(userExpectation(user,ExpectationType.LOCAL)),null,null);
        assertThat(response.userType()).isNull();
        assertThat(response.expectations()).containsExactly("LOCAL");
    }
}
