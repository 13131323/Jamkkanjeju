package com.jamkkanjeju.server.domain.onboarding.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.DEFAULT_USER_TYPE;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.defaultResult;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.expectations;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.onboardingResult;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.transportation;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.travelStyle;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.userExpectation;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingRequest;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingResponse;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserTransportation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserTravelStyle;
import com.jamkkanjeju.server.domain.onboarding.repository.ExpectationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.OnboardingResultRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.TransportationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.TravelStyleRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserExpectationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserTransportationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserTravelStyleRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OnboardingServiceTest {

    private static final Long USER_ID = 15L;
    private static final List<ExpectationType> EXPECTATION_TYPES = List.of(ExpectationType.PHOTO, ExpectationType.CAFE);
    private static final CompleteOnboardingRequest COMPLETE_REQUEST = new CompleteOnboardingRequest(
            EXPECTATION_TYPES, TransportationType.WALK, TravelStyleType.NEAR_DESTINATION);
    private static final CompleteOnboardingRequest SKIP_REQUEST = new CompleteOnboardingRequest(null, null, null);

    @Mock
    private UserRepository userRepository;
    @Mock
    private ExpectationRepository expectationRepository;
    @Mock
    private TransportationRepository transportationRepository;
    @Mock
    private TravelStyleRepository travelStyleRepository;
    @Mock
    private UserExpectationRepository userExpectationRepository;
    @Mock
    private UserTransportationRepository userTransportationRepository;
    @Mock
    private UserTravelStyleRepository userTravelStyleRepository;
    @Mock
    private OnboardingResultRepository onboardingResultRepository;

    @Captor
    private ArgumentCaptor<List<UserExpectation>> userExpectationsCaptor;

    private OnboardingService onboardingService;
    private User user;

    @BeforeEach
    void setUp() {
        onboardingService = new OnboardingService(userRepository, expectationRepository, transportationRepository,
                travelStyleRepository, userExpectationRepository, userTransportationRepository,
                userTravelStyleRepository, onboardingResultRepository);
        user = activeUser(USER_ID);
    }

    @Test
    void 인증된_사용자_ID의_사용자가_없으면_UNAUTHORIZED() {
        given(userRepository.findById(USER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);

        verifyNoInteractions(expectationRepository, userExpectationRepository, userTransportationRepository,
                userTravelStyleRepository, onboardingResultRepository);
    }

    @Test
    void 최초_일반_완료면_기대_항목과_이동_수단과_여행_방식을_새로_저장한다() {
        givenUser();
        givenReferenceData(COMPLETE_REQUEST);
        given(userExpectationRepository.findAllByUserId(USER_ID)).willReturn(List.of());
        given(userTransportationRepository.findById(USER_ID)).willReturn(Optional.empty());
        given(userTravelStyleRepository.findById(USER_ID)).willReturn(Optional.empty());
        givenRandomCandidate(onboardingResult(1L, "제주 사진작가"));

        onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST);

        verify(userExpectationRepository).deleteAll(userExpectationsCaptor.capture());
        assertThat(userExpectationsCaptor.getValue()).isEmpty();
        verify(userExpectationRepository).saveAll(userExpectationsCaptor.capture());
        assertThat(userExpectationsCaptor.getValue())
                .extracting(saved -> saved.getExpectation().getExpectationType())
                .containsExactlyInAnyOrderElementsOf(EXPECTATION_TYPES);
        assertThat(userExpectationsCaptor.getValue()).allSatisfy(saved -> assertThat(saved.getUser()).isSameAs(user));

        ArgumentCaptor<UserTransportation> transportationCaptor = ArgumentCaptor.forClass(UserTransportation.class);
        verify(userTransportationRepository).save(transportationCaptor.capture());
        assertThat(transportationCaptor.getValue().getUser()).isSameAs(user);
        assertThat(transportationCaptor.getValue().getTransportation().getTransportationType())
                .isEqualTo(TransportationType.WALK);

        ArgumentCaptor<UserTravelStyle> travelStyleCaptor = ArgumentCaptor.forClass(UserTravelStyle.class);
        verify(userTravelStyleRepository).save(travelStyleCaptor.capture());
        assertThat(travelStyleCaptor.getValue().getUser()).isSameAs(user);
        assertThat(travelStyleCaptor.getValue().getTravelStyle().getTravelStyleType())
                .isEqualTo(TravelStyleType.NEAR_DESTINATION);
    }

    @Test
    void 일반_재요청이면_제거된_기대_항목은_삭제하고_새_항목만_추가하며_이동_수단과_여행_방식을_변경한다() {
        UserExpectation removed = userExpectation(user, ExpectationType.LOCAL);
        UserExpectation kept = userExpectation(user, ExpectationType.PHOTO);
        UserTransportation savedTransportation = UserTransportation.builder()
                .user(user).transportation(transportation(TransportationType.CAR)).build();
        UserTravelStyle savedTravelStyle = UserTravelStyle.builder()
                .user(user).travelStyle(travelStyle(TravelStyleType.RIGHT_HERE)).build();
        givenUser();
        givenReferenceData(COMPLETE_REQUEST);
        given(userExpectationRepository.findAllByUserId(USER_ID)).willReturn(List.of(removed, kept));
        given(userTransportationRepository.findById(USER_ID)).willReturn(Optional.of(savedTransportation));
        given(userTravelStyleRepository.findById(USER_ID)).willReturn(Optional.of(savedTravelStyle));
        givenRandomCandidate(onboardingResult(1L, "제주 사진작가"));

        onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST);

        verify(userExpectationRepository).deleteAll(userExpectationsCaptor.capture());
        assertThat(userExpectationsCaptor.getValue()).containsExactly(removed);
        verify(userExpectationRepository).saveAll(userExpectationsCaptor.capture());
        assertThat(userExpectationsCaptor.getValue())
                .extracting(saved -> saved.getExpectation().getExpectationType())
                .containsExactly(ExpectationType.CAFE);

        assertThat(savedTransportation.getTransportation().getTransportationType()).isEqualTo(TransportationType.WALK);
        assertThat(savedTravelStyle.getTravelStyle().getTravelStyleType()).isEqualTo(TravelStyleType.NEAR_DESTINATION);
        verify(userTransportationRepository, never()).save(any());
        verify(userTravelStyleRepository, never()).save(any());
    }

    @Test
    void 동일한_일반_요청을_다시_처리하면_기대_항목을_삭제하거나_중복_저장하지_않는다() {
        givenUser();
        givenReferenceData(COMPLETE_REQUEST);
        given(userExpectationRepository.findAllByUserId(USER_ID)).willReturn(List.of(
                userExpectation(user, ExpectationType.PHOTO), userExpectation(user, ExpectationType.CAFE)));
        given(userTransportationRepository.findById(USER_ID)).willReturn(Optional.of(UserTransportation.builder()
                .user(user).transportation(transportation(TransportationType.WALK)).build()));
        given(userTravelStyleRepository.findById(USER_ID)).willReturn(Optional.of(UserTravelStyle.builder()
                .user(user).travelStyle(travelStyle(TravelStyleType.NEAR_DESTINATION)).build()));
        givenRandomCandidate(onboardingResult(1L, "제주 사진작가"));

        onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST);

        verify(userExpectationRepository).deleteAll(userExpectationsCaptor.capture());
        assertThat(userExpectationsCaptor.getValue()).isEmpty();
        verify(userExpectationRepository).saveAll(userExpectationsCaptor.capture());
        assertThat(userExpectationsCaptor.getValue()).isEmpty();
    }

    @Test
    void 기대_항목_기준_데이터가_없으면_선택값을_변경하지_않고_실패한다() {
        givenUser();
        given(expectationRepository.findAllByExpectationTypeIn(EXPECTATION_TYPES))
                .willReturn(expectations(List.of(ExpectationType.PHOTO)));

        assertThatThrownBy(() -> onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST))
                .isInstanceOf(IllegalStateException.class);

        verifyNoSelectionChanged();
    }

    @Test
    void 이동_수단_기준_데이터가_없으면_선택값을_변경하지_않고_실패한다() {
        givenUser();
        given(expectationRepository.findAllByExpectationTypeIn(EXPECTATION_TYPES))
                .willReturn(expectations(EXPECTATION_TYPES));
        given(transportationRepository.findByTransportationType(TransportationType.WALK)).willReturn(Optional.empty());

        assertThatThrownBy(() -> onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST))
                .isInstanceOf(IllegalStateException.class);

        verifyNoSelectionChanged();
    }

    @Test
    void 여행_방식_기준_데이터가_없으면_선택값을_변경하지_않고_실패한다() {
        givenUser();
        given(expectationRepository.findAllByExpectationTypeIn(EXPECTATION_TYPES))
                .willReturn(expectations(EXPECTATION_TYPES));
        given(transportationRepository.findByTransportationType(TransportationType.WALK))
                .willReturn(Optional.of(transportation(TransportationType.WALK)));
        given(travelStyleRepository.findByTravelStyleType(TravelStyleType.NEAR_DESTINATION))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST))
                .isInstanceOf(IllegalStateException.class);

        verifyNoSelectionChanged();
    }

    @Test
    void 일반_완료면_여행자를_제외한_후보_중_하나를_배정한다() {
        OnboardingResult candidate = onboardingResult(3L, "자연 애호가");
        givenCompleteFlow();
        givenRandomCandidate(candidate);

        onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST);

        verify(onboardingResultRepository).findAllByUserTypeNot(DEFAULT_USER_TYPE);
        assertThat(user.getOnboardingResult()).isSameAs(candidate);
    }

    @Test
    void 배정_가능한_일반_결과가_없으면_실패한다() {
        givenCompleteFlow();
        given(onboardingResultRepository.findAllByUserTypeNot(DEFAULT_USER_TYPE)).willReturn(List.of());

        assertThatThrownBy(() -> onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST))
                .isInstanceOf(IllegalStateException.class);

        assertThat(user.getOnboardingResult()).isNull();
    }

    @Test
    void 나중에_할게요면_기존_선택값을_모두_삭제하고_여행자_결과를_배정한다() {
        List<UserExpectation> saved = List.of(
                userExpectation(user, ExpectationType.PHOTO), userExpectation(user, ExpectationType.LOCAL));
        OnboardingResult defaultResult = defaultResult();
        user.assignOnboardingResult(onboardingResult(1L, "제주 사진작가"));
        givenUser();
        given(userExpectationRepository.findAllByUserId(USER_ID)).willReturn(saved);
        given(onboardingResultRepository.findFirstByUserTypeOrderByIdAsc(DEFAULT_USER_TYPE))
                .willReturn(Optional.of(defaultResult));

        CompleteOnboardingResponse response = onboardingService.completeOnboarding(USER_ID, SKIP_REQUEST);

        verify(userExpectationRepository).deleteAll(saved);
        verify(userTransportationRepository).deleteById(USER_ID);
        verify(userTravelStyleRepository).deleteById(USER_ID);
        verifyNoInteractions(expectationRepository, transportationRepository, travelStyleRepository);
        verify(onboardingResultRepository, never()).findAllByUserTypeNot(any());
        assertThat(user.getOnboardingResult()).isSameAs(defaultResult);
        assertThat(response.user().onboardingCompleted()).isTrue();
        assertThat(response.user().onboardingResult().userType()).isEqualTo(DEFAULT_USER_TYPE);
    }

    @Test
    void 여행자_기본_결과가_없으면_실패한다() {
        givenUser();
        given(userExpectationRepository.findAllByUserId(USER_ID)).willReturn(List.of());
        given(onboardingResultRepository.findFirstByUserTypeOrderByIdAsc(DEFAULT_USER_TYPE))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> onboardingService.completeOnboarding(USER_ID, SKIP_REQUEST))
                .isInstanceOf(IllegalStateException.class);

        assertThat(user.getOnboardingResult()).isNull();
    }

    @Test
    void 응답은_사용자_ID와_완료_여부와_최종_배정된_온보딩_결과로_구성한다() {
        OnboardingResult candidate = onboardingResult(1L, "제주 사진작가");
        givenCompleteFlow();
        givenRandomCandidate(candidate);

        CompleteOnboardingResponse response = onboardingService.completeOnboarding(USER_ID, COMPLETE_REQUEST);

        assertThat(response.user().id()).isEqualTo(USER_ID);
        assertThat(response.user().onboardingCompleted()).isTrue();
        CompleteOnboardingResponse.OnboardingResultInfo result = response.user().onboardingResult();
        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.userType()).isEqualTo("제주 사진작가");
        assertThat(result.typeDescription()).isEqualTo(candidate.getTypeDescription());
        assertThat(result.hashtags()).containsExactlyElementsOf(candidate.getHashtags());
        assertThat(result.profileImageUrl()).isEqualTo(candidate.getProfileImgUrl());
    }

    private void givenUser() {
        given(userRepository.findById(USER_ID)).willReturn(Optional.of(user));
    }

    private void givenReferenceData(CompleteOnboardingRequest request) {
        given(expectationRepository.findAllByExpectationTypeIn(request.expectations()))
                .willReturn(expectations(request.expectations()));
        given(transportationRepository.findByTransportationType(request.transportation()))
                .willReturn(Optional.of(transportation(request.transportation())));
        given(travelStyleRepository.findByTravelStyleType(request.travelStyle()))
                .willReturn(Optional.of(travelStyle(request.travelStyle())));
    }

    /** 기존 선택값이 없는 사용자의 일반 완료 흐름 (결과 배정 직전까지) */
    private void givenCompleteFlow() {
        givenUser();
        givenReferenceData(COMPLETE_REQUEST);
        given(userExpectationRepository.findAllByUserId(USER_ID)).willReturn(List.of());
        given(userTransportationRepository.findById(USER_ID)).willReturn(Optional.empty());
        given(userTravelStyleRepository.findById(USER_ID)).willReturn(Optional.empty());
    }

    /** 무작위 배정 결과를 고정하기 위해 후보를 하나만 반환한다. */
    private void givenRandomCandidate(OnboardingResult candidate) {
        given(onboardingResultRepository.findAllByUserTypeNot(DEFAULT_USER_TYPE)).willReturn(List.of(candidate));
    }

    private void verifyNoSelectionChanged() {
        verifyNoInteractions(userExpectationRepository, userTransportationRepository, userTravelStyleRepository,
                onboardingResultRepository);
        assertThat(user.getOnboardingResult()).isNull();
    }
}
