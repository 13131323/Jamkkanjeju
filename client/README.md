# tamnalog client

pnpm 모노레포 (web + app)

## 패키지 구조

| 패키지 | 설명          | 기술 스택                        |
| ------ | ------------- | -------------------------------- |
| `web/` | 웹 프론트엔드 | Next.js, React 19, TailwindCSS 4 |
| `app/` | 모바일 앱 | React Native, Expo 56 |

## 로컬 Docker 실행

Docker Desktop을 실행하고 백엔드를 `http://localhost:8080`에 먼저 띄웁니다.
백엔드는 `DEV_AUTH_ENABLED=true`와 1번 사용자 데이터가 준비되어 있어야 합니다.

```powershell
cd D:\tour\jamkkanjeju\client
docker compose up -d --build
```

브라우저에서 <http://localhost:3000>에 접속합니다. 이 Compose는 Next.js 웹 서버만 실행하며,
백엔드·MySQL은 백엔드의 Compose로 별도로 실행합니다. React Native 앱은 이 이미지에 포함되지 않습니다.

| 설정 | 값 |
| --- | --- |
| 웹 포트 | `3000` |
| 백엔드 주소 | `http://host.docker.internal:8080` |
| 브라우저 API 프록시 | `/backend-api` |
| 카카오 지도 키 | `compose.yaml`의 `NEXT_PUBLIC_KAKAO_MAP_KEY` |
| 심사위원 모드 코드 | `12345A` (소문자 입력도 가능) |

일반·심사위원 모드 모두 인증 헤더 없이 요청합니다. 심사위원 모드를 켜면 기존 제주시청 고정 좌표를 사용합니다.
홈 조회만 `/api/v2/users/me/home`을 호출하고, 나머지 API는 기존 경로를 유지합니다.
브라우저의 `/backend-api` 요청은 Next.js가 백엔드로 전달하므로 컨테이너 내부 주소를 브라우저가 직접 호출하지 않습니다.

```powershell
# 로그 확인
docker compose logs -f web

# 코드나 빌드 환경변수 변경 후 재빌드
docker compose up -d --build

# 클라이언트 중지
docker compose down
```

`NEXT_PUBLIC_*` 값은 빌드 시 반영되므로 `compose.yaml`에서 값을 바꾸면 다시 빌드해야 합니다.

## 웹 배포 서버

- 접속 URL: <https://jankkan-jeju-web.azurewebsites.net>
- 배포 대상: `web/`의 Next.js 서버
- 컨테이너 포트: `3000`

`app/` 모바일 클라이언트는 웹 배포 이미지에 포함되지 않습니다.

### 배포 흐름

`main` 브랜치에 웹 관련 변경사항을 푸시하면 [Deploy Web](https://github.com/TamnaLog/client/actions/workflows/deploy-web.yml) GitHub Actions가 실행됩니다.

```text
web/Dockerfile로 이미지 빌드
→ jankkanjejuacr.azurecr.io/jamkkan-jeju-web에 이미지 업로드
→ jankkan-jeju-web App Service에 새 이미지 적용(커밋 SHA 태그라 적용 시점에 컨테이너가 새로 뜸)
→ 배포 URL 응답 확인
```

이미지 태그가 커밋 SHA라 배포마다 참조가 실제로 바뀌므로 별도의 `az webapp restart`는
호출하지 않습니다. 재시작을 덧붙이면 이미 재시작 중인 사이트를 한 번 더 재시작시키는 것이라
ARM 쓰기 요청만 늘고, 구독 단위 스로틀링(429 Too Many Requests)에 걸리기 쉬워집니다.

### 구성된 배포 리소스

| 구분 | 값 |
| --- | --- |
| Azure 리소스 그룹 | `jankkan-jeju-rg` |
| App Service Plan | `jankkan-jeju-plan` |
| Web App | `jankkan-jeju-web` |
| ACR | `jankkanjejuacr.azurecr.io` |
| 이미지 | `jamkkan-jeju-web` |
| 백엔드 API | `https://jankkan-jeju.azurewebsites.net` |

백엔드와 웹은 같은 App Service Plan과 ACR을 사용하며, 각각 별도의 Web App과 이미지로 배포됩니다.

### 등록된 GitHub Actions 설정

[Repository Actions settings](https://github.com/TamnaLog/client/settings/secrets/actions)에 다음 항목이 등록되어 있습니다.

- Variable: `NEXT_PUBLIC_API_BASE_URL`
- Secrets: `ACR_USERNAME`, `ACR_PASSWORD`, `AZURE_CREDENTIALS`

Secret 값은 GitHub에서 다시 확인할 수 없으며, 변경할 때는 새 값으로 덮어써야 합니다.
