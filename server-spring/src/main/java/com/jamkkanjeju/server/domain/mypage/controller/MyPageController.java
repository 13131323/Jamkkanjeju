package com.jamkkanjeju.server.domain.mypage.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.mypage.dto.GetMyPageResponse;
import com.jamkkanjeju.server.domain.mypage.dto.GetUserInfoResponse;
import com.jamkkanjeju.server.domain.mypage.dto.GetTravelEndingElementsResponse;
import com.jamkkanjeju.server.domain.mypage.service.TravelEndingElementsService;
import com.jamkkanjeju.server.domain.mypage.dto.UpdateUserInfoRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.jamkkanjeju.server.domain.mypage.service.MyPageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 마이페이지 요청을 인증된 사용자와 함께 서비스에 전달한다. */
@Tag(name = "mypage")
@RestController
@RequestMapping("/api/v2/users")
@RequiredArgsConstructor
public class MyPageController {
    private final MyPageService myPageService;
    private final TravelEndingElementsService travelEndingElementsService;

    /** 엽서에서 선택할 방문 장소·활성 완료 미션과 보유 포인트를 조회한다. */
    @Operation(summary = "여행 마무리 엽서 요소 조회")
    @GetMapping("/me/travel-ending-elements")
    public GetTravelEndingElementsResponse getTravelEndingElements(@AuthenticationPrincipal AuthUser authUser) {
        return travelEndingElementsService.getTravelEndingElements(authUser.userId());
    }

    /** 현재 사용자 정보에서 요청한 필드만 변경한다. */
    @Operation(summary = "사용자 정보 변경")
    @PatchMapping("/me/profile")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateUserInfo(@AuthenticationPrincipal AuthUser authUser,
                               @Valid @RequestBody UpdateUserInfoRequest request) {
        myPageService.updateUserInfo(authUser.userId(), request);
    }

    /** 현재 사용자의 프로필·활동·캐릭터 조각 도감을 조회한다. */
    @Operation(summary = "마이페이지 조회")
    @GetMapping("/me/mypage")
    public GetMyPageResponse getMyPage(@AuthenticationPrincipal AuthUser authUser) {
        return myPageService.getMyPage(authUser.userId());
    }

    /** 프로필 수정에 사용할 현재 사용자 정보와 여행 선택값을 조회한다. */
    @Operation(summary = "사용자 정보 조회")
    @GetMapping("/me")
    public GetUserInfoResponse getUserInfo(@AuthenticationPrincipal AuthUser authUser) {
        return myPageService.getUserInfo(authUser.userId());
    }
}
