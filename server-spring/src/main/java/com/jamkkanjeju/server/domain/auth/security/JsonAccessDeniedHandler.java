package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** 권한이 부족한 요청에 403 오류 응답을 보낸다. */
// 인증은 됐지만 권한이 부족한 경우이다. (예: USER가 ADMIN 전용 API 호출)
@Component
@RequiredArgsConstructor
public class JsonAccessDeniedHandler implements AccessDeniedHandler {

    private final SecurityErrorResponseWriter errorResponseWriter;

    /** 접근 거부 시 FORBIDDEN 오류 응답을 쓴다. */
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        errorResponseWriter.write(response, CommonErrorCode.FORBIDDEN);
    }
}
