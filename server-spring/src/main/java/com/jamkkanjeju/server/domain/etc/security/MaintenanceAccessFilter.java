package com.jamkkanjeju.server.domain.etc.security;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.security.SecurityErrorResponseWriter;
import com.jamkkanjeju.server.domain.etc.service.MaintenanceStateService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.filter.OncePerRequestFilter;

/** 일반 사용자 API를 점검 중 차단하되 홈·로그인·토큰 재발급은 기존 인증으로 통과시킨다. */
@Slf4j
@RequiredArgsConstructor
public class MaintenanceAccessFilter extends OncePerRequestFilter {
    private final MaintenanceStateService maintenanceStateService;
    private final SecurityErrorResponseWriter errorResponseWriter;

    /** 서비스 API만 검사하며 프리플라이트·문서·헬스 체크는 기존 처리에 맡긴다. */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equals(request.getMethod()) || !path(request).startsWith("/api/");
    }

    /** 점검 상태를 갱신한 후 허용하지 않은 API에 공통 형식의 503을 반환한다. */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                   FilterChain chain) throws ServletException, IOException {
        boolean inProgress;
        try {
            inProgress = maintenanceStateService.isInProgress();
        } catch (RuntimeException exception) {
            log.error("점검 상태 확인에 실패했습니다.", exception);
            errorResponseWriter.write(response, CommonErrorCode.INTERNAL_SERVER_ERROR);
            return;
        }
        if (inProgress && !isAllowed(request)) {
            errorResponseWriter.write(response, CommonErrorCode.SERVICE_UNDER_MAINTENANCE);
            return;
        }
        chain.doFilter(request, response);
    }

    /** 허용된 경로도 HTTP 메서드까지 일치해야 하며 이후 JWT 검증을 생략하지 않는다. */
    private boolean isAllowed(HttpServletRequest request) {
        String path = path(request);
        return ("GET".equals(request.getMethod()) && "/api/v2/users/me/home".equals(path))
                || ("POST".equals(request.getMethod())
                && ("/api/v2/auth/login".equals(path) || "/api/v2/auth/refresh".equals(path)));
    }

    /** 배포 컨텍스트 경로를 제외한 서비스 경로를 사용한다. */
    private String path(HttpServletRequest request) {
        return request.getRequestURI().substring(request.getContextPath().length());
    }
}
