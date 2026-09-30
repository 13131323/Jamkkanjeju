# server-spring

제주 관광 미션/방명록 서비스 백엔드. Spring Boot 4.1.1 / Java 21 / MySQL 8.4 / Flyway / Spring Security + JJWT.

> **이 문서는 Claude가 직접 유지보수한다.**
> 작업 중 새 규칙을 정하거나, 사용자 요구로 기존 규칙이 바뀌거나, 문서 내용이 실제 코드와 어긋난 것을 발견하면
> 그 작업 안에서 이 파일을 함께 수정한다. (규칙과 코드가 다르면 코드를 기준으로 문서를 고치고, 사용자에게 알린다.)

## ⚠️ 터미널에서 빌드할 때는 JAVA_HOME을 반드시 지정할 것

이 PC의 사용자 환경변수 `JAVA_HOME`은 **JDK 8**을 가리키고 있다.
`./mvnw`는 `JAVA_HOME`을 읽어서 JDK를 고르기 때문에, 그냥 실행하면 javac 8로 컴파일되어
`record` 같은 문법에서 `class, interface, or enum expected` 에러가 난다.

JDK 21 위치는 PC마다 다르다. `ls ~/.jdks/`로 `ms-21*` 폴더를 찾아서 쓴다.
(현재 확인된 경로: `C:\Users\maymo\.jdks\ms-21.0.12.1`, 다른 PC: `C:\Users\USER\.jdks\ms-21.0.12.1-1`)

```bash
JAVA_HOME="C:\Users\maymo\.jdks\ms-21.0.12.1" ./mvnw compile
JAVA_HOME="C:\Users\maymo\.jdks\ms-21.0.12.1" ./mvnw test
JAVA_HOME="C:\Users\maymo\.jdks\ms-21.0.12.1" ./mvnw clean package
```

- 환경변수 자체는 **고치지 않기로 했다.** (JDK 8을 쓰는 다른 프로젝트가 있을 수 있어서)
- IntelliJ는 `JAVA_HOME`을 보지 않고 Maven Runner에 지정된 JDK 21을 쓰므로 IDE에서는 문제없다.
- Docker 빌드도 컨테이너 안의 `maven:3.9-eclipse-temurin-21`을 쓰므로 영향 없다.
- `-o`(오프라인) 옵션은 쓰지 말 것. surefire / spring-boot-maven-plugin 의존성이 로컬 `.m2`에 없어서 실패한다.

## 실행 / 검증

MySQL은 Docker로 띄운다. `docker compose up -d`는 mysql + app을 같이 올린다.

- 이 PC는 3306, 3307 포트를 다른 MySQL이 쓰고 있다. 로컬 검증 시 `MYSQL_HOST_PORT=3317 docker compose up -d --wait mysql`처럼 비어 있는 포트로 띄운다.
- 앱 실행에는 DB 환경변수 외에 `JWT_SECRET_KEY`(Base64, 32바이트 이상), `JWT_ACCESS_TOKEN_EXPIRATION`, `JWT_REFRESH_TOKEN_EXPIRATION`이 필요하다.

```bash
JAVA_HOME="C:\Users\maymo\.jdks\ms-21.0.12.1" \
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3317 MYSQL_DATABASE=tour MYSQL_USER=tour MYSQL_PASSWORD=tour_password \
JWT_SECRET_KEY=$(openssl rand -base64 32) JWT_ACCESS_TOKEN_EXPIRATION=30m JWT_REFRESH_TOKEN_EXPIRATION=14d \
./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=18080
```

Swagger UI는 앱 실행 후 `http://localhost:<포트>/docs` (`springdoc.swagger-ui.path`), OpenAPI JSON은 `/v3/api-docs` (springdoc-openapi 3.1.1).
인증이 필요한 API는 Swagger 우측 상단 Authorize에 로그인 응답의 `accessToken`을 넣고 호출한다.
두 경로는 `SecurityConfig`에서 permitAll이다.
매번 Authorize 하기 번거로우면 `DEV_AUTH_ENABLED=true`로 띄운다 (아래 "개발용 자동 로그인").

엔티티 매핑이 스키마와 맞는지는 같은 환경변수로 `./mvnw test`(컨텍스트 로딩 테스트)를 돌려 확인한다
(`ddl-auto: validate`라서 매핑이 틀리면 컨텍스트 로딩이 실패한다).

## 스키마

- **스키마의 단일 출처는 `src/main/resources/db/migration/*.sql` (Flyway)이다.** V1이 전체 테이블의 DDL.
- `spring.jpa.hibernate.ddl-auto: validate` — Hibernate는 스키마를 절대 바꾸지 않는다.
  엔티티를 고치려면 **반드시 새 마이그레이션(V2, V3…)을 같이 추가**해야 하고, 그러지 않으면 부팅이 실패한다.
