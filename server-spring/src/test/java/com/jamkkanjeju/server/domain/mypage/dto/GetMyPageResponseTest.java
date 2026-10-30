package com.jamkkanjeju.server.domain.mypage.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse.*;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 온보딩 프로필 변환과 목록 방어 복사를 검증한다. */
class GetMyPageResponseTest {
    @Test void 프로필은_대표AR선택이아닌_온보딩이미지와유형을사용한다() {
        User user = User.builder().nickname("여행자").onboardingResult(OnboardingResult.builder()
                .userType("사진가").profileImgUrl("profile.png").hashtags(List.of("사진")).build()).build();
        ProfileInfo profile = ProfileInfo.from(user);
        assertThat(profile.nickname()).isEqualTo("여행자");
        assertThat(profile.characterImgUrl()).isEqualTo("profile.png");
        assertThat(profile.travelStyle().userType()).isEqualTo("사진가");
        assertThat(profile.travelStyle().hashtags()).containsExactly("사진");
    }

    @Test void 전달한목록을변경해도_생성한응답은유지한다() {
        List<ProgressMissionInfo> progresses = new ArrayList<>(List.of(new ProgressMissionInfo(1L, "CULTURE", "문화", 1, 3)));
        List<ArCharacterInfo> characters = new ArrayList<>();
        var response = GetMyPageResponse.of(User.builder().build(), SummaryInfo.of(0, 0, 0), progresses, characters);
        progresses.clear();
        assertThat(response.progressMissions()).hasSize(1);
        assertThat(response.arCharacters()).isEmpty();
    }
}
