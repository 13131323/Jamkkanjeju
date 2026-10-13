package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.domain.auth.entity.UserRole;

/** 요청을 보낸 인증된 사용자의 식별 정보이다. */
// SecurityContext의 principal로 들어가며, 컨트롤러에서는 @AuthenticationPrincipal AuthUser authUser로 받는다.
public record AuthUser(Long userId, UserRole role) {
}
