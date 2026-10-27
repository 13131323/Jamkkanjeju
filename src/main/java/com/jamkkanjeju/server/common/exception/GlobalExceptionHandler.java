    package com.jamkkanjeju.server.common.exception;

    import jakarta.validation.ConstraintViolationException;
    import jakarta.servlet.http.HttpServletRequest;
    import com.jamkkanjeju.server.domain.treasurehunt.exception.TreasureHuntErrorCode;
    import com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode;
    import java.util.regex.Pattern;
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
    import org.springframework.web.multipart.MaxUploadSizeExceededException;
    import org.springframework.web.multipart.MultipartException;

    /** 컨트롤러에서 발생한 예외를 공통 오류 응답으로 변환한다. */
    @Slf4j      // logger를 만들어주는 lombok annotation. log.debug(), log.info() 등으로 로그를 찍을 수 있음.
    @RestControllerAdvice       // @RestController에서 발생하는 예외를 공통으로 처리하는 클래스.
    public class GlobalExceptionHandler {

        /** 비즈니스 규칙 위반 예외를 해당 오류 코드의 응답으로 변환한다. */
        @ExceptionHandler(BusinessException.class)
        public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException exception) {
            return toResponse(exception.getErrorCode());
        }

        /** 잘못된 요청 예외를 INVALID_REQUEST 응답으로 변환한다. */
        // Bean Validation 실패, JSON 파싱 실패, 파라미터 누락·타입 불일치가 모두 여기에 해당한다.
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

        /** 컨트롤러 호출 전 발생한 업로드 용량 초과를 각 API 명세의 개별 오류로 변환한다. */
        @ExceptionHandler(MaxUploadSizeExceededException.class)
        public ResponseEntity<ErrorResponse> handleUploadSizeExceeded(
                MaxUploadSizeExceededException exception, HttpServletRequest request) {
            if (isPictureUpload(request)) {
                return toResponse(TreasureHuntErrorCode.IMAGE_SIZE_EXCEEDED);
            }
            if (isCooperativeRoleVerification(request)) {
                return toResponse(CooperativeMissionErrorCode.IMAGE_SIZE_EXCEEDED);
            }
            return handleMultipartException(exception, request);
        }

        /** 사진·방명록 저장의 잘못된 multipart 요청은 공통 요청 오류로, 다른 API는 기존 방식으로 처리한다. */
        @ExceptionHandler(MultipartException.class)
        public ResponseEntity<ErrorResponse> handleMultipartException(
                MultipartException exception, HttpServletRequest request) {
            if (isPictureUpload(request) || isCooperativeRoleVerification(request) || isGuestbookCreation(request)) {
                return toResponse(CommonErrorCode.INVALID_REQUEST);
            }
            return handleException(exception);
        }

        /** 방명록의 전체 요청 용량·multipart 오류를 핸들러 선택 전에 경로로 식별한다. */
        private boolean isGuestbookCreation(HttpServletRequest request) {
            return "POST".equals(request.getMethod())
                    && request.getRequestURI().equals(request.getContextPath() + "/api/v2/guestbooks");
        }

        /** multipart 파싱은 핸들러 선택 전 실패할 수 있으므로 사진 업로드 경로를 직접 확인한다. */
        private boolean isPictureUpload(HttpServletRequest request) {
            return "POST".equals(request.getMethod())
                    && request.getRequestURI().equals(
                            request.getContextPath() + "/api/v2/treasure-missions/pictures-with-character");
        }

        /** 협동 역할 사진의 파싱 오류도 컨트롤러 선택 전에 업로드 경로로 식별한다. */
        private boolean isCooperativeRoleVerification(HttpServletRequest request) {
            return "POST".equals(request.getMethod())
                    && request.getRequestURI().matches(Pattern.quote(request.getContextPath())
                            + "/api/v2/cooperative-missions/[^/]+/role-progresses/[^/]+/verification");
        }

        /** 인증·인가 예외를 Spring Security가 처리하도록 넘긴다. */
        // 메서드 보안(@PreAuthorize 등)에서 난 인증·인가 예외는 아래 Exception 핸들러가 500으로 바꾸지 않도록 다시 던진다.
        // Spring Security의 ExceptionTranslationFilter가 받아 EntryPoint(401) / AccessDeniedHandler(403)로 응답한다.
        @ExceptionHandler({AccessDeniedException.class, AuthenticationException.class})
        public void rethrowSecurityException(RuntimeException exception) {
            throw exception;
        }

        /** 그 밖의 처리되지 않은 예외를 오류 응답으로 변환한다. */
        // 404, 405, 415 등 Spring MVC가 상태 코드를 정해 둔 예외는 그 상태 코드를 유지하고, 나머지는 모두 500으로 응답한다.
        @ExceptionHandler(Exception.class)
        public ResponseEntity<ErrorResponse> handleException(Exception exception) {
            if (exception instanceof org.springframework.web.ErrorResponse frameworkError
                    && frameworkError.getStatusCode().is4xxClientError()) {
                HttpStatusCode status = frameworkError.getStatusCode();
                HttpStatus resolved = HttpStatus.resolve(status.value());
                // httpstatus를 resolve해서 code를 가져오고, 없으면 그냥 status code를 string으로 변환해서 code로 사용
                String code = resolved != null ? resolved.name() : String.valueOf(status.value());
                return ResponseEntity.status(status).body(new ErrorResponse(code, "요청을 처리할 수 없습니다."));
            }

            log.error("Unhandled exception", exception);    // 던진 에러 메시지를 여기서 출력하고
            return toResponse(CommonErrorCode.INTERNAL_SERVER_ERROR);   // 응답으로는 정해놓은 500 응답만 보낸다.
        }

        /** 오류 코드를 HTTP 상태와 본문을 갖춘 응답으로 만든다. */
        private ResponseEntity<ErrorResponse> toResponse(ErrorCode errorCode) {
            return ResponseEntity.status(errorCode.status()).body(ErrorResponse.of(errorCode));
        }
    }
