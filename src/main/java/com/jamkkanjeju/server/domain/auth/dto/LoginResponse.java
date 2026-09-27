package com.jamkkanjeju.server.domain.auth.dto;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.IssuedToken;
import java.time.Duration;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long accessTokenExpiresIn,
        long refreshTokenExpiresIn,
        UserInfo user
) {

    private static final String TOKEN_TYPE = "Bearer";

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

    private static long secondsUntilExpiry(IssuedToken token) {
        return Duration.between(token.issuedAt(), token.expiresAt()).toSeconds();
    }

    public record UserInfo(
            Long id,
            String nickname,
            String role,
            boolean onboardingCompleted
    ) {

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
