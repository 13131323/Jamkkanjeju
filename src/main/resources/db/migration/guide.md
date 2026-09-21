좋아. 지금 네 프로젝트를 기준으로 **Flyway를 처음 도입하는 과정부터, 이후 DDL을 수정할 때 어떻게 사용하는지까지** 순서대로 설명할게.

현재 환경은 다음과 같다고 가정할게.

- Spring Boot + Spring Data JPA + Maven
- MySQL 8.4
- Docker Compose로 MySQL 실행
- 기존 `scripts/schema.sql`에 전체 DDL 작성
- `scripts/data_init.sql`에 목데이터 작성
- MySQL 데이터는 Docker 볼륨 `mysql-data`에 저장

핵심은 **DB 테이블 생성·변경은 Flyway가 담당하고, Docker는 MySQL 실행만 담당하도록 역할을 분리하는 것**이야.

---

# 1. Flyway 도입 후 전체 구조

현재는 이런 방식이지.

```text
Docker Compose 실행
       ↓
MySQL 컨테이너 실행
       ↓
schema.sql 실행
       ↓
data_init.sql 실행
       ↓
Spring Boot 실행
```

다만 Docker의 초기화 SQL은 **MySQL 데이터 디렉터리가 비어 있을 때만 실행돼.**

그래서 테이블 구조가 변경되더라도 기존 볼륨이 존재하면 `schema.sql`이 다시 실행되지 않아.

Flyway를 도입하면 다음과 같이 바뀌어.

```text
Docker Compose 실행
       ↓
MySQL 컨테이너 실행
       ↓
Spring Boot 실행
       ↓
Flyway가 DB 버전 확인
       ↓
적용되지 않은 SQL 실행
       ↓
JPA 엔티티 검증
       ↓
애플리케이션 실행
```

Flyway는 DB에 마이그레이션 이력을 저장하고 아직 적용되지 않은 버전만 실행해. :chatgpt-content-reference{index="0"}

---

# 2. Docker Compose 수정

기존 MySQL 설정에서 SQL 파일 마운트는 제거해.

### 변경 전

```yaml
services:
  mysql:
    image: mysql:8.4

    volumes:
      - mysql-data:/var/lib/mysql
      - ./scripts/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql:ro
      - ./scripts/data_init.sql:/docker-entrypoint-initdb.d/02_data_init.sql:ro

volumes:
  mysql-data:
```

### 변경 후

```yaml
services:
  mysql:
    image: mysql:8.4

    volumes:
      - mysql-data:/var/lib/mysql

volumes:
  mysql-data:
```

**`mysql-data:/var/lib/mysql`은 절대 제거하지 마.** 이 볼륨이 실제 MySQL 데이터를 저장하는 곳이야.

나머지 환경 변수, 포트, healthcheck 등 기존 설정도 그대로 유지하면 돼.

---

# 3. pom.xml에 Flyway 의존성 추가

Spring Boot 프로젝트의 `pom.xml`에 추가해.

```xml
<!-- Flyway -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- MySQL 지원 -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

기존 MySQL JDBC 의존성도 있어야 해.

```xml
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

Spring Boot의 의존성 관리를 사용하고 있다면 일반적으로 별도의 버전을 지정하지 않아도 돼.

추가 후 IntelliJ에서 Maven 프로젝트를 Reload하면 돼.

---

# 4. 마이그레이션 폴더 생성

기존 `scripts/schema.sql`을 다음 위치로 옮겨서 최초 마이그레이션 파일을 만들어.

```text
server-spring/
│
├── pom.xml
├── compose.yaml
│
├── scripts/
│   └── data_init.sql
│
└── src/
    └── main/
        └── resources/
            ├── application.yml
            │
            └── db/
                └── migration/
                    └── V1__initial_schema.sql
```

**파일 이름은 반드시 다음 규칙을 따라야 해.**

```text
V1__initial_schema.sql
```

`V1`과 `initial` 사이에는 언더스코어가 2개야.

기본적인 버전 관리 예시는 다음과 같아.

```text
V1__initial_schema.sql
V2__add_guestbook_check.sql
V3__add_guestbook_trigger.sql
V4__add_mission_column.sql
```

버전 번호를 순서대로 증가시키면 돼.

---

# 5. V1__initial_schema.sql 수정

기존 `schema.sql` 전체를 복사하되, 아래 부분은 제거해.