- 물리 네이밍 전략은 `CamelCaseToUnderscoresNamingStrategy`.

## 패키지 구조

```
com.jamkkanjeju.server
├── common
│   ├── config        # 전역 설정 (JpaAuditingConfig, ClockConfig, OpenApiConfig)
│   ├── exception     # ErrorCode, CommonErrorCode, BusinessException, ErrorResponse, GlobalExceptionHandler
│   └── persistence   # BaseTimeEntity
└── domain
    └── <도메인>       # auth, onboarding, home, map, mission, culturemission, cooperativemission,
        │             # treasurehunt, guestbook, mypage, etc
        ├── docs
        │   ├── API_SPEC.md       # 외부 API 계약 (작성 규칙은 CODEX.md)
        │   ├── BUISNESS_RULE.md  # 내부 비즈니스 규칙 (철자 그대로 유지)
        │   └── TEST.md           # 테스트 진행 기록 (테스트를 작성·실행했을 때)
        ├── controller  # XxxController
        ├── service     # XxxService
        ├── dto         # XxxRequest / XxxResponse (record)
        ├── repository  # XxxRepository (Spring Data JPA)
        ├── entity
        ├── exception   # XxxErrorCode (enum implements ErrorCode)
        └── config      # 도메인 전용 설정이 있을 때만 (예: auth/config/SecurityConfig, JwtConfig)
```

- 도메인 전용 보조 컴포넌트는 역할 이름으로 하위 패키지를 만든다.
  (예: `auth/jwt/JwtTokenProvider`, `auth/jwt/TokenHasher`, `auth/security/JwtAuthenticationFilter`)
- 필요 없는 하위 패키지는 미리 만들지 않는다.

## 엔티티 규칙

- `common/persistence/BaseTimeEntity`를 상속해 `created_at`/`updated_at`을 얻는다
  (예외: `guestbook_like`는 `updated_at`이 없어서 상속하지 않음).
- `@Getter` + `@NoArgsConstructor(access = PROTECTED)`, 생성은 `@Builder`로. Setter는 만들지 않는다.
  상태 변경은 의도가 드러나는 메서드로 만든다. (예: `RefreshToken.revoke(LocalDateTime)`)
- 연관관계는 전부 `FetchType.LAZY`. 컬렉션(`@OneToMany`)은 필요할 때만 추가한다.
- PK를 공유하는 테이블(`culture_mission`↔`mission`, `road_guestbook`↔`guestbook` 등)은 `@MapsId` + `@OneToOne`.
- 복합 PK는 `@EmbeddedId` + `@MapsId`, ID 클래스는 같은 패키지에 `~Id`로 둔다.
- JSON 컬럼은 `@JdbcTypeCode(SqlTypes.JSON)`. `CHAR(n)` 컬럼은 `@JdbcTypeCode(SqlTypes.CHAR)`를 써야 validate를 통과한다.
- DDL에 `CHECK ... IN (...)`으로 허용값이 못 박힌 컬럼만 enum(`@Enumerated(STRING)`)으로 매핑한다.
  제약이 없는 VARCHAR(`location.category`, `guestbook.status` 등)는 아직 `String`이다.

## API 구현 워크플로

사용자가 "OO API 구현"을 요청하면 다음 순서로 진행한다.

1. **문서 확인** — 해당 도메인의 `API_SPEC.md`, `BUISNESS_RULE.md`를 먼저 읽는다. 문서가 없거나 해당 API 섹션이 없으면
   `CODEX.md`의 문서 작성 규칙에 맞춰 문서부터 작성하고 사용자 확인을 받는다.
2. **스키마·엔티티 확인** — 필요한 컬럼이 엔티티/마이그레이션에 있는지 확인한다. 없으면 새 Flyway 마이그레이션 + 엔티티 수정.
3. **구현** — repository → exception(ErrorCode) → dto → service → controller 순. 보안 설정(permitAll 등)도 같이 반영.
4. **검증** — 최소한 `./mvnw compile`. 가능하면 MySQL 컨테이너를 띄워 앱을 실행하고 curl로 정상·오류 케이스를 호출해 본다.
   (테스트 코드는 사용자가 요청할 때 작성한다.)
5. **문서 동기화** — 구현 중 문서와 다르게 결정한 점이 생기면 문서 수정 여부를 사용자에게 알린다. 이 파일의 규칙도 갱신한다.

문서(`API_SPEC.md`, `BUISNESS_RULE.md`)가 구현의 기준이다. 문서에 없는 정책을 코드에서 새로 만들지 않고, 모호하면 사용자에게 묻는다.

## API 구현 규칙

### Controller

- `@RestController` + `@RequestMapping("/api/v2/<도메인 경로>")`. 버전은 별도 요구가 없으면 `v2`.
- 요청 본문은 `@Valid @RequestBody XxxRequest`. 컨트롤러에는 비즈니스 로직을 두지 않고 서비스 호출만 한다.
- 성공 응답은 DTO를 그대로 반환한다 (200 OK). 201/204 등 다른 상태가 명세에 있으면 `ResponseEntity` 또는 `@ResponseStatus` 사용.
- 응답을 공통 래퍼(`{ data: ... }` 등)로 감싸지 않는다. 명세의 JSON 구조를 그대로 반환한다.

### DTO

- `dto` 패키지에 Java `record`로 만든다. 이름은 `<동작>Request`, `<동작>Response`.
- 요청 검증은 Bean Validation 어노테이션으로 한다. 컬럼 길이 제한은 `@Size(max = n)`로 DB와 맞춘다.
- 입력값 정규화(trim, 소문자화 등)는 record의 compact constructor에서 한다. 그래야 정규화된 값으로 검증된다.
- 응답 DTO는 `static of(...)` / `from(entity)` 팩토리로 만든다. 엔티티를 응답으로 직접 노출하지 않는다.
- 중첩 객체는 응답 record 안의 nested record로 둔다. (예: `LoginResponse.UserInfo`)
- enum 값은 응답에서 `String`(`enum.name()`)으로 내려준다.

### Service

- 클래스에 `@Transactional(readOnly = true)`, 쓰기 메서드에만 `@Transactional`.
- 비즈니스 규칙 위반은 `throw new BusinessException(XxxErrorCode.YYY)`. 다른 예외 타입을 새로 만들지 않는다.
- 현재 시각은 `LocalDateTime.now()` 대신 주입받은 `Clock`을 쓴다.
- 처리 순서는 `BUISNESS_RULE.md`의 처리 순서를 그대로 따른다.

### 오류 응답

- 모든 오류 응답 본문은 `{ "code": "...", "message": "..." }` (`common/exception/ErrorResponse`).
- 도메인 오류 코드는 `domain/<도메인>/exception/<도메인>ErrorCode` enum이 `ErrorCode`를 구현해 정의한다.
  `code`는 enum 이름, `message`와 HTTP 상태는 `API_SPEC.md`의 오류 응답과 **문자 그대로** 일치시킨다.
- 공통 오류(`CommonErrorCode`): `INVALID_REQUEST`(400, 검증 실패·JSON 파싱 실패·파라미터 누락/타입 오류),
  `UNAUTHORIZED`(401, 토큰 없이 인증 필요 API 호출), `FORBIDDEN`(403, 권한 부족),
  `INTERNAL_SERVER_ERROR`(500, 처리되지 않은 예외). `GlobalExceptionHandler`/시큐리티 핸들러가 자동 변환하므로 서비스에서 직접 던질 필요 없다.
- `GlobalExceptionHandler`는 `AccessDeniedException`/`AuthenticationException`을 다시 던진다.
  (`Exception` 핸들러가 500으로 바꾸지 않고 시큐리티의 EntryPoint/AccessDeniedHandler가 응답하도록)
- 404/405/415 같은 Spring MVC 예외는 해당 상태 코드와 `HttpStatus` 이름을 code로 응답한다.

### 보안 / 인증

- `SecurityConfig`(`domain/auth/config`)는 STATELESS, CSRF/formLogin/httpBasic 비활성.
  인증 없이 호출 가능한 API는 `requestMatchers(...).permitAll()`에 추가한다. 그 외는 모두 인증 필요.
- JWT: 액세스 토큰(`type=access`, `role`), 리프레시 토큰(`type=refresh`, `jti`). 생성은 `JwtTokenProvider`.
- 리프레시 토큰은 원문 대신 SHA-256 hex(`TokenHasher`)를 `refresh_token.token_hash`에 저장한다.

#### 개발용 자동 로그인 (`app.dev-auth`)

API를 만들면서 Swagger로 바로 호출해 보려고, 토큰 없이도 고정 사용자로 인증되게 하는 장치.
`DevAuthenticationFilter`(`auth/security`) + `DevAuthProperties`(`auth/config`), `SecurityConfig`에서 켜져 있을 때만 등록한다.

```bash
DEV_AUTH_ENABLED=true DEV_AUTH_USER_ID=1 DEV_AUTH_ROLE=USER   # 나머지는 기본값
```

