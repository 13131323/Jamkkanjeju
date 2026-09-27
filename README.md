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

또한 테스트용 mockup 데이터는 scripts/data_init.sql 파일에 정의되어 있습니다.


MySQL CLI를 종료하려면 아래 명령어를 입력합니다.

```sql
exit;
```
