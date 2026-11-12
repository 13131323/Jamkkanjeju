package com.jamkkanjeju.server.domain.auth.controller;

import com.jamkkanjeju.server.domain.auth.dto.LoginRequest;
import com.jamkkanjeju.server.domain.auth.dto.LoginResponse;
import com.jamkkanjeju.server.domain.auth.dto.LogoutRequest;
import com.jamkkanjeju.server.domain.auth.dto.RefreshTokenRequest;
import com.jamkkanjeju.server.domain.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 인증 관련 API 요청을 받는 컨트롤러이다. */
@Tag(name = "authorize")
@RestController
@RequestMapping("/api/v2/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** 이메일·비밀번호로 로그인하고 토큰을 발급받는다. */
    @Operation(summary = "로그인")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** 리프레시 토큰으로 새 액세스·리프레시 토큰과 현재 사용자 정보를 발급받는다. */
    @Operation(summary = "액세스 토큰 재발급")
    @PostMapping("/refresh")
    public LoginResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refresh(request);
    }

    /** 현재 기기의 리프레시 토큰 기록을 삭제하고 본문 없는 성공 응답을 반환한다. */
    @Operation(summary = "로그아웃")
    @ApiResponse(responseCode = "204", description = "로그아웃 완료")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request);
    }
}
