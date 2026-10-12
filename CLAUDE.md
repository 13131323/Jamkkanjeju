# Claude 작업 규칙

제주 관광 미션/방명록 서비스 백엔드. Spring Boot 4.1.1 / Java 21 / MySQL 8.4 / Flyway / Spring Security + JJWT.

## 기본 원칙

- 항상 작업 전에 이 파일을 읽고 이 규칙을 준수한다.
- 모든 파일은 UTF-8(BOM 없음)로 읽고 쓰며, 한글은 유니코드 이스케이프 없이 원문 그대로 작성한다.
- 사용자가 추가한 주석, 코드, 문서 내용을 함부로 삭제하거나 의미를 변경하지 않는다.
- 사용자가 요구한 범위 밖의 코드나 문서를 임의로 수정하지 않는다.
- 문서(`API_SPEC.md`, `BUISNESS_RULE.md`)가 구현의 기준이다. 문서에 없는 정책은 만들지 않고, 모호하면 사용자에게 묻는다.
- 문서의 구조와 형식을 임의로 변경하지 않고 문서 작업전에 다른 문서를 읽고 형식을 파악한 후에 작업을 진행한다.
- 사용자가 요구한 바를 앞으로의 작업에서 적용해야 한다면 CLAUDE.md 파일을 직접 수정한다.
- 사용자 요구 이외에 추가적인 기능이나 개선 사항을 제안할 때는 반드시 사용자에게 확인을 받고 진행한다.
- 사용자가 TODO를 요청하거나 문서에 TODO가 적혀 있으면, 해당 코드 위치에 `// TODO: <할 일>` 주석을 눈에 띄게 남긴다.

## 빌드 / 실행 규칙

- `-o`(오프라인) 옵션은 쓰지 않는다.
- DB는 Docker MySQL을 쓴다. 앱/테스트 실행에는 `MYSQL_*`, `JWT_SECRET_KEY`, `JWT_ACCESS_TOKEN_EXPIRATION`, `JWT_REFRESH_TOKEN_EXPIRATION` 환경변수가 필요하다.
- Swagger UI는 `/docs`. 개발용 자동 로그인은 `DEV_AUTH_ENABLED=true`(기본 false, 운영 금지, 테스트에서는 끈다).

## 패키지 구조

```
com.jamkkanjeju.server
├── common        # config, exception, persistence(BaseTimeEntity)
└── domain/<도메인>
    ├── docs        # API_SPEC.md, BUISNESS_RULE.md(철자 그대로), TEST.md
    ├── controller / service / dto / repository / entity
    ├── exception   # <도메인>ErrorCode
    └── config 등    # 필요할 때만 (예: auth/jwt, auth/security)
```

- 필요 없는 하위 패키지는 미리 만들지 않는다.

## 구현 순서

1. 도메인의 `API_SPEC.md`, `BUISNESS_RULE.md`를 읽는다. 없으면 문서부터 작성하고 사용자 확인을 받는다.
2. 필요한 컬럼이 엔티티/마이그레이션에 있는지 확인한다.
3. repository -> exception -> dto -> service -> controller 순으로 구현하고, 보안 설정(permitAll 등)도 같이 반영한다.
4. 최소 `./mvnw compile`로 검증한다. 테스트 코드는 사용자가 도메인의 `docs/TEST.md`에 테스트 계획을 작성하면 그 계획에 맞춰 작성하고 실행한다.
5. 문서와 다르게 결정한 점이 생기면 사용자에게 알린다.

## 스키마 / 엔티티 구현 규칙

- 스키마의 단일 출처는 `db/migration/*.sql`(Flyway)이다. `ddl-auto: validate`이므로 엔티티를 바꾸면 새 마이그레이션(V2, V3...)을 반드시 함께 추가한다.
- `BaseTimeEntity`를 상속한다. (`updated_at`이 없는 테이블은 제외)
- `@Getter` + `@NoArgsConstructor(access = PROTECTED)` + `@Builder`. Setter 대신 의도가 드러나는 상태 변경 메서드를 만든다.
- 연관관계는 모두 `LAZY`. 컬렉션 연관관계는 필요할 때만 추가한다.
- PK 공유는 `@MapsId` + `@OneToOne`, 복합 PK는 `@EmbeddedId` + `~Id` 클래스.
- JSON 컬럼은 `@JdbcTypeCode(SqlTypes.JSON)`, `CHAR(n)`은 `@JdbcTypeCode(SqlTypes.CHAR)`.
- DDL에 `CHECK ... IN (...)`이 있는 컬럼만 enum(`@Enumerated(STRING)`)으로 매핑한다.

## DTO 구현 규칙