```sql
DROP DATABASE IF EXISTS tour;

CREATE DATABASE tour
CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

USE tour;
```

Flyway는 Spring Boot의 데이터베이스 연결 설정을 사용하므로 이미 `tour` DB에 접속한 상태에서 SQL을 실행해.

따라서 다음부터 시작하도록 만들면 돼.

```sql
CREATE TABLE `onboarding_result` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    ...
);
```

그리고 나머지 테이블 생성문, FK, UNIQUE, CHECK 등은 유지해.

**주의:** V1에 현재 최신 DDL의 CHECK나 트리거가 이미 포함되어 있다면 이후 버전에서 동일한 내용을 다시 생성할 필요는 없어.

---

# 6. application.yml 설정

이 부분이 실제 Flyway를 활성화하는 설정이야.

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/tour
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver

  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: false

  jpa:
    hibernate:
      ddl-auto: validate
```

기존에 환경 변수로 DB 접속 정보를 관리하고 있다면 `datasource`는 그대로 두고 `flyway`, `jpa` 부분만 추가하면 돼.

각 설정의 의미는 다음과 같아.

| 설정 | 의미 |
|---|---|
| `flyway.enabled: true` | Flyway 활성화 |
| `flyway.locations` | 마이그레이션 SQL 파일 위치 |
| `baseline-on-migrate: false` | 기존 DB를 자동으로 마이그레이션 완료 상태로 표시하지 않음 |
| `ddl-auto: validate` | Hibernate가 테이블을 수정하지 않고 엔티티와 DB 구조를 검증 |

특히 중요한 건 다음 설정이야.

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

Flyway를 사용할 때는 Hibernate의 `update`와 함께 스키마를 변경하도록 두지 않는 게 좋아.

**Flyway만 DB 구조를 변경하고, JPA는 만들어진 구조를 검증하도록 역할을 나누는 거야.**

---

# 7. 최초 실행 — 기존 MySQL 볼륨이 있다면 주의

여기가 가장 중요해.

현재 네 Docker MySQL에는 기존 `schema.sql`을 통해 생성된 테이블과 목데이터가 있을 가능성이 높잖아.

이 상태에서 Flyway를 처음 실행하면 기존 스키마가 존재하는데 마이그레이션 이력이 없는 상태라 오류가 발생할 수 있어.

따라서 두 가지 방법 중 하나를 선택해야 해.

## 방법 A. 기존 DB를 초기화하고 Flyway로 다시 생성

**아직 개발 초기이고 기존 데이터를 삭제해도 된다면 이 방법이 가장 단순해.**

먼저 위의 설정을 모두 완료해.

그다음 기존 MySQL 데이터를 초기화해.

```powershell
docker compose down -v
```

⚠️ `-v`는 Compose에서 관리하는 볼륨까지 삭제하므로 기존 DB 데이터가 사라져. 다른 서비스의 볼륨도 함께 삭제될 수 있으니 반드시 Compose 구성을 확인하고 실행해야 해.

다시 MySQL 실행:

```powershell
docker compose up -d mysql
```

MySQL이 준비된 다음 IntelliJ에서 Spring Boot 애플리케이션을 실행하면 돼.

Flyway가 자동으로 다음 작업을 수행해.

```text
tour DB 연결
    ↓
flyway_schema_history 생성
    ↓
V1__initial_schema.sql 실행
    ↓
테이블 생성
    ↓
마이그레이션 성공 기록
    ↓
