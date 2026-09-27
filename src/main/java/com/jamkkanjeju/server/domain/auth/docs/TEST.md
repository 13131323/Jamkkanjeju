# 로그인 API / JWT 인증 필터 테스트

- 실행일: 2026-09-27
- 결과: **72개 전부 통과**

## 진행 방식

| 구분 | 방법 |
| --- | --- |
| 모듈 단위 테스트 | 스프링, DB 없이 클래스 하나씩 검증. 협력 객체는 Mockito, 시각은 `Clock.fixed`로 고정 |
| 통합 테스트 | `@SpringBootTest` + MockMvc로 실제 MySQL까지 요청 전체 흐름 검증. 테스트마다 롤백 |

## 결과

| 테스트 | 검증 내용 | 개수 | 결과 |
| --- | --- | --- | --- |
| `LoginRequestValidationTest` | 이메일 정규화, 이메일, 비밀번호, deviceInfo 입력 규칙 | 16 | 통과 |
| `TokenHasherTest` | SHA-256 해시 값, 형식 | 2 | 통과 |
| `JwtTokenProviderTest` | 토큰 Claim 구성, jti 고유성, 만료, 변조, 타입 검증 | 12 | 통과 |
| `AuthServiceTest` | 로그인 성공, 실패(401, 403), 리프레시 토큰 저장, 처리 순서 | 12 | 통과 |
| `JwtAuthenticationFilterTest` | 헤더별 인증 처리, 오류 코드 기록 | 7 | 통과 |
| `LoginApiIntegrationTest` | 로그인 API 응답, DB 저장, 400, 401, 403, 415 | 13 | 통과 |
| `JwtAuthenticationIntegrationTest` | 인증 필요 API의 200, 401, 403 응답 | 9 | 통과 |
| `ServerSpringApplicationTests` | 컨텍스트 로딩 | 1 | 통과 |

## 발견하고 수정한 점

- 이메일 `user@example`(도메인에 점 없음)이 검증을 통과함: `docs/rules.md`에 맞춰 거부하도록 수정
- `@PreAuthorize` 권한 거부가 500으로 응답될 수 있음: 403 `FORBIDDEN`으로 응답하도록 수정
