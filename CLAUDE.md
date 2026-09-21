# server-spring

제주 관광 미션/방명록 서비스 백엔드. Spring Boot 4.1.1 / Java 21 / MySQL 8.4 / Flyway.

## ⚠️ 터미널에서 빌드할 때는 JAVA_HOME을 반드시 지정할 것

이 PC의 사용자 환경변수 `JAVA_HOME`은 **JDK 8**(`C:\Program Files\Eclipse Adoptium\jdk-8.0.504.1-hotspot`)을 가리키고 있다.
`./mvnw`는 `JAVA_HOME`을 읽어서 JDK를 고르기 때문에, 그냥 실행하면 javac 8로 컴파일되어
`record` 같은 문법에서 `class, interface, or enum expected` 에러가 난다.

**항상 이렇게 실행한다:**

```bash
JAVA_HOME="C:\Users\USER\.jdks\ms-21.0.12.1-1" ./mvnw test
JAVA_HOME="C:\Users\USER\.jdks\ms-21.0.12.1-1" ./mvnw compile
JAVA_HOME="C:\Users\USER\.jdks\ms-21.0.12.1-1" ./mvnw clean package
```

- 환경변수 자체는 **고치지 않기로 했다.** (JDK 8을 쓰는 다른 프로젝트가 있을 수 있어서)
- IntelliJ는 `JAVA_HOME`을 보지 않고 Maven Runner에 지정된 JDK 21을 쓰므로 IDE에서는 문제없다.
- Docker 빌드도 컨테이너 안의 `maven:3.9-eclipse-temurin-21`을 쓰므로 영향 없다.
- `-o`(오프라인) 옵션은 쓰지 말 것. surefire / spring-boot-maven-plugin 의존성이 로컬 `.m2`에 없어서 실패한다.

## 실행 / 검증

MySQL은 Docker로 띄운다. 앱까지 같이 올라간다.

```bash
docker compose up -d          # mysql(3306) + app(8080)
docker compose ps
```

엔티티 매핑이 스키마와 맞는지 확인하려면, 컨테이너 MySQL을 띄운 상태에서 컨텍스트 로딩 테스트를 돌린다
(`ddl-auto: validate`라서 매핑이 틀리면 컨텍스트 로딩이 실패한다):

```bash
JAVA_HOME="C:\Users\USER\.jdks\ms-21.0.12.1-1" \
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DATABASE=tour \
MYSQL_USER=tour MYSQL_PASSWORD=tour_password \
./mvnw test
```

## 스키마

- **스키마의 단일 출처는 `src/main/resources/db/migration/*.sql` (Flyway)이다.** V1이 전체 39개 테이블의 DDL.
- `spring.jpa.hibernate.ddl-auto: validate` — Hibernate는 스키마를 절대 바꾸지 않는다.
  엔티티를 고치려면 **반드시 새 마이그레이션(V2, V3…)을 같이 추가**해야 하고, 그러지 않으면 부팅이 실패한다.
- 물리 네이밍 전략은 `CamelCaseToUnderscoresNamingStrategy`.

## 엔티티 규칙

`src/main/java/com/jamkkanjeju/server/<도메인>/entity/` 아래에 둔다.
도메인: `user`, `onboarding`, `location`, `character`, `reward`, `guestbook`, `mission/{common,culture,cooperative,treasure}`

- `common/persistence/BaseTimeEntity`를 상속해 `created_at`/`updated_at`을 얻는다
  (예외: `guestbook_like`는 `updated_at`이 없어서 상속하지 않음).
- `@Getter` + `@NoArgsConstructor(access = PROTECTED)`, 생성은 `@Builder`로. Setter는 만들지 않는다.
- 연관관계는 전부 `FetchType.LAZY`. 컬렉션(`@OneToMany`)은 필요할 때만 추가한다.
- PK를 공유하는 테이블(`culture_mission`↔`mission`, `road_guestbook`↔`guestbook` 등)은 `@MapsId` + `@OneToOne`.
- 복합 PK는 `@EmbeddedId` + `@MapsId`, ID 클래스는 같은 패키지에 `~Id`로 둔다.
- JSON 컬럼은 `@JdbcTypeCode(SqlTypes.JSON)`. `CHAR(n)` 컬럼은 `@JdbcTypeCode(SqlTypes.CHAR)`를 써야 validate를 통과한다.
- DDL에 `CHECK ... IN (...)`으로 허용값이 못 박힌 컬럼만 enum(`@Enumerated(STRING)`)으로 매핑한다.
  제약이 없는 VARCHAR(`location.category`, `guestbook.status` 등)는 아직 `String`이다.
