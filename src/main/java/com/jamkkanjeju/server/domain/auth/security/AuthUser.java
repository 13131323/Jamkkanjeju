package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.domain.auth.entity.UserRole;

/**
 * 액세스 토큰으로 인증된 사용자. SecurityContext의 principal로 들어가며,
 * 컨트롤러에서는 {@code @AuthenticationPrincipal AuthUser authUser}로 받는다.
 */
public record AuthUser(Long userId, UserRole role) {
}
