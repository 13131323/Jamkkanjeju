package com.jamkkanjeju.server.domain.auth.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.dto.LoginRequest;
import com.jamkkanjeju.server.domain.auth.dto.LoginResponse;
import com.jamkkanjeju.server.domain.auth.dto.LogoutRequest;
import com.jamkkanjeju.server.domain.auth.dto.RefreshTokenRequest;
import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.IssuedToken;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.jwt.TokenHasher;
import com.jamkkanjeju.server.domain.auth.repository.RefreshTokenRepository;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 로그인 등 사용자 인증 처리를 담당한다. */
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

    /** 이메일·비밀번호를 확인하고 액세스·리프레시 토큰을 발급한다. */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        // 이메일 정규화는 LoginRequest에서 끝난 상태다.
        User user = userRepository.findByEmail(request.email())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_CREDENTIALS));

        validateLoginable(user);

        return issueTokens(user, request.deviceInfo());
    }

    /** 리프레시 토큰을 한 번만 사용해 새 토큰 쌍을 발급하고 기존 토큰을 폐기한다. */
    @Transactional
    public LoginResponse refresh(RefreshTokenRequest request) {
        // 1. 액세스 토큰이나 개발용 인증 사용자가 아닌 요청의 리프레시 토큰으로 사용자를 식별한다.
        Long userId;
        try {
            userId = jwtTokenProvider.parseRefreshToken(request.refreshToken());
        } catch (ExpiredJwtException exception) {
            throw new BusinessException(AuthErrorCode.EXPIRED_TOKEN);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(AuthErrorCode.INVALID_TOKEN);
        }

        // 2. 토큰 기록을 잠근 뒤 최신 폐기 상태를 확인하여 동시 사용을 막는다.
        RefreshToken previous = refreshTokenRepository.findByTokenHashForUpdate(tokenHasher.hash(request.refreshToken()))
                .orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_TOKEN));
        if (!previous.getUser().getId().equals(userId) || previous.getRevokedAt() != null) {
            throw new BusinessException(AuthErrorCode.INVALID_TOKEN);
        }
        LocalDateTime currentTime = LocalDateTime.now(clock);
        if (!previous.getExpiresAt().isAfter(currentTime)) {
            throw new BusinessException(AuthErrorCode.EXPIRED_TOKEN);
        }

        // 3. 현재 DB의 계정 상태와 권한으로 재발급한다.
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
        validateLoginable(user);

        // 4. 기존 토큰 폐기와 새 토큰 저장은 같은 트랜잭션에서 함께 반영하거나 롤백한다.
        previous.revoke(currentTime);
        return issueTokens(user, previous.getDeviceInfo());
    }

    /** 만료·폐기 여부와 관계없이 요청한 토큰 기록만 삭제하며, 이미 없으면 정상 완료한다. */
    @Transactional
    public void logout(LogoutRequest request) {
        refreshTokenRepository.findByTokenHashForUpdate(tokenHasher.hash(request.refreshToken()))
                .ifPresent(refreshTokenRepository::delete);
    }

    /** 로그인과 재발급에서 같은 규칙으로 토큰을 발급하고 새 리프레시 토큰의 해시를 저장한다. */
    private LoginResponse issueTokens(User user, String deviceInfo) {
        IssuedToken accessToken = jwtTokenProvider.createAccessToken(user);
        IssuedToken refreshToken = jwtTokenProvider.createRefreshToken(user);

        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHasher.hash(refreshToken.value()))
                .expiresAt(LocalDateTime.ofInstant(refreshToken.expiresAt(), clock.getZone()))
                .deviceInfo(deviceInfo)
                .build());

        return LoginResponse.of(accessToken, refreshToken, user);
    }

    /** 로그인할 수 있는 계정 상태인지 확인한다. */
    private void validateLoginable(User user) {
        switch (user.getStatus()) {
            case ACTIVE -> {
            }
            case SUSPENDED -> throw new BusinessException(AuthErrorCode.USER_SUSPENDED);
            case WITHDRAWN -> throw new BusinessException(AuthErrorCode.USER_WITHDRAWN);
        }
    }
}
