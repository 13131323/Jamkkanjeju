# app

React Native 모바일 앱 (Expo)

## 사전 요구사항

- Node.js 20+
- pnpm 10+
- Android: Android Studio, SDK Platform-Tools, USB 디버깅을 허용한 실기기
- iOS: Xcode (macOS 전용)

> **Expo Go 사용 불가**
> `@sentry/react-native`, `react-native-view-shot`, `react-native-step-counter-newarch` 등
> 커스텀 네이티브 모듈이 포함되어 있어 반드시 네이티브 빌드 방식으로 실행해야 합니다.

## 설치

```bash
# client/ 루트에서 실행
pnpm install
```

`.env.example`을 `.env`로 복사하고 값을 채웁니다. 개발 실행에는 **`EXPO_PUBLIC_DEV_WEB_URL`이
반드시 필요합니다** — WebView가 로드할 web 주소이며, 코드에 기본값을 두지 않습니다.

| 환경                        | 값                      |
| --------------------------- | ----------------------- |
| Android 에뮬레이터          | `http://10.0.2.2:3000`  |
| USB 실기기 (`pnpm dev:app`) | `http://127.0.0.1:3000` |

`pnpm dev:app`은 이 값 하나에서 adb reverse 포트와 Next.js dev 서버 포트까지 함께 맞춥니다.

## 실행

루트의 실기기 명령은 연결된 기기를 자동 선택하고 Next.js와 Expo를 함께 실행합니다.
네이티브 의존성이나 `app.json`을 바꾼 경우에만 `pnpm prebuild --clean`으로 네이티브
프로젝트를 다시 생성하면 됩니다.

```bash
# Android 실기기 (client/ 루트에서 권장)
pnpm dev:app

# 여러 실기기가 연결된 경우
pnpm dev:app -- --device <adb-serial>

# app/에서 같은 실기기 실행기 사용
pnpm android:device

# Android 에뮬레이터용 기존 흐름
pnpm android

# iOS (시뮬레이터 또는 USB 연결 실기기, macOS 전용)
pnpm ios
```

## 빌드 (EAS)

### 환경변수

production 환경에는 아래 값이 등록되어 있습니다(`eas env:list --environment production`으로 확인).

| 변수                     | 값                                           |
| ------------------------ | -------------------------------------------- |
| `EXPO_PUBLIC_WEB_URL`    | `https://jankkan-jeju-web.azurewebsites.net` |
| `EXPO_PUBLIC_API_URL`    | 백엔드 주소                                  |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN                                   |

`EXPO_PUBLIC_WEB_URL`은 **공개 HTTPS 도메인만** 허용됩니다. localhost·IP·http를 넣으면
`app.config.ts`가 설정 검증 단계에서 빌드를 중단시킵니다.

> **로컬 `.env`에 `EXPO_PUBLIC_WEB_URL`을 두지 마세요.**
> Expo CLI가 `.env`를 함께 읽기 때문에, dev 주소가 들어 있으면 production 빌드의
> `expo config --json` 평가가 실패합니다(`exited with non-zero code: 1`).
> 개발용 주소는 `EXPO_PUBLIC_DEV_WEB_URL`에 둡니다.

빌드 스크립트는 `eas env:exec <환경>`으로 감싸져 있습니다. EAS는 빌드 전 **로컬에서**
`expo config --json`을 평가하는데 그 단계에는 EAS 등록값이 내려오지 않아서, `env:exec`로
등록값을 로컬 프로세스에 주입해야 검증을 통과합니다.

### 스크립트

| 명령어               | 프로필           | 산출물  | 용도                          |
| -------------------- | ---------------- | ------- | ----------------------------- |
| `pnpm build:store`   | `production`     | **AAB** | 원스토어·구글플레이 제출      |
| `pnpm build:apk`     | `production-apk` | APK     | 실기기 사이드로드 QA          |
| `pnpm build:preview` | `preview`        | APK     | 내부 배포                     |
| `pnpm build:android` | —                | —       | `build:store` 별칭(하위 호환) |

구글플레이는 신규 앱에 AAB가 **필수**이고 원스토어도 AAB를 받으므로, 스토어 제출은
`build:store` 하나로 두 스토어를 모두 커버합니다. AAB는 기기에 직접 설치할 수 없어
실기기 확인용으로만 `build:apk`를 씁니다.