Spring Boot 실행
```

이 방식에서는 `tour` DB가 MySQL 컨테이너 초기화 과정에서 생성되어 있어야 해. 기존 Compose의 `MYSQL_DATABASE: tour` 설정을 유지하면 돼.

## 방법 B. 기존 DB와 데이터를 그대로 유지

이미 데이터가 중요하다면 삭제하지 않고 Flyway를 도입할 수도 있어.

이때 사용하는 개념이 **Baseline**이야.

현재 DB가 V1 DDL과 동일한 상태임을 확인한 다음, Flyway에 다음과 같이 알려주는 거야.

> 현재 DB는 이미 V1까지 반영되어 있으니 V2부터 실행해.

단, Baseline은 현재 DB 구조가 V1과 실제로 일치하는지 자동으로 확인해서 보증해 주는 기능은 아니야. 기존 DB를 마이그레이션 관리의 시작점으로 등록하는 기능이야. :chatgpt-content-reference{index="1"}

네가 아직 개발 초기라면 **방법 A로 깨끗하게 시작하는 편이 설정을 이해하기 쉬워.**

---

# 8. 최초 실행 성공 여부 확인

IntelliJ에서 Spring Boot를 실행한 다음 DBeaver에서 다음 SQL을 실행해 봐.

```sql
SELECT *
FROM flyway_schema_history;
```

정상적으로 최초 마이그레이션이 적용됐다면 다음과 비슷한 결과가 나와.

| installed_rank | version | description | success |
|---|---|---|---|
| 1 | 1 | initial schema | 1 |

이 테이블이 Flyway의 핵심이야.

**DB가 현재 어떤 마이그레이션까지 적용했는지 기록하는 테이블**이거든.

---

# 9. 나중에 테이블을 수정하려면?

이제부터가 Flyway를 사용하는 실제 방식이야.

예를 들어 나중에 `guestbook`에 새로운 컬럼을 추가하고 싶다고 해보자.

```sql
ALTER TABLE guestbook
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;
```

이 SQL을 DBeaver에서 직접 실행하는 대신 새 마이그레이션 파일에 작성하는 거야.

```text
src/main/resources/db/migration/
│
├── V1__initial_schema.sql
│
└── V2__add_guestbook_is_public.sql
```

V2 내용:

```sql
ALTER TABLE guestbook
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;
```

그리고 Spring Boot를 재실행해.

그러면 Flyway는 다음처럼 판단해.

```text
현재 DB 버전: V1

마이그레이션 폴더:
V1__initial_schema.sql
V2__add_guestbook_is_public.sql

V1 → 이미 적용됨. 건너뜀.
V2 → 아직 적용되지 않음. 실행.
```

이후 DB 이력은 다음과 같아.

| version | description | success |
|---|---|---|
| 1 | initial schema | 1 |
| 2 | add guestbook is public | 1 |

같은 애플리케이션을 여러 번 실행해도 V2가 중복 실행되지 않아.

---

# 10. 반드시 지켜야 할 사용 규칙

Flyway를 도입한 뒤에는 **이미 적용된 V1 파일을 수정하지 않는 것**이 중요해.

예를 들어 처음에는:

```sql
CREATE TABLE guestbook (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    PRIMARY KEY (id)
);
```

이렇게 작성한 V1을 DB에 적용했다고 해보자.

나중에 `status` 컬럼을 추가하고 싶다고 V1을 수정하면 안 돼.

Flyway는 적용된 SQL 파일의 체크섬을 기록하므로 파일이 변경되면 검증 오류가 발생할 수 있어.

대신:

```text
V1__initial_schema.sql
V2__add_guestbook_status.sql
```

V2에 다음처럼 작성하면 돼.

```sql
ALTER TABLE guestbook
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
```

**V1이 아직 어떤 DB에도 적용되지 않은 상태라면 수정해도 괜찮지만, 한 번 적용한 이후에는 새 버전을 추가하는 방식으로 관리하는 거야.**

---

## 최종적으로 네 프로젝트의 사용 흐름

```text
[최초 1회 설정]

1. pom.xml에 Flyway 의존성 추가
2. application.yml에 Flyway 설정
3. Docker Compose에서 SQL 초기화 마운트 제거
4. 현재 schema.sql을 V1__initial_schema.sql로 변경
5. V1에서 DROP DATABASE / CREATE DATABASE / USE 제거
6. 빈 DB 준비
7. Spring Boot 실행
8. Flyway가 V1 자동 적용


[이후 개발 과정]

1. ERD 수정
2. 새로운 마이그레이션 SQL 작성
3. V2__xxx.sql 파일 생성
4. Spring Boot 재실행
5. Flyway가 V2 자동 적용
6. JPA가 DB 구조 검증
```

**네 프로젝트에서 가장 중요한 변화는 앞으로 `schema.sql` 전체를 계속 수정해서 재실행하는 게 아니라, `V1 → V2 → V3`처럼 변경 사항을 누적 관리한다는 점이야.**

이렇게 하면 나중에 Azure MySQL에 배포할 때도 운영 DB의 데이터를 삭제하지 않고 필요한 변경 사항만 적용할 수 있어. 다만 MySQL DDL은 일반적으로 트랜잭션으로 완전히 롤백되지 않으므로, 운영 적용 전에는 백업과 테스트가 필요해.