# Jamkkanjeju Server

## 필수 환경변수

애플리케이션 실행 전 JWT 서명에 사용할 32바이트 이상의 키를 Base64로 인코딩하여 `JWT_SECRET_KEY` 환경변수에 설정해야 합니다.

```bash
openssl rand -base64 32
```

생성한 값은 로컬 환경변수 또는 프로젝트 루트의 `.env` 파일에 다음과 같이 설정합니다. 실제 비밀키는 Git에 커밋하지 않습니다.

```dotenv
JWT_SECRET_KEY=생성한_Base64_문자열
```


## OpenAI 클라이언트 설정

백엔드 `.env`의 `OPENAI_ENABLED=true`로 기능을 켜고 `false`로 끕니다. 키가 있어도 false이면 외부 호출을 차단합니다. Compose에 전달되는 설정이므로 변경 후 app 컨테이너를 다시 생성해야 반영됩니다.

```dotenv
OPENAI_ENABLED=true
OPENAI_API_KEY=직접_설정한_키
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_IMAGE_GENERATION_MODEL=gpt-image-2
```

`OpenAiClient.isEnabled()`로 AI 처리와 추후 대체 동작을 분기할 수 있습니다. `editImage(prompt, images)`는 검증된 참조 이미지들을 FastAPI와 같은 이미지 편집 API로 보내고 세로형 PNG 한 장을 반환합니다. 프롬프트 구성·엽서 저장 API·비활성 대체 화면은 별도 작업입니다. 키는 Git에 포함되지 않는 `.env`에만 넣고 프론트 환경변수에 넣지 않습니다.

연결 대기는 5초, 응답 대기는 120초로 `application.yaml`에 고정되어 있습니다.

요청 형식은 [OpenAI 이미지 편집 API 문서](https://developers.openai.com/api/reference/resources/images/methods/edit)를 따릅니다.

## 1. Docker 실행 방법
프로젝트 루트 디렉터리에서 아래 명령어를 실행합니다.
(docker desktop 설치를 추천합니다.)

### 이미지 빌드

```bash
docker compose build
```
빌드는 최초 1회만 실시합니다.

### 컨테이너 실행

```bash
docker compose up 
# 백그라운드 실행은 docker compose up -d
```
빌드한 이미지를 사용해서 mysql과 app 컨테이너를 실행합니다.

### 애플리케이션 로그 확인

```bash
docker compose logs -f app
# 전체 로그 확인은 docker compose logs -f
```
실행 중인 app 컨테이너의 로그를 확인합니다.

### 컨테이너 종료

```bash
docker compose down
# volume까지 삭제하려면 docker compose down -v
```

## 2. mysql 접속 방법

MySQL 컨테이너가 실행 중인 상태에서 프로젝트 루트 디렉터리에서 아래 명령어를 실행합니다.

```bash
docker compose exec mysql mysql -utour -p tour
```

비밀번호 입력 메시지가 나오면 기본 비밀번호인 `tour_password`를 입력합니다.
`.env` 또는 환경 변수로 `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`를 변경했다면 변경한 값을 사용해야 합니다.

root 계정으로 접속하려면 아래 명령어를 사용합니다.

```bash
docker compose exec mysql mysql -uroot -p tour
```

root 계정의 기본 비밀번호는 `root_password`입니다.

접속 후 데이터베이스와 테이블을 확인할 수 있습니다.

```sql
SELECT DATABASE();
SHOW TABLES;
```

기본 데이터(온보딩 기준 데이터, 미션 등)는 Flyway 마이그레이션 src/main/resources/db/migration/V2__insert_initial_data.sql로 앱 실행 시 자동으로 들어갑니다.


MySQL CLI를 종료하려면 아래 명령어를 입력합니다.

```sql
exit;
```


## 에이전트 장소 조회·점검 예약

- `GET /api/v2/agent/locations?page=0&size=100`
- `X-Agent-Token` 헤더에 `.env`의 `AGENT_API_TOKEN` 원문을 전달합니다. 사용자 로그인이나 Bearer 접두사는 필요하지 않습니다.
- Python Tool의 환경변수도 같은 이름·값을 사용합니다. 로컬 두 프로젝트에 같은 난수 키를 설정했습니다. `.env.example`에는 키 원문을 넣지 않습니다.
- 키가 비어 있으면 에이전트 요청을 거부합니다. 정상 키도 명시한 에이전트 장소 조회·점검 예약 API에만 접근할 수 있으며 일반 API는 기존 JWT 인증을 유지합니다.
- 키를 교체하면 Python 설정도 바꾸고 Spring을 재시작합니다. Docker Compose에서도 해당 환경변수를 전달합니다.
- 장소 ID순으로 한 페이지를 조회합니다. `size`는 1~100, 다음 페이지 여부는 `locationsPage.hasNext`입니다. 조회만 수행하며 데이터는 변경하지 않습니다.
- 명세와 내부 규칙·검증 결과는 `domain/agent/docs`에 기록합니다.

- `POST /api/v2/agent/maintenances`: 같은 `X-Agent-Token`으로 점검 예약을 생성합니다. JSON 본문은 `{"message":"공지 문구"}`이며 `{}`·null/빈 문구에는 기본 공지를 사용합니다.
- `startsAt`을 지정하면 그 KST 시각, 생략·null이면 서버 시각 1시간 뒤에 시작하며 시작 1시간 뒤 종료 예정인 `SCHEDULED` 예약을 저장하고 `201`과 `maintenanceId`, `message`, `startsAt`, `endsAt`, `status`를 반환합니다.
- 예약 API는 저장만 처리합니다. 점검 상태는 1초 간격 스케줄러와 API 요청 시 갱신하며 점검 시간 동안 일반 API를 503으로 차단합니다. 홈 GET·로그인 POST·토큰 재발급 POST와 기존 인증을 거친 에이전트 API는 허용합니다. 종료 예정 시각에는 차단을 해제합니다. 장소 동기화는 직접 실행해야 합니다.
