package com.jamkkanjeju.server.domain.home.controller;

import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.domain.home.dto.GetHomeRequest;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse;
import com.jamkkanjeju.server.domain.home.service.HomeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 홈 화면 API 요청을 받아 서비스에 전달하는 컨트롤러이다. */
@RestController
@RequestMapping("/api/v2/users")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;

    /** 로그인한 사용자의 홈 화면 정보를 요청 위치 기준으로 조회한다. */
    @GetMapping("/me/home")
    public GetHomeResponse getHome(@AuthenticationPrincipal AuthUser authUser,
                                   @Valid @ParameterObject @ModelAttribute GetHomeRequest request) {
        return homeService.getHome(authUser.userId(), request);
    }
}
