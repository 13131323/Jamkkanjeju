# tamnalog client

pnpm 모노레포 (web + app)

## 패키지 구조

| 패키지 | 설명          | 기술 스택                        |
| ------ | ------------- | -------------------------------- |
| `web/` | 웹 프론트엔드 | Next.js, React 19, TailwindCSS 4 |
| `app/` | 모바일 앱 | React Native, Expo 56 |

## 사전 요구사항

- Node.js 20+
- pnpm 10+
- Android 실기기 개발: Android SDK Platform-Tools, USB 디버깅을 허용한 기기

```bash
npm install -g pnpm
```

## 설치

```bash
pnpm install
```

## 실행

```bash
# 웹 개발 서버
pnpm dev:web

# Android 실기기: Next.js + Expo 개발 빌드 동시 실행
pnpm dev:app

# 여러 실기기가 연결된 경우
pnpm dev:app -- --device <adb-serial>
```

`dev:app`은 실기기에 `8081`(Metro)과 `3000`(Next.js)을 USB로 전달합니다.
따라서 PC와 휴대폰이 같은 Wi-Fi에 연결되어 있지 않아도 됩니다. 최초 실행은 Android
개발 빌드를 컴파일하므로 시간이 걸릴 수 있습니다. 팀원별 PC IP나 `.env` 설정은 필요하지 않습니다.

## 빌드

```bash
# 웹 프로덕션 빌드
pnpm build:web

# 앱 Android 빌드 (EAS)
pnpm build:app
```

Google Play용 production 빌드는 EAS production 환경에 공개 HTTPS 도메인을
`EXPO_PUBLIC_WEB_URL`로 등록해야 합니다. 값이 없거나 localhost·IP 주소이면 빌드가
중단되며, 개발용 `127.0.0.1`은 production에 포함되지 않습니다.

## 기타

```bash
# 전체 린트
pnpm lint

# 전체 타입 검사
pnpm typecheck
```

각 패키지의 상세 실행 방법은 [web/README.md](./web/README.md), [app/README.md](./app/README.md)를 참고하세요.

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
