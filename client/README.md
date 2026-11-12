# tamnalog client

pnpm 모노레포 (web + app)

## 패키지 구조

| 패키지 | 설명          | 기술 스택                        |
| ------ | ------------- | -------------------------------- |
| `web/` | 웹 프론트엔드 | Next.js, React 19, TailwindCSS 4 |
| `app/` | 모바일 앱 | React Native, Expo 56 |

## 로컬 Docker 실행

Docker Desktop을 실행하고 백엔드를 `http://localhost:8080`에 먼저 띄웁니다.
백엔드는 `DEV_AUTH_ENABLED=false`로 실행합니다. Flyway V2 초기 데이터에 관리자 계정(사용자 ID 4)이 포함되어 있습니다.

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

처음 접속하면 로그인 화면이 표시됩니다. 관리자 아이디는 `admin`, 비밀번호는 `12345678`입니다.
기존 일반 계정은 이메일로 로그인합니다. 로그인 후 웹·앱 모두 실제 JWT를 Authorization 헤더에 첨부합니다.
앱은 로그인 응답의 리프레시 토큰을 Expo SecureStore에 저장하고, SQLite에는 액세스 토큰·사용자 정보·만료 시각만 저장합니다.
일반 웹은 Next.js의 `/api/auth/login`을 통해 로그인하고, 리프레시 토큰은 HttpOnly·SameSite=Strict 쿠키로만 보관합니다(HTTPS에서는 Secure 적용).
앱 안의 Next.js 화면에는 리프레시 토큰을 전달하지 않습니다. WebView가 만료 응답을 받으면 앱에 재발급을 요청합니다.
`401 EXPIRED_TOKEN`을 받으면 `/api/v2/auth/refresh`로 두 토큰을 교체한 뒤 원래 요청을 한 번만 재시도합니다.
동시 요청은 하나의 재발급 결과를 공유하고, 일반 웹은 지원되는 브라우저에서 Web Locks로 탭 사이의 쿠키 회전도 직렬화합니다.
재발급 인증 실패(401·403)는 세션을 지우고 로그인 화면으로 돌아가며, 통신 오류·서버 오류는 세션을 유지합니다.

`expo-secure-store` 네이티브 모듈과 플러그인이 추가되어 기존 앱 개발 빌드는 한 번 재빌드해야 합니다. 기존 로그인에는 저장한 리프레시 토큰이 없으므로 업데이트 후 다시 로그인해야 합니다.

관리자만 센서 GPS에 `제주시청 − 서울시청` 차이를 적용합니다. 일반 사용자의 GPS는 그대로 사용합니다.
기준점은 서울시청 `(37.5665, 126.9780)`, 제주시청 `(33.4996, 126.5312)`이며 관리자도 위치 권한이 필요합니다.
앱이 변환한 좌표를 WebView에 전달하므로 웹에서 이중으로 변환하지 않습니다.
기존 심사위원 코드·고정 좌표·가짜 토큰·자동 접근 및 팀원 시뮬레이션 진입은 제거했습니다.

앱 로컬 `.env`는 Android 에뮬레이터 기준으로 API `http://10.0.2.2:8080`, 웹 `http://10.0.2.2:3000`을 사용합니다.
웹 로컬 `.env.local`은 API `http://localhost:8080`과 `/backend-api` 프록시를 사용합니다.
환경변수를 바꾼 경우 Metro·Next.js 개발 서버를 재시작합니다. USB 실기기는 `.env.example`의 안내대로 주소와 포트 포워딩을 맞춥니다.
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


## 자동 재발급 연결 검증 (2026-11-12)

- 관련 프론트 테스트 64개 통과: 브라우저 인증 중계·쿠키·출처 검증 9개, 웹 재발급 6개, 웹 API 재시도 3개, 앱 인증·세션·API 클라이언트·주입 스크립트 40개, SecureStore·WebView 재발급 6개.
- 웹·앱 타입 검사 통과. 전체 백엔드 테스트는 실행하지 않습니다.
- 실제 휴대폰·에뮬레이터에서 SecureStore 네이티브 저장과 앱 실행은 별도 기기 검증이 필요합니다.
- 로컬 실제 HTTP 확인: 브라우저 로그인 200·HttpOnly 쿠키 발급·응답 JSON에서 리프레시 토큰 제외, 쿠키 기반 재발급 200·쿠키 회전, 새 액세스 토큰 홈 조회 200, 사용한 리프레시 토큰 재사용 401, 다른 출처 재발급 요청 403 확인.
- 로컬 Spring·Next.js 컨테이너에 반영 완료. 기존 Flyway 체크섬을 확인하고 DB·볼륨 초기화 없이 재빌드했다.
