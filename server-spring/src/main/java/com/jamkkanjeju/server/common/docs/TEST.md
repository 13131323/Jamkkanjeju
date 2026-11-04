# OpenAI 클라이언트 테스트 계획

- 상태: **완료**
- 기준: FastAPI 이미지 편집 호출, 백엔드 README의 OpenAI 설정, OpenAI 공식 이미지 편집 API

## 진행 방식

| 단계 | 검증 방법 |
| --- | --- |
| 단위 | `MockRestServiceServer`로 HTTP 경계를 대체한다. 실제 키·DB·OpenAI 유료 생성 호출은 사용하지 않는다 |
| 완료 조건 | 대상 단위 테스트와 컴파일이 통과해야 한다. 전체 테스트는 실행하지 않는다 |

## 단위 테스트 계획

| 테스트 클래스 | 준비 조건과 기대 결과 |
| --- | --- |
| `OpenAiClientTest` | 여러 참조 이미지와 model·prompt·n·size·output_format·Bearer 전송, 실제 PNG 결과 복원, 비활성/키 없음/입력 없음의 외부 호출 차단, 빈/복수/잘못된 JSON·Base64·이미지 응답 실패, HTTP/네트워크 실패와 비밀 정보 비노출, 설정 객체 출력의 키 마스킹 |

## 실행 순서

1. 컴파일을 확인한다.
2. `OpenAiClientTest`만 실행한다.
3. 결과를 기록한다. API·프론트·개발 DB는 변경하지 않는다.

## 결과

- 2026-11-04: `OpenAiClientTest` 16개 통과. 실패·오류·건너뜀 0개. 최종 실행 시간 16.357초.
- `mvnw compile`과 Compose 설정 검증도 통과했다. 실제 OpenAI 이미지 생성 호출·DB 접속·전체 테스트·컨테이너 재시작은 수행하지 않았다.
- 최초 테스트 컴파일에서 AssertJ의 `hasMessageNotContaining`에 여러 인자를 전달한 부분이 실패했다. 개별 조건으로 나눠 수정했고 대상 단위를 재실행해 모두 통과했다.
