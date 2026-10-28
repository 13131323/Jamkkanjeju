package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/** 인증이 필요한 API를 인증 없이 호출한 요청에 401 오류 응답을 보낸다. */
@Component
@RequiredArgsConstructor
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final SecurityErrorResponseWriter errorResponseWriter;

    /** 인증 실패 원인에 맞는 401 오류 응답을 쓴다. */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        // 필터가 토큰 오류를 남겼으면 그 코드(INVALID_TOKEN / EXPIRED_TOKEN), 토큰이 아예 없으면 UNAUTHORIZED.
        ErrorCode errorCode = request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE) instanceof ErrorCode code
                ? code
                : CommonErrorCode.UNAUTHORIZED;

        errorResponseWriter.write(response, errorCode);
    }
}