`versionCode`는 `eas.json`의 `cli.appVersionSource: "remote"`로 EAS가 관리하며,
`production` 프로필의 `autoIncrement`가 스토어 빌드마다 자동으로 올립니다.
`build:apk`는 QA용이라 카운터를 올리지 않습니다.

### 서명키

EAS가 관리하는 원격 키스토어를 씁니다(`production` 프로필의 `credentialsSource: "remote"`).
`com.tamnalog.app`용 키스토어는 이미 생성되어 있으며 **절대 교체하지 않습니다** —
서명이 바뀌면 두 스토어 모두 기존 사용자에게 업데이트를 내보낼 수 없습니다.

| 항목    | 값                                                                 |
| ------- | ------------------------------------------------------------------ |
| 패키지  | `com.tamnalog.app`                                                 |
| 형식    | JKS (EAS 관리)                                                     |
| SHA-1   | `471aeacd425321f2b0c8d4e3776c6e4e2fea8970`                         |
| SHA-256 | `d0f78f18d85348713d64c22b0290b6eadaad8492c028949b8bf178fbc093264e` |

빌드된 APK의 서명이 위와 같은지 확인하려면:

```bash
keytool -printcert -jarfile <받은파일.apk>
```

> **키스토어를 반드시 백업하세요.**
> 구글플레이는 Play App Signing이 앱 서명 키를 대신 보관하지만, **원스토어는 그런 장치가 없어
> 이 키스토어가 곧 앱 서명 키**입니다. 잃어버리면 같은 패키지명으로 업데이트를 올릴 수 없습니다.
>
> ```bash
> eas credentials --platform android   # Keystore → Download
> ```

### APK를 실기기에 설치

```bash
pnpm exec eas build:run -p android --latest
```

USB 디버깅을 켜고 연결하면 다운로드·설치까지 처리합니다.

`development`/`preview` 빌드는 `app.config.ts`에서 패키지명에 `.dev`/`.preview`가 붙어
정식 배포 앱(`com.tamnalog.app`)과 별도로 공존합니다. 단, `production-apk`(`pnpm build:apk`)는
패키지명이 정식 배포 앱과 같은 `com.tamnalog.app`이라 **스토어에서 받은 앱(구글플레이가
재서명한 키)이 깔려 있으면 서명이 달라 설치가 실패**합니다(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
먼저 지웁니다.

```bash
"$ANDROID_HOME/platform-tools/adb.exe" uninstall com.tamnalog.app
```

## 명령어

| 명령어                | 설명                                    |
| --------------------- | --------------------------------------- |
| `pnpm android:device` | 실기기에서 Next.js + Expo 실행          |
| `pnpm android`        | prebuild 후 Android 실행                |
| `pnpm ios`            | prebuild 후 iOS 실행                    |
| `pnpm prebuild`       | 네이티브 코드만 생성 (android/, ios/)   |
| `pnpm build:store`    | 스토어 제출용 AAB 빌드 (위 "빌드" 참고) |
| `pnpm build:apk`      | 실기기 QA용 APK 빌드                    |
| `pnpm generate`       | Orval로 API 클라이언트 코드 생성        |
| `pnpm lint`           | ESLint 검사                             |
| `pnpm typecheck`      | TypeScript 타입 검사                    |

## 실기기 연결 문제

- `unauthorized`: 휴대폰 화면의 USB 디버깅 허용 팝업을 승인합니다.
- `offline`: 케이블을 다시 연결하고 `adb devices -l`을 확인합니다.
- 여러 기기: 오류에 표시된 시리얼을 `--device`로 지정합니다.
- 에뮬레이터만 표시됨: USB 연결 모드를 확인하고 개발자 옵션의 USB 디버깅을 켭니다.

실행기는 `ANDROID_HOME`, `ANDROID_SDK_ROOT`, PATH 순서로 ADB를 찾습니다. 개인 IP나
`.env` 파일은 필요하지 않으며 WebView는 USB reverse를 통해 `127.0.0.1:3000`에 접속합니다.
이 주소는 각 기기에서 해당 팀원의 PC로 reverse되므로 저장소를 pull한 팀원도 변경 없이 사용할 수 있습니다.
