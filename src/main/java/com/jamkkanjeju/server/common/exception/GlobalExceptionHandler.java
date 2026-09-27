package com.jamkkanjeju.server.common.exception;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException exception) {
        return toResponse(exception.getErrorCode());
    }

    /** Bean Validation 실패, JSON 파싱 실패, 파라미터 누락·타입 불일치는 모두 INVALID_REQUEST로 응답한다. */
    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            HandlerMethodValidationException.class,
            ConstraintViolationException.class,
            HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ErrorResponse> handleInvalidRequest(Exception exception) {
        log.debug("Invalid request: {}", exception.getMessage());
        return toResponse(CommonErrorCode.INVALID_REQUEST);
    }

    /**
     * 메서드 보안(@PreAuthorize 등)에서 난 인증·인가 예외는 아래 Exception 핸들러가 500으로 바꾸지 않도록 다시 던진다.
     * Spring Security의 ExceptionTranslationFilter가 받아 EntryPoint(401) / AccessDeniedHandler(403)로 응답한다.
     */
    @ExceptionHandler({AccessDeniedException.class, AuthenticationException.class})
    public void rethrowSecurityException(RuntimeException exception) {
        throw exception;
    }

    /**
     * 404, 405, 415 등 Spring MVC가 상태 코드를 정해 둔 예외는 그 상태 코드를 유지하고,
     * 나머지는 모두 500으로 응답한다.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception exception) {
        if (exception instanceof org.springframework.web.ErrorResponse frameworkError
                && frameworkError.getStatusCode().is4xxClientError()) {
            HttpStatusCode status = frameworkError.getStatusCode();
            HttpStatus resolved = HttpStatus.resolve(status.value());
            String code = resolved != null ? resolved.name() : String.valueOf(status.value());
            return ResponseEntity.status(status).body(new ErrorResponse(code, "요청을 처리할 수 없습니다."));
        }

        log.error("Unhandled exception", exception);
        return toResponse(CommonErrorCode.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<ErrorResponse> toResponse(ErrorCode errorCode) {
        return ResponseEntity.status(errorCode.status()).body(ErrorResponse.of(errorCode));
    }
}