- `record`로 만들고 이름은 `<동작>Request` / `<동작>Response`.
- 요청 검증은 Bean Validation으로 하고, 길이 제한은 `@Size(max = n)`로 DB 컬럼과 맞춘다.
- 입력값 정규화(trim, 소문자화 등)는 compact constructor에서 한다.
- 응답은 `of(...)` / `from(entity)` 팩토리로 만들고, 엔티티를 직접 노출하지 않는다.
- 중첩 객체는 nested record, enum은 `String`(`name()`)으로 응답한다.
- DTO의 내부 계산용 공개 메서드(`isXxx()` 포함)가 JSON/API 필드가 아니면 `@JsonIgnore`와 `@Schema(hidden = true)`를 함께 붙여 Jackson 변환과 Swagger 스키마에서 제외한다.

## 서비스 로직 구현 규칙

- 클래스에 `@Transactional(readOnly = true)`, 쓰기 메서드에만 `@Transactional`.
- 처리 순서는 `BUISNESS_RULE.md`의 처리 순서를 그대로 따른다.
- 규칙 위반은 `throw new BusinessException(XxxErrorCode.YYY)`. 새 예외 타입을 만들지 않는다.
- 현재 시각은 `LocalDateTime.now()` 대신 주입받은 `Clock`을 쓴다.

## 컨트롤러 구현 규칙

- `@RestController` + `@RequestMapping("/api/v2/<도메인 경로>")`.
- 요청 본문은 `@Valid @RequestBody`. 비즈니스 로직 없이 서비스 호출만 한다.
- 응답은 공통 래퍼 없이 DTO를 그대로 반환한다. 200 외 상태는 `ResponseEntity` 또는 `@ResponseStatus`.
- 로그인 사용자는 `@AuthenticationPrincipal AuthUser`, 관리자 전용은 `@PreAuthorize("hasRole('ADMIN')")`.

## 예외 처리 규칙

- 오류 응답 본문은 항상 `{ "code", "message" }`(`ErrorResponse`).
- 도메인 오류는 `<도메인>ErrorCode` enum이 `ErrorCode`를 구현한다. code는 enum 이름, message와 상태는 `API_SPEC.md`와 문자 그대로 일치시킨다.
- 400 `INVALID_REQUEST`, 401, 403, 500은 `GlobalExceptionHandler`/시큐리티 핸들러가 자동 변환하므로 서비스에서 직접 던지지 않는다.
- 인증 필요 API의 명세에는 401/403을 반복하지 않고 `auth/docs/API_SPEC.md`의 공통 인증 오류를 참조한다.

## 보안 구현 규칙

- 인증 없이 호출 가능한 API만 `SecurityConfig`의 `permitAll()`에 추가한다. 그 외는 모두 인증 필요.
- 필터는 빈으로 등록하지 않고 `SecurityConfig`에서 `new`로 생성한다. (서블릿 필터 중복 등록 방지)
- 리프레시 토큰은 원문 대신 SHA-256 해시(`TokenHasher`)로 저장한다.

## 테스트 규칙

- 단위 테스트: 스프링/DB 없이 JUnit 5 + AssertJ + Mockito, 시각은 `Clock.fixed`, 공통 픽스처는 `<도메인>/support/`.
- 통합 테스트: `@SpringBootTest` + `@AutoConfigureMockMvc` + `@Transactional`, 실제 MySQL 사용. JWT 설정은 `properties`로 고정한다.
- 인증은 `@WithMockUser`가 동작하지 않으므로 `JwtTokenProvider`로 발급한 실제 토큰을 헤더로 보낸다.
- 검증용 엔드포인트가 필요하면 테스트 안의 `@TestConfiguration` 컨트롤러를 쓴다.
- 테스트 계획은 사용자가 도메인의 `docs/TEST.md`에 작성한다. Claude는 계획의 테스트 클래스명, 검증 항목, 실행 순서를 그대로 따라 테스트를 작성하고 실행한다. 계획에 없는 케이스를 추가하거나 계획이 모호하면 사용자에게 먼저 묻는다.
- 실행 후 `TEST.md`의 사용자 계획 내용은 지우거나 바꾸지 않고, 상태/실행일/전체 결과, 클래스별 결과 표(`## 결과`), 발견/수정 사항(`## 발견하고 수정한 점`)만 실제 결과로 갱신한다. 계획과 다르게 구현한 점(케이스 병합·분리 등)도 발견/수정 사항에 적는다.
- 계획 없이 테스트를 요청받으면 `TEST.md`를 위 형식(진행 방식 표, 클래스별 결과 표, 발견/수정 사항)으로 간결하게 작성한다. 실행 방법은 적지 않는다.
