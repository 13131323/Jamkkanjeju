package com.jamkkanjeju.server.domain.auth.controller;

import com.jamkkanjeju.server.domain.auth.dto.LoginRequest;
import com.jamkkanjeju.server.domain.auth.dto.LoginResponse;
import com.jamkkanjeju.server.domain.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
