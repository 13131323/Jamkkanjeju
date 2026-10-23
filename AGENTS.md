# Codex 작업 규칙

제주 관광 미션/방명록 서비스 백엔드. Spring Boot 4.1.1 / Java 21 / MySQL 8.4 / Flyway / Spring Security + JJWT.

## 기본 원칙

- 항상 작업 전에 이 파일을 읽고 이 규칙을 준수한다.
- 모든 파일은 UTF-8(BOM 없음)로 읽고 쓴다.
- 한글은 유니코드 이스케이프 문자열로 변환하지 않고 원문 그대로 작성한다.
- 사용자가 추가한 주석, 코드, 문서 내용을 함부로 삭제하거나 의미를 변경하지 않는다.
- 사용자가 요구한 범위 밖의 코드나 문서를 임의로 수정하지 않는다.
- 문서는 기존에 작성된 형식과 구조를 유지하며, 필요한 경우 최소한의 수정만 한다.
- 기존 문서가 있으면 최신 사용자 수정 내용을 우선하며, 필요한 부분만 최소한으로 수정한다.
- 사용자가 요구한 바를 앞으로의 작업에서 적용해야한다면 AGENTS.md 파일을 직접 수정한다.
- 사용자 요구 이외에 추가적인 기능이나 개선 사항을 제안할 때는 반드시 사용자에게 확인을 받고 진행한다.
- 사용자의 확인이 필요한 내용은 반드시 작업 전에 확인받는다.

## 문서 작업 원칙

- 문서의 구조와 형식을 임의로 변경하지 않고 문서 작업전에 다른 문서를 읽고 형식을 파악한 후에 작업을 진행한다.

### api 명세 작업 규칙

- 내부 구현 방식이나 비즈니스 로직 등에 대한 설명은 포함하지 않도록 한다.
- 인증 필요 API의 명세에는 401/403을 반복하지 않고 `common/docs/commonError.md`의 공통 인증·인가 오류를 참조한다.
- 400/500은 모든 API 명세에 반복하지 않고 `common/docs/commonError.md`의 공통 오류를 참조한다. 공통 오류는 한 문장과 링크로 묶어서 표현하고, 도메인 종속 오류만 해당 API 명세에 직접 작성한다.

### 비즈니스 규칙 작업 규칙

- 추후에 변경예정이라고 사용자가 얘기하거나 이전 프로젝트에서 그러하게 구현된 로직이 있으면 주석을 통해 해당 내용을 구현시 명시할 것을 문서에 적는다.

### 테스트 계획 문서 작업 규칙

- `API_SPEC.md`와 `BUISNESS_RULE.md`를 기준으로 정상 흐름, 오류 조건, 경계값과 주요 비즈니스 분기를 검증하도록 계획한다. 문서에 없는 정책은 추가하지 않는다.
- 단위 테스트는 요청 검증, 계산, 상태 변경과 서비스 분기를 검증하고, 통합 테스트는 인증부터 HTTP 응답, 실제 DB 반영과 트랜잭션까지 연결된 동작을 검증한다.
- 해당 API에 필요한 반복 요청·중복 방지, 사용자별 데이터 격리, 실패 시 데이터 유지·롤백을 포함한다. 같은 검증을 단위·통합 테스트에 기계적으로 중복하지 않는다.
- 테스트 클래스별로 준비 조건과 기대 결과가 명확한 검증 항목을 정하고, 시각·무작위 값·기존 데이터에 의존하지 않도록 계획한다.
- 단위 테스트 → 통합 테스트 → 기존 테스트 회귀 확인 순서와 완료 조건을 적는다. 문서 형식은 기존 `TEST.md`를 따르고, 실행 결과는 테스트 실행 후 기록한다.

## 구현 원칙

- 문서(`API_SPEC.md`, `BUISNESS_RULE.md`)가 구현의 기준이다. 문서에 없는 정책은 만들지 않고, 모호하면 사용자에게 묻는다.
- 사용자가 TODO를 요청하거나 문서에 TODO가 적혀 있으면, 해당 코드 위치에 `// TODO: <할 일>` 주석을 눈에 띄게 남긴다.
- 클래스나 메서드에 해당 클래스와 메서드가 어떤 역할을 하는지 위주로 간결하고 명확하게 주석으로 작성한다.
- 이외에도 형식이나 구조, 구현 방식 등은 기존 다른 코드들과 일관성을 반드시 유지하고, 주석 규칙 또한 일관성 있게 적용한다.
- 유사한 코드 블록이 여러 곳에 존재하면 공통 컴포넌트로 추출하고, 추출한 컴포넌트는 다른 도메인에서도 재사용할 수 있도록 구현한다.

### 빌드 / 실행 규칙

- `-o`(오프라인) 옵션은 쓰지 않는다.
- DB는 Docker MySQL을 쓴다. 앱/테스트 실행에는 `MYSQL_*`, `JWT_SECRET_KEY`, `JWT_ACCESS_TOKEN_EXPIRATION`, `JWT_REFRESH_TOKEN_EXPIRATION` 환경변수가 필요하다.
- Swagger UI는 `/docs`. 개발용 자동 로그인은 `DEV_AUTH_ENABLED=true`(기본 false, 운영 금지, 테스트에서는 끈다).