- **기본값은 `false`.** 운영에서는 절대 켜지 않는다. 켜져서 실행되면 시작 로그에 WARN이 남는다.
- `Authorization` 헤더가 **아예 없을 때만** 동작한다. 그래서 토큰을 보내면 실제 로그인 흐름이, 잘못된 토큰을 보내면 401이 그대로 확인된다.
- 단, "토큰 없음 → 401"은 이 설정이 켜진 동안 확인할 수 없다. 그 케이스를 볼 때는 꺼야 한다.
- `DEV_AUTH_USER_ID`로 지정한 사용자가 **DB에 실제로 있어야 한다.** FK가 걸린 API는 없는 사용자면 실패한다.
- 통합 테스트에는 쓰지 않는다. 테스트는 이 설정과 무관하게(기본값 false) 실제 토큰으로 검증한다.
- JWT 인증 필터(`auth/security/JwtAuthenticationFilter`): `Authorization: Bearer <액세스 토큰>`을
  `JwtTokenProvider.parseAccessToken`으로 검증(서명·만료·`type=access`)하고 SecurityContext에 `AuthUser(userId, role)`와
  `ROLE_<role>` 권한을 넣는다. 빈으로 등록하지 않고 `SecurityConfig`에서 `new`로 생성한다. (빈이면 서블릿 필터로 중복 등록됨)
  - 토큰 오류가 있어도 필터는 응답하지 않고 요청 속성에 오류 코드만 남긴다 → permitAll API는 그대로 통과.
  - 인증 필요 API에서 인증이 없으면 `JsonAuthenticationEntryPoint`가 401: 토큰 없음 `UNAUTHORIZED`,
    잘못된 토큰 `INVALID_TOKEN`, 만료 `EXPIRED_TOKEN` (`AuthErrorCode`). 권한 부족은 `JsonAccessDeniedHandler`가 403 `FORBIDDEN`.
    이 4개 코드는 확정되었고, 외부 계약은 `auth/docs/API_SPEC.md`의 "공통 인증 오류", 내부 규칙은 `auth/docs/BUISNESS_RULE.md`의
    "액세스 토큰 인증"에 있다. 인증이 필요한 API의 명세에는 이 오류를 반복하지 않고 공통 인증 오류를 참조한다.
  - 컨트롤러에서 로그인 사용자는 `@AuthenticationPrincipal AuthUser authUser`로 받는다. 관리자 전용은 `@PreAuthorize("hasRole('ADMIN')")`.
  - 필터는 DB에서 사용자 상태를 다시 조회하지 않는다. (정지·탈퇴 즉시 차단이 필요하면 정책을 정해 추가)

## 테스트

사용자가 요청할 때 작성한다. 작성·실행 후에는 도메인의 `docs/TEST.md`에 진행 방식과 결과를 기록한다.

`TEST.md`는 **간결하게** 쓴다. 케이스를 하나하나 나열하지 않는다. (예시: `auth/docs/TEST.md`)

- 들어갈 내용: 실행일과 전체 결과, 진행 방식(단위/통합을 어떻게 했는지 표 한 개),
  테스트 클래스별 결과(검증 내용 한 줄 + 개수 + 결과 표 한 개), 테스트 중 발견하고 수정한 점. 실행 방법은 적지 않는다.
- 서식: 미리보기가 깨지지 않도록 단순하게 쓴다. 코드 스팬 안에 `<`, `>`, `{`, `}`나 앞뒤 공백을 넣지 않고,
  `→`, `≈`, `—` 같은 특수 기호 대신 ASCII 문자를 쓴다.

- **모듈 단위 테스트**: 스프링·DB 없이 JUnit 5 + AssertJ + Mockito. 시각은 `Clock.fixed`. 공통 픽스처는 `<도메인>/support/`.
- **통합 테스트**: `<도메인>/integration/`. `@SpringBootTest` + `@AutoConfigureMockMvc`(`org.springframework.boot.webmvc.test.autoconfigure`)
  + `@Transactional`(테스트마다 롤백). 실제 MySQL을 쓰므로 `MYSQL_*` 환경변수 필요. JWT 설정은 `@SpringBootTest(properties=...)`로 고정.
- 인증 필요 API가 없을 때 필터 검증은 테스트 안의 `@TestConfiguration`으로 등록한 프로브 컨트롤러를 쓴다. (예: `JwtAuthenticationIntegrationTest`)

## 문서 작성 규칙

`API_SPEC.md` / `BUISNESS_RULE.md` 작성 형식은 `CODEX.md`를 따른다. (UTF-8 BOM 없음, 한글 원문 그대로)

## 작업 기록 (구현된 API)

| 도메인 | API | 엔드포인트 | 비고 |
| --- | --- | --- | --- |
| auth | 로그인 | `POST /api/v2/auth/login` | 단위·통합 테스트 완료 (`auth/docs/TEST.md`) |
| auth | JWT 인증 필터 | (전역) | 401/403 JSON 응답 포함, 테스트 완료 |
