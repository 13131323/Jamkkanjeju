package com.jamkkanjeju.server.domain.onboarding.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingRequest;
import com.jamkkanjeju.server.domain.onboarding.dto.CompleteOnboardingResponse;
import com.jamkkanjeju.server.domain.onboarding.entity.Expectation;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.onboarding.entity.Transportation;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyle;
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
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자의 온보딩 선택값을 저장하고 온보딩 결과를 배정한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OnboardingService {

    /** "나중에 할게요" 요청에 배정하는 기본 온보딩 결과의 userType */
    static final String DEFAULT_USER_TYPE = "여행자";

    private final UserRepository userRepository;
    private final ExpectationRepository expectationRepository;
    private final TransportationRepository transportationRepository;
    private final TravelStyleRepository travelStyleRepository;
    private final UserExpectationRepository userExpectationRepository;
    private final UserTransportationRepository userTransportationRepository;
    private final UserTravelStyleRepository userTravelStyleRepository;
    private final OnboardingResultRepository onboardingResultRepository;

    /** 사용자의 온보딩을 완료하고 배정된 온보딩 결과를 반환한다. */
    @Transactional
    public CompleteOnboardingResponse completeOnboarding(Long userId, CompleteOnboardingRequest request) {
        // 처리 순서는 BUISNESS_RULE.md를 따르며, 1. 입력값 검증은 CompleteOnboardingRequest에서 이미 끝난 상태이다.
        // 2. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 3. 온보딩 선택값 변경 + 4. 온보딩 결과 배정
        if (request.isSkipped()) {
            clearSelections(userId);
            user.assignOnboardingResult(findDefaultResult());
        } else {
            replaceSelections(user, request);
            user.assignOnboardingResult(pickRandomResult());
        }

        // 5. 응답 데이터 구성
        return CompleteOnboardingResponse.from(user);
    }

    /** 사용자의 온보딩 선택값을 요청한 값으로 교체한다. */
    private void replaceSelections(User user, CompleteOnboardingRequest request) {
        // 기준 데이터가 모두 존재하는지 먼저 확인한 뒤 변경한다.
        List<Expectation> expectations = expectationRepository.findAllByExpectationTypeIn(request.expectations());
        if (expectations.size() != request.expectations().size()) {
            throw new IllegalStateException("여행 기대 항목 기준 데이터가 없습니다: " + request.expectations());
        }
        Transportation transportation = transportationRepository.findByTransportationType(request.transportation())
                .orElseThrow(() -> new IllegalStateException("이동 수단 기준 데이터가 없습니다: " + request.transportation()));
        TravelStyle travelStyle = travelStyleRepository.findByTravelStyleType(request.travelStyle())
                .orElseThrow(() -> new IllegalStateException("여행 방식 기준 데이터가 없습니다: " + request.travelStyle()));

        replaceExpectations(user, expectations);

        userTransportationRepository.findById(user.getId()).ifPresentOrElse(
                saved -> saved.changeTransportation(transportation),
                () -> userTransportationRepository.save(
                        UserTransportation.builder().user(user).transportation(transportation).build()));

        userTravelStyleRepository.findById(user.getId()).ifPresentOrElse(
                saved -> saved.changeTravelStyle(travelStyle),
                () -> userTravelStyleRepository.save(
                        UserTravelStyle.builder().user(user).travelStyle(travelStyle).build()));
    }

    /** 사용자의 여행 기대 항목 선택 내역을 요청한 항목으로 교체한다. */
    private void replaceExpectations(User user, List<Expectation> expectations) {
        // 같은 PK를 삭제 후 다시 넣으면 Hibernate가 INSERT를 DELETE보다 먼저 실행해 충돌하므로,
        // 기존 항목 중 요청에 없는 것만 삭제하고 새로 생긴 것만 추가해 차이만 반영한다.
        List<UserExpectation> saved = userExpectationRepository.findAllByUserId(user.getId());
        Set<Long> requestedIds = expectations.stream().map(Expectation::getId).collect(Collectors.toSet());
        Set<Long> savedIds = saved.stream().map(userExpectation -> userExpectation.getId().getExpectationId())
                .collect(Collectors.toSet());

        userExpectationRepository.deleteAll(saved.stream()
                .filter(userExpectation -> !requestedIds.contains(userExpectation.getId().getExpectationId()))
                .toList());
        userExpectationRepository.saveAll(expectations.stream()
                .filter(expectation -> !savedIds.contains(expectation.getId()))
                .map(expectation -> UserExpectation.builder().user(user).expectation(expectation).build())
                .toList());
    }

    /** 사용자의 온보딩 선택값을 모두 삭제한다. */
    private void clearSelections(Long userId) {
        userExpectationRepository.deleteAll(userExpectationRepository.findAllByUserId(userId));
        userTransportationRepository.deleteById(userId);
        userTravelStyleRepository.deleteById(userId);
    }

    /** 온보딩 선택값을 보낸 사용자에게 배정할 온보딩 결과를 고른다. */
    // TODO: 온보딩 결과 매칭 기준이 확정되면, 무작위 배정 대신 요청 선택값과 매칭 기준에 따라 최종 온보딩 결과를 배정하도록 변경한다.
    private OnboardingResult pickRandomResult() {
        // 매칭 기준이 확정되기 전까지 기본 결과("여행자")를 제외한 결과 중 하나를 무작위로 배정한다.
        List<OnboardingResult> candidates = onboardingResultRepository.findAllByUserTypeNot(DEFAULT_USER_TYPE);
        if (candidates.isEmpty()) {
            throw new IllegalStateException("배정 가능한 온보딩 결과가 없습니다.");
        }
        return candidates.get(ThreadLocalRandom.current().nextInt(candidates.size()));
    }

    /** "나중에 할게요" 요청에 배정할 기본 온보딩 결과를 찾는다. */
    private OnboardingResult findDefaultResult() {
        return onboardingResultRepository.findFirstByUserTypeOrderByIdAsc(DEFAULT_USER_TYPE)
                .orElseThrow(() -> new IllegalStateException("기본 온보딩 결과(여행자)가 없습니다."));
    }
}