### 패키지 구조

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

### 구현 순서

1. 도메인의 `API_SPEC.md`, `BUISNESS_RULE.md`를 읽는다. 없으면 문서부터 작성하고 사용자 확인을 받는다.
2. 필요한 컬럼이 엔티티/마이그레이션에 있는지 확인한다.
3. repository -> exception -> dto -> service -> controller 순으로 구현하고, 보안 설정(permitAll 등)도 같이 반영한다.
4. 최소 `./mvnw compile`로 검증한다. 테스트 코드는 사용자가 도메인의 `docs/TEST.md`에 테스트 계획을 작성하면 그 계획에 맞춰 작성하고 실행한다.
5. 문서와 다르게 결정한 점이 생기면 사용자에게 알린다.

### 스키마 / 엔티티 구현 규칙

- 스키마의 단일 출처는 `db/migration/*.sql`(Flyway)이다. `ddl-auto: validate`이므로 엔티티를 바꾸면 새 마이그레이션(V2, V3...)을 반드시 함께 추가한다.
- `BaseTimeEntity`를 상속한다. (`updated_at`이 없는 테이블은 제외)
- `@Getter` + `@NoArgsConstructor(access = PROTECTED)` + `@Builder`. Setter 대신 의도가 드러나는 상태 변경 메서드를 만든다.
- 연관관계는 모두 `LAZY`. 컬렉션 연관관계는 필요할 때만 추가한다.
- PK 공유는 `@MapsId` + `@OneToOne`, 복합 PK는 `@EmbeddedId` + `~Id` 클래스.
- JSON 컬럼은 `@JdbcTypeCode(SqlTypes.JSON)`, `CHAR(n)`은 `@JdbcTypeCode(SqlTypes.CHAR)`.
- DDL에 `CHECK ... IN (...)`이 있는 컬럼만 enum(`@Enumerated(STRING)`)으로 매핑한다.

### 레포지토리 구현 규칙

- 특정 API 전용 조건을 쿼리에 박지 말고, 다른 기능에서도 쓸 수 있게 범용적으로 조회한다. (예: 완료 여부 같은 판정 기준은 쿼리가 아닌 서비스의 공통 컴포넌트에 둔다.)
- 레포지토리 메서드마다 Javadoc 주석으로 다음을 적는다.
  - 결과: 어떤 행이 어떤 형태로 나오는지, 함께 로딩되는 연관 엔티티, 결과가 없을 때의 값
  - 사용: 어떤 API(`METHOD /경로`)의 어떤 응답 필드를 구성하려고 쓰는지, 서비스에서 결과를 어떻게 가공하는지
- 상속받은 기본 메서드(`count()` 등)만 쓰는 레포지토리는 인터페이스 Javadoc에 같은 형식으로 적는다.
- 예시:

```java
/**
 * 결과: 사용자({@code userId})의 보물찾기 진행도 전체 목록(진행 중·완료 모두). 미션당 최대 한 건이다.
 * 각 원소는 {@code treasureMission.mission.missionType}(유형·이름·단계)과 {@code treasureMission.location}
 * (장소명·좌표, 없으면 null)이 함께 로딩되어 있고, 진행도가 없으면 빈 목록이다.
 * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답에서 두 곳에 쓴다.
 * {@code progressMission}의 TREASURE 항목은 IN_PROGRESS인 진행도로 구성하고,
 * {@code missionRecommend}의 TREASURE 후보에서는 완료한 진행도의 미션을 제외한다.
 */
@EntityGraph(attributePaths = {"treasureMission.mission.missionType", "treasureMission.location"})
List<TreasureMissionProgress> findAllByUserId(Long userId);
```

### DTO 구현 규칙

- `record`로 만들고 이름은 `<동작>Request` / `<동작>Response`.
- 요청 검증은 Bean Validation으로 하고, 길이 제한은 `@Size(max = n)`로 DB 컬럼과 맞춘다.
- 입력값 정규화(trim, 소문자화 등)는 compact constructor에서 한다.
- 응답은 `of(...)` / `from(entity)` 팩토리로 만들고, 엔티티를 직접 노출하지 않는다.
- 중첩 객체는 nested record, enum은 `String`(`name()`)으로 응답한다.
- DTO의 내부 계산용 공개 메서드(`isXxx()` 포함)가 JSON/API 필드가 아니면 `@JsonIgnore`와 `@Schema(hidden = true)`를 함께 붙여 Jackson 변환과 Swagger 스키마에서 제외한다.

### 서비스 로직 구현 규칙

- 클래스에 `@Transactional(readOnly = true)`, 쓰기 메서드에만 `@Transactional`.
- 처리 순서는 `BUISNESS_RULE.md`의 처리 순서를 그대로 따른다.
- 규칙 위반은 `throw new BusinessException(XxxErrorCode.YYY)`. 새 예외 타입을 만들지 않는다.
- 현재 시각은 `LocalDateTime.now()` 대신 주입받은 `Clock`을 쓴다.

