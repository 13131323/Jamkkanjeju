package com.jamkkanjeju.server.domain.auth.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.IssuedToken;
import java.time.Duration;

/** 로그인 API의 응답 본문으로, 발급된 토큰과 로그인 사용자 정보를 담는다. */
public record LoginResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long accessTokenExpiresIn,
        long refreshTokenExpiresIn,
        UserInfo user
) {

    private static final String TOKEN_TYPE = "Bearer";

    /** 발급한 토큰과 사용자로 로그인 응답을 만든다. */
    public static LoginResponse of(IssuedToken accessToken, IssuedToken refreshToken, User user) {
        return new LoginResponse(
                accessToken.value(),
                refreshToken.value(),
                TOKEN_TYPE,
                secondsUntilExpiry(accessToken),
                secondsUntilExpiry(refreshToken),
                UserInfo.from(user)
        );
    }

    /** 토큰의 유효 기간을 초 단위로 구한다. */
    private static long secondsUntilExpiry(IssuedToken token) {
        return Duration.between(token.issuedAt(), token.expiresAt()).toSeconds();
    }

    /** 로그인한 사용자의 기본 정보이다. */
    public record UserInfo(
            Long id,
            String nickname,
            String role,
            boolean onboardingCompleted
    ) {

        /** 사용자 엔티티로 응답용 사용자 정보를 만든다. */
        public static UserInfo from(User user) {
            return new UserInfo(
                    user.getId(),
                    user.getNickname(),
                    user.getRole().name(),
                    user.getOnboardingResult() != null
            );
        }
    }
}
