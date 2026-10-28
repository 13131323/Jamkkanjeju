# 공통 예외 처리(GlobalExceptionHandler) 테스트

- 실행일: 2026-10-06
- 결과: **6개 전부 통과**

## 진행 방식

| 구분 | 방법 |
| --- | --- |
| 통합 테스트 | `@SpringBootTest` + MockMvc로 시큐리티 필터부터 예외 핸들러까지 실제 요청 흐름 검증. 테스트 전용 컨트롤러가 분기마다 예외를 하나씩 발생시키고, 응답의 상태 코드, code, message를 함께 확인 |

## 결과

`GlobalExceptionHandlerIntegrationTest`

| 분기 | 발생 예외 | 상태 | code | message | 결과 |
| --- | --- | --- | --- | --- | --- |
| BusinessException | `BusinessException(INVALID_CREDENTIALS)` | 401 | INVALID_CREDENTIALS | 이메일 또는 비밀번호가 올바르지 않습니다. | 통과 |
| 요청값 오류 | `MethodArgumentNotValidException` | 400 | INVALID_REQUEST | 요청값이 올바르지 않습니다. | 통과 |
| 시큐리티 예외 재던지기 | `AccessDeniedException` | 403 | FORBIDDEN | 접근 권한이 없습니다. | 통과 |
| 시큐리티 예외 재던지기 | `BadCredentialsException` | 401 | UNAUTHORIZED | 인증이 필요합니다. | 통과 |
| Spring MVC 4xx | `HttpRequestMethodNotSupportedException` | 405 | METHOD_NOT_ALLOWED | 요청을 처리할 수 없습니다. | 통과 |
| 그 밖의 예외 | `IllegalStateException` | 500 | INTERNAL_SERVER_ERROR | 서버 내부 오류가 발생했습니다. | 통과 |

## 발견한 점

- `@WithMockUser`가 MockMvc 요청에 적용되지 않아 모든 요청이 401로 막힘: 실제 액세스 토큰을 발급해 헤더로 보내도록 변경
- `.env`의 `DEV_AUTH_ENABLED=true`가 테스트에도 적용되면 기존 `JwtAuthenticationIntegrationTest` 2개가 실패함: 테스트 실행 시 false로 둬야 함
