# Jamkkanjeju Server

## 1. Docker 실행 방법
프로젝트 루트 디렉터리에서 아래 명령어를 실행합니다.

### 이미지 빌드

```bash
docker compose build
```

### 컨테이너 실행

```bash
docker compose up 
# 백그라운드 실행은 docker compose up -d
```

### 애플리케이션 로그 확인

```bash
docker compose logs -f app
# 전체 로그 확인은 docker compose logs -f
```

### 컨테이너 종료

```bash
docker compose down
# volume까지 삭제하려면 docker compose down -v
```
