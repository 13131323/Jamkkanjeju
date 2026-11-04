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