### 컨트롤러 구현 규칙

- `@RestController` + `@RequestMapping("/api/v2/<도메인 경로>")`.
- 요청 본문은 `@Valid @RequestBody`. 비즈니스 로직 없이 서비스 호출만 한다.
- 응답은 공통 래퍼 없이 DTO를 그대로 반환한다. 200 외 상태는 `ResponseEntity` 또는 `@ResponseStatus`.
- 로그인 사용자는 `@AuthenticationPrincipal AuthUser`, 관리자 전용은 `@PreAuthorize("hasRole('ADMIN')")`.

### 예외 처리 규칙

- 오류 응답 본문은 항상 `{ "code", "message" }`(`ErrorResponse`).
- 도메인 오류는 `<도메인>ErrorCode` enum이 `ErrorCode`를 구현한다. code는 enum 이름, message와 상태는 `API_SPEC.md`와 문자 그대로 일치시킨다.
- 400 `INVALID_REQUEST`, 401, 403, 500은 `GlobalExceptionHandler`/시큐리티 핸들러가 자동 변환하므로 서비스에서 직접 던지지 않는다.

### 보안 구현 규칙

- 인증 없이 호출 가능한 API만 `SecurityConfig`의 `permitAll()`에 추가한다. 그 외는 모두 인증 필요.
- 필터는 빈으로 등록하지 않고 `SecurityConfig`에서 `new`로 생성한다. (서블릿 필터 중복 등록 방지)
- 리프레시 토큰은 원문 대신 SHA-256 해시(`TokenHasher`)로 저장한다.

### 테스트 규칙

- 테스트는 `TEST.md` 파일을 먼저 읽고 구현한다.
- 단위 테스트: 스프링/DB 없이 JUnit 5 + AssertJ + Mockito, 시각은 `Clock.fixed`, 공통 픽스처는 `<도메인>/support/`.
- 통합 테스트: `@SpringBootTest` + `@AutoConfigureMockMvc` + `@Transactional`, 실제 MySQL 사용. JWT 설정은 `properties`로 고정한다.
- 모든 DB 통합 테스트와 컨텍스트 로딩 테스트는 `src/test/java/com/jamkkanjeju/server/support/MySqlIntegrationTestSupport`를 직접 또는 공통 부모를 통해 상속한다. 개발 DB(`tour`)나 고정 테스트 DB에 직접 연결하지 않는다.
- 테스트 JVM의 실행 한 번에 `tour_test_<UUID>` 임시 DB 하나를 생성해 전체 통합 테스트가 공유한다. Flyway로 최신 마이그레이션을 적용하고, 테스트 종료 시 스프링 컨텍스트·연결을 닫은 뒤 임시 DB와 해당 DB 접근 권한을 자동 제거한다. 단위 테스트만 실행하면 DB를 생성하지 않는다.
- 임시 DB의 MySQL 접속은 `TEST_MYSQL_HOST`(기본 localhost), `TEST_MYSQL_PORT`(기본 `MYSQL_HOST_PORT` 또는 3306)를 사용한다. 생성·삭제에는 `TEST_MYSQL_ADMIN_USER`(기본 root)와 `MYSQL_ROOT_PASSWORD`, 테스트 연결에는 `MYSQL_USER`(기본 tour)와 `MYSQL_PASSWORD`가 필요하다. DB 생성이 실패해도 개발 DB로 대체하지 않는다.
- 테스트별 준비 데이터의 롤백·직접 정리 규칙은 그대로 유지한다. JVM 강제 종료·MySQL 중단으로 자동 정리가 불가능하면 남은 임시 DB 이름을 확인해 보고하고, 개발 DB·볼륨은 삭제하지 않는다.
- 인증은 `@WithMockUser`가 동작하지 않으므로 `JwtTokenProvider`로 발급한 실제 토큰을 헤더로 보낸다.
- 검증용 엔드포인트가 필요하면 테스트 안의 `@TestConfiguration` 컨트롤러를 쓴다.
- 테스트 계획은 사용자가 도메인의 `docs/TEST.md`에 작성한다. Codex는 계획의 테스트 클래스명, 검증 항목, 실행 순서를 그대로 따라 테스트를 작성하고 실행한다. 계획에 없는 케이스를 추가하거나 계획이 모호하면 사용자에게 먼저 묻는다.
- 실행 후 `TEST.md`의 사용자 계획 내용은 지우거나 바꾸지 않고, 상태/실행일/전체 결과, 클래스별 결과 표(`## 결과`), 발견/수정 사항(`## 발견하고 수정한 점`)만 실제 결과로 갱신한다. 계획과 다르게 구현한 점(케이스 병합·분리 등)도 발견/수정 사항에 적는다.
- 계획 없이 테스트를 요청받으면 `TEST.md`를 위 형식(진행 방식 표, 클래스별 결과 표, 발견/수정 사항)으로 간결하게 작성한다. 실행 방법은 적지 않는다.
