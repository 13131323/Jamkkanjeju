package com.jamkkanjeju.server.domain.auth.security;

import com.jamkkanjeju.server.common.exception.ErrorCode;
import com.jamkkanjeju.server.common.exception.ErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * 시큐리티 필터 단계의 오류는 GlobalExceptionHandler까지 가지 않으므로,
 * 같은 {@link ErrorResponse} 형식으로 직접 응답 본문을 쓴다.
 */
@Component
@RequiredArgsConstructor
public class SecurityErrorResponseWriter {

    private final JsonMapper jsonMapper;

    public void write(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        jsonMapper.writeValue(response.getWriter(), ErrorResponse.of(errorCode));
    }
}
