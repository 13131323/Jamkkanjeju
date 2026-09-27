package com.jamkkanjeju.server.domain.auth.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.dto.LoginRequest;
import com.jamkkanjeju.server.domain.auth.dto.LoginResponse;
import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.IssuedToken;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.jwt.TokenHasher;
import com.jamkkanjeju.server.domain.auth.repository.RefreshTokenRepository;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenHasher tokenHasher;
    private final Clock clock;

    /** 처리 순서는 domain/auth/BUISNESS_RULE.md 6절을 따른다. 이메일 정규화는 {@link LoginRequest}에서 끝난 상태다. */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_CREDENTIALS));

        validateLoginable(user);

        IssuedToken accessToken = jwtTokenProvider.createAccessToken(user);
        IssuedToken refreshToken = jwtTokenProvider.createRefreshToken(user);

        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHasher.hash(refreshToken.value()))
                .expiresAt(LocalDateTime.ofInstant(refreshToken.expiresAt(), clock.getZone()))
                .deviceInfo(request.deviceInfo())
                .build());

        return LoginResponse.of(accessToken, refreshToken, user);
    }

    private void validateLoginable(User user) {
        switch (user.getStatus()) {
            case ACTIVE -> {
            }
            case SUSPENDED -> throw new BusinessException(AuthErrorCode.USER_SUSPENDED);
            case WITHDRAWN -> throw new BusinessException(AuthErrorCode.USER_WITHDRAWN);
        }
    }
}
