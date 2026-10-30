package com.jamkkanjeju.server.domain.mypage.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** 인증 실패와 빈 조회의 생략 조건을 DB 없이 검증한다. */
@ExtendWith(MockitoExtension.class)
class MyPageServiceTest {
    @Mock UserRepository users;
    @Mock VisitedLocationRepository visits;
    @Mock CultureMissionProgressRepository cultureProgresses;
    @Mock CultureMissionQuizRepository quizzes;
    @Mock TreasureMissionProgressRepository treasureProgresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Spy MissionCompletionChecker completionChecker = new MissionCompletionChecker();
    @Mock ArCharacterRepository characters;
    @Mock AcquiredArCharacterRepository fragments;
    @Mock CultureMissionRepository culture;
    @Mock TreasureMissionRepository treasure;
    @Mock CooperativeMissionRepository cooperative;
    @Mock MissionRewardStatusRepository statuses;
    @InjectMocks MyPageService service;

    @Test void 사용자없으면_공통인증오류이며_후속조회를하지않는다() {
        assertThatThrownBy(() -> service.getMyPage(15L)).extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(visits, cultureProgresses, quizzes, treasureProgresses, participants,
                characters, fragments, culture, treasure, cooperative, statuses);
    }

    @Test void 빈도감은_후속후보조회를생략하고_사용자저장값을유지한다() {
        LocalDateTime checkedAt = LocalDateTime.of(2026, 10, 30, 12, 0);
        User user = User.builder().point(17).targetStep(12000).guestbookLastCheckedAt(checkedAt).build();
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(visits.countDistinctLocationsByUserId(15L)).thenReturn(2L);
        var response = service.getMyPage(15L);
        assertThat(response.profile().travelStyle()).isNull();
        assertThat(response.profile().characterImgUrl()).isNull();
        assertThat(response.dailyStep().targetStepCount()).isEqualTo(12000);
        assertThat(response.summary().point()).isEqualTo(17);
        assertThat(response.summary().visitedLocationCount()).isEqualTo(2);
        assertThat(response.arCharacters()).isEmpty();
        assertThat(response.progressMissions()).isEmpty();
        assertThat(user.getGuestbookLastCheckedAt()).isEqualTo(checkedAt);
        verifyNoInteractions(fragments, culture, treasure, cooperative, statuses, quizzes);
    }
}
