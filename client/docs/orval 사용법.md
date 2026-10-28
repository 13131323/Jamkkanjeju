# Orval 사용법

## 1. Orval이란?

Orval은 OpenAPI 문서를 읽고 프론트엔드에서 사용할 TypeScript 타입과 API 호출 코드를 자동으로 만드는 코드 생성 도구다.

이 프로젝트의 백엔드는 FastAPI다. FastAPI는 라우터, 요청 모델, 응답 모델을 바탕으로 OpenAPI 문서를 자동 생성한다. Swagger UI인 `/docs`도 이 OpenAPI 문서를 화면으로 보여 주는 도구이며, 실제 JSON 문서는 `/openapi.json`에서 확인할 수 있다.

```text
FastAPI 라우터와 Pydantic 모델
          ↓
      /openapi.json
          ↓
        Orval
          ↓
TypeScript 모델 + Axios 호출 함수 + React Query 훅
```

따라서 Swagger 화면 자체를 분석해서 코드를 만드는 것이 아니다. Orval은 설정에 지정된 서버의 `/openapi.json`을 직접 읽는다.

## 2. 어떤 원리로 동작하는가?

1. 백엔드가 URL, HTTP 메서드, 파라미터, Request/Response 스키마, tag, `operationId`를 OpenAPI JSON으로 제공한다.
2. Orval이 `orval.config.ts`의 `input.target`에서 OpenAPI JSON을 읽는다.
3. OpenAPI tag를 기준으로 API 호출 코드를 도메인별로 나눈다.
4. Request/Response 스키마를 TypeScript 타입으로 변환한다.
5. 이 프로젝트에서 지정한 Axios mutator를 호출하도록 API 함수를 만든다.
6. TanStack React Query에서 사용할 query/mutation 훅을 함께 만든다.

백엔드 계약이 바뀌어도 프론트 파일은 자동으로 실시간 갱신되지 않는다. 변경된 OpenAPI 내용을 프론트에 반영하려면 개발자가 다시 생성 명령을 실행해야 한다.

## 3. 이 프로젝트에서 선택한 구조

### 목표

- FastAPI의 OpenAPI 문서를 기준으로 App과 Web의 API 코드를 반복 가능하게 생성한다.
- Request/Response 모델은 `packages/shared`에 한 벌만 보관한다.
- API 함수와 React Query 훅은 App과 Web에 각각 생성한다.
- App과 Web이 각자의 base URL, 인증, interceptor, 오류 보고 설정을 유지하게 한다.
- 자동 생성 코드와 직접 작성하는 코드를 분리한다.

### 검토했던 선택지

#### App과 Web이 생성물을 각각 모두 소유

구조는 단순하지만 Request/Response 모델이 중복되고 두 플랫폼의 타입이 서로 달라질 가능성이 있다. 공통 계약을 `packages/shared`에서 관리하는 모노레포 방향과 맞지 않아 채택하지 않았다.

#### API 훅까지 모두 shared에서 소유

중복은 가장 적지만 App과 Web의 Axios 설정이 다르다. 플랫폼별 Axios client를 전역 주입하거나 초기화 순서에 의존해야 해서 런타임 결합이 커지므로 채택하지 않았다.

#### 모델은 shared, API 훅은 플랫폼별로 생성

현재 채택한 방식이다. OpenAPI 계약은 한 위치에서 공유하고 App과 Web은 각자의 Axios mutator와 React Query 훅을 유지한다.

### 현재 폴더 구조

```text
client/
├─ packages/shared/src/
│  ├─ api/
│  │  ├─ generated/              # Orval 생성 Request/Response 모델
│  │  ├─ errorCodes.ts           # 직접 작성
│  │  ├─ paths.ts                # 직접 작성
│  │  └─ index.ts
│  └─ domains/
│     └─ <domain>/               # 상태, 상수, mapper, 선별된 공개 타입
├─ app/
│  ├─ orval.config.ts
│  └─ src/services/
│     ├─ api/<domain>/           # App용 API 함수와 React Query 훅
│     └─ client.ts               # App Axios instance와 Orval mutator
└─ web/
   ├─ orval.config.ts
   ├─ src/services/api/<domain>/ # Web용 API 함수와 React Query 훅
   └─ src/shared/api/axios/instance.ts
                                 # Web Axios instance와 Orval mutator
```

App과 Web의 이전 `src/schemas/api` 중복 모델은 제거했다. 공통 생성 모델은 `packages/shared/src/api/generated`에만 둔다.

### 생성 흐름

```text
각 플랫폼 env의 API URL + /openapi.json
          │
          ├─ App Orval ──> app/src/services/api/<domain>
          │             └> packages/shared/src/api/generated
          │
          └─ Web Orval ──> web/src/services/api/<domain>
                        └> packages/shared/src/api/generated
```

두 설정이 같은 shared 경로를 사용하므로 루트 명령은 App 다음 Web 순서로 실행한다. 병렬로 실행하면 같은 파일을 동시에 지우고 쓸 수 있으므로 병렬 생성하지 않는다.

```json
"generate": "pnpm --filter @tamnalog/app generate && pnpm --filter @tamnalog/web generate"
```

## 4. 설정 설명

App 설정은 `app/orval.config.ts`, Web 설정은 `web/orval.config.ts`에 있다.

공통 설정의 의미는 다음과 같다.

| 설정 | 의미 |
| --- | --- |
| `input.target` | OpenAPI JSON 주소 |
| `mode: 'tags-split'` | OpenAPI tag 기준으로 API 파일 분리 |
| `target: 'src/services/api'` | 플랫폼별 API 함수와 훅 출력 위치 |
| `schemas: '../packages/shared/src/api/generated'` | 공통 Request/Response 모델 출력 위치 |
| `clean: true` | 생성 전에 target과 schemas 폴더를 비운 뒤 재생성 |
| `client: 'react-query'` | React Query 훅 생성 |
| `httpClient: 'axios'` | Axios 기반 호출 코드 생성 |
| `override.mutator` | 플랫폼별 Axios client 사용 |

App은 `EXPO_PUBLIC_API_URL`, Web은 `NEXT_PUBLIC_API_BASE_URL`을 읽고 뒤에 `/openapi.json`을 붙인다.

```text
App: EXPO_PUBLIC_API_URL + /openapi.json
Web: NEXT_PUBLIC_API_BASE_URL + /openapi.json
```

현재 실제 로컬 `.env` 파일은 Git에서 제외되며 실행 환경에 맞는 값을 가진다. `.env.example`은 새 개발자가 로컬 백엔드를 사용할 수 있도록 `http://localhost:8000`을 예시로 제공한다. `.env`를 수정해 변수 구성이나 사용법이 달라지면 `.env.example`도 함께 수정한다. 비밀값이나 특정 개인 환경값은 example에 넣지 않는다.

주의할 점은 브라우저에서 `http://localhost:8000/docs`를 열었다고 Orval도 자동으로 localhost를 사용하는 것은 아니라는 것이다. Orval이 보는 서버는 각 설정이 읽은 실제 env 값으로 결정된다.

## 5. 사용 방법

### 로컬 백엔드와 Swagger 실행

백엔드 디렉터리에서 Docker Compose를 실행한다.

```bash
cd server
docker compose -f docker-compose.dev.yml up --build
```

실행 후 다음 주소를 확인한다.

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- Health check: `http://localhost:8000/health`

Orval이 localhost를 읽게 하려면 App/Web의 실제 env도 localhost를 가리켜야 한다.

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 전체 생성

`client` 루트에서 실행한다.

```bash
pnpm generate
```

이 명령은 다음 순서로 동작한다.

1. App API 함수와 shared 모델 생성
2. Web API 함수와 shared 모델 생성

특별한 이유가 없다면 플랫폼별 명령보다 루트 명령을 사용한다.

### 플랫폼별 생성

```bash
pnpm --filter @tamnalog/app generate
pnpm --filter @tamnalog/web generate
```

각 명령도 해당 플랫폼 API 코드뿐 아니라 shared 모델을 갱신한다. App과 Web 명령을 동시에 실행하지 않는다.

### 구조 검증

```bash
pnpm verify:orval
```

다음을 검사한다.

- shared generated 모델 존재 여부
- App/Web의 도메인별 API 파일 존재 여부
- 이전 `src/schemas/api` 중복 경로가 남아 있지 않은지
- 생성된 플랫폼 API가 shared 모델을 import하는지

필요하면 타입 검사도 실행한다.

```bash
pnpm --filter @packages/shared typecheck
pnpm --filter @tamnalog/app typecheck
pnpm --filter @tamnalog/web typecheck
```

## 6. 생성 파일 관리 원칙

- `packages/shared/src/api/generated/**`와 App/Web의 `src/services/api/**`는 자동 생성 영역이다.
- 생성 파일을 직접 수정하지 않는다. 다음 `pnpm generate`에서 변경 내용이 사라진다.
- 수동 Axios 설정, mapper, 도메인 상태, 상수는 생성 폴더 밖에 둔다.
- 화면 상태가 API 모델과 다르면 `packages/shared/src/domains/<domain>` 등에 mapper나 별도 도메인 타입을 둔다.
- 동일한 수동 Request/Response 타입이 더 이상 사용되지 않을 때 점진적으로 제거한다.
- UI 상태 타입과 API 전송 타입은 이름이 비슷해도 역할이 다르면 분리한다.

Orval의 `tags-split`은 API 함수와 훅을 tag별로 나누지만, 모든 Request/Response 모델을 도메인별 폴더로 자동 분류하지는 않는다. 생성 모델을 사람이 Request/Response 또는 domain 폴더로 다시 옮기면 다음 생성에서 원복되거나 import가 깨질 수 있으므로 `generated` 아래에 평평하게 유지한다.

generated 전체를 shared 루트에서 `export *`하지 않는다. 기존 수동 타입과 생성 타입의 이름이 충돌할 수 있기 때문이다. 현재는 기존 공개 API를 유지하면서 생성 모델을 `GeneratedApi` namespace로 노출한다. 플랫폼별 생성 API 파일은 필요한 타입을 generated 경로에서 직접 import한다.

## 7. `clean: true`의 정확한 의미

`clean: true`는 이전 결과와 새 OpenAPI를 비교해 사용하지 않는 파일만 골라 삭제하는 옵션이 아니다.

Orval은 생성하기 전에 다음 출력 폴더 안의 파일을 먼저 삭제하고 현재 OpenAPI 기준으로 전체를 다시 만든다. `.d.ts` 파일은 보존된다.

- 플랫폼별 `src/services/api`
- `packages/shared/src/api/generated`

따라서 백엔드에서 삭제된 endpoint나 schema가 다음 생성 후 프론트에 남지 않는다. 반대로 이 폴더 안에 수동으로 작성한 파일이 있으면 같이 삭제되므로 생성 전용 폴더로만 사용해야 한다.

App과 Web이 같은 shared generated 폴더를 사용하므로 App 생성 때 한 번, Web 생성 때 다시 한 번 정리된다. 두 설정이 같은 OpenAPI를 사용한다는 전제에서 최종 결과는 동일하며, 루트 스크립트는 충돌을 피하기 위해 순차 실행한다.

## 8. Q&A

### Q. Swagger가 백엔드 코드에서 자동 생성되면 프론트도 자동 갱신되는가?

아니다. FastAPI는 서버의 `/openapi.json`을 자동 갱신하지만 프론트의 TypeScript 파일까지 갱신하지는 않는다. 백엔드 API 계약이 변경되면 프론트에서 `pnpm generate`를 다시 실행해야 한다.

### Q. 언제 `pnpm generate`를 실행해야 하는가?

다음 변경이 OpenAPI에 반영된 후 실행한다.

- endpoint 추가 또는 삭제
- URL이나 HTTP 메서드 변경
- query/path parameter 변경
- Request/Response 모델 변경
- tag 또는 `operationId` 변경

백엔드 변경이 프론트 계약에 영향을 주지 않는 내부 서비스 로직 변경이라면 다시 생성할 필요가 없다.

### Q. 생성 명령은 기존 파일을 덮어쓰는가?

그렇다. 현재는 `clean: true`이므로 생성 전용 출력 폴더를 먼저 비운 다음 전체를 다시 생성한다. 생성 파일에 직접 작성한 코드는 보존되지 않는다.

### Q. 삭제된 백엔드 API도 프론트에서 사라지는가?

그렇다. `clean: true`로 이전 생성 폴더를 비운 뒤 현재 OpenAPI에 존재하는 항목만 다시 만들기 때문에 삭제된 API의 파일과 타입도 제거된다.

### Q. `clean: true`가 프로젝트 전체를 삭제하는가?

아니다. Orval 설정의 `target`과 `schemas`로 지정한 생성 폴더만 대상으로 한다. 현재 설정에서는 `src/services/api`와 `packages/shared/src/api/generated`다. 생성 폴더 밖의 Axios client, 화면 코드, shared의 수동 도메인 타입은 삭제하지 않는다.

### Q. localhost Swagger를 보고 있는데 왜 Orval은 배포 백엔드를 볼 수 있는가?

Swagger 브라우저 탭과 Orval은 연결되어 있지 않기 때문이다. 브라우저에서 `localhost:8000/docs`를 열어도 실제 `.env` 값이 배포 URL이면 Orval은 배포 서버의 `/openapi.json`을 읽는다. 생성 전에 실제 env 값을 확인해야 한다.

### Q. `.env.example`에도 배포 URL을 넣어야 하는가?

아니다. example은 필요한 변수명과 유효한 형식을 알려 주는 문서다. 새 개발자가 배포 서버를 실수로 사용하지 않도록 localhost 값을 둔다. 실제 배포 URL과 비밀값은 Git에서 제외되는 `.env`나 배포 환경변수에서 관리한다.

### Q. `/api/v1` 접두사를 왜 Axios base URL에 넣지 않는가?

`/api/v1`은 백엔드 OpenAPI의 실제 endpoint 경로에 이미 포함되어 있고 생성된 요청 URL에도 들어간다. Axios base URL에도 같은 접두사를 넣으면 `/api/v1/api/v1/...`처럼 중복될 수 있다. 현재는 base URL에 서버 origin을 두고 API 경로는 OpenAPI가 소유한다.

### Q. 왜 생성 파일의 import가 절대경로가 아니라 상대경로인가?

Orval은 `target`과 `schemas`의 실제 파일시스템 위치를 기준으로 import 경로를 계산한다. TypeScript의 `@/*` alias가 있다고 해서 Orval 출력이 자동으로 alias를 사용하지는 않는다. 생성 파일 내부 경로를 후처리하면 생성기 버전에 따라 깨질 수 있어 현재는 Orval이 만든 상대경로를 유지한다. 직접 작성하는 화면과 도메인 코드에서는 기존 alias를 사용한다.

### Q. `/api/v1`과 HTTP 메서드가 함수명에 들어가 이름이 긴 이유는 무엇인가?

FastAPI가 기본 생성한 `operationId`가 함수명, API 경로, HTTP 메서드를 합친 형태이기 때문이다.

```text
save_onboarding_info_api_v1_users_me_patch
                    ↓ Orval camelCase 변환
saveOnboardingInfoApiV1UsersMePatch
```

Orval이 임의로 긴 이름을 만든 것이 아니라 백엔드 OpenAPI의 식별자를 기반으로 만든 것이다. 생성 파일을 직접 고쳐도 재생성하면 원복된다. 이름을 줄이려면 백엔드에서 명시적인 `operation_id`를 제공하거나 Orval의 `operationName` 규칙을 추가해야 하지만, 현재는 API 계약과 생성 결과를 그대로 대응시키기 위해 변경하지 않았다.

### Q. Request/Response 파일을 각각 폴더로 나누거나 domain별로 나누면 더 보기 좋지 않은가?

사람이 읽기에는 더 보기 좋을 수 있지만 Orval이 해당 구조를 기본적으로 유지해 주지 않는다. 수동 이동과 분류는 재생성 때 원복되고 import 관리 비용이 생긴다. 대신 API 탐색은 `app|web/src/services/api/<domain>`에서 시작하고, 모델은 이름의 `Request`와 `Response` 접미사로 구분한다. 사람이 직접 사용하는 선별 타입과 mapper만 `packages/shared/src/domains/<domain>`에서 관리한다.

### Q. 파일명이 특히 긴 이유는 무엇인가?

두 종류의 원인이 있다.

- API별 Params/Response 이름: FastAPI의 긴 기본 `operationId`에서 파생된다.
- 모델 파일 이름: 백엔드 Pydantic/OpenAPI schema 이름과 중첩 구조에서 파생된다.

이 이름들은 충돌을 피하고 어떤 계약에서 나온 타입인지 보존한다. 생성된 이름은 직접 줄이지 않는다.

### Q. 생성된 API가 버튼과 화면에 이미 연결되어 있는가?

아니다. 현재 작업은 API 코드와 타입을 생성하고 폴더 구조를 정리한 단계다. 버튼 클릭 시 mutation 실행, 화면 진입 시 query 실행, 캐시 invalidate, 로딩/오류 UI 연결은 별도 기능 작업이다. 기존 수동 API 호출도 일괄 교체하지 않았다.

### Q. App과 Web이 같은 shared 폴더를 생성해도 되는가?

현재는 같은 OpenAPI와 같은 Orval 버전을 사용하고 루트에서 순차 실행하므로 동일한 모델이 최종적으로 남는다. 병렬 실행은 금지한다. 두 플랫폼이 서로 다른 OpenAPI를 사용하게 된다면 shared 생성 책임을 한 곳으로 통합하거나 출력 경로를 분리하도록 구조를 다시 설계해야 한다.

## 9. 문제 해결

### Orval이 OpenAPI를 읽지 못하는 경우

1. 백엔드가 실행 중인지 확인한다.
2. 설정이 가리키는 `{API_URL}/openapi.json`을 브라우저나 HTTP 도구로 직접 연다.
3. App의 `.env`, Web의 `.env.local` 값과 Orval 설정에서 읽는 변수명이 일치하는지 확인한다.
4. env 변경 후 명령을 새로 실행한다.

### 생성 후 타입 오류가 발생하는 경우

1. `pnpm verify:orval`로 생성 구조를 확인한다.
2. shared, App, Web 타입 검사를 각각 실행해 오류 위치를 구분한다.
3. 생성 파일을 직접 수정하지 말고 OpenAPI 또는 Orval 설정에서 원인을 해결한다.
4. 백엔드가 같은 schema 이름을 서로 다른 의미로 사용하거나 `operationId`가 중복되지 않았는지 확인한다.

## 10. 현재 범위와 후속 작업

현재 완료된 범위는 다음과 같다.

- 공통 Request/Response 모델을 shared에 한 벌로 생성
- App/Web API 함수와 React Query 훅을 도메인별 생성
- 플랫폼별 Axios mutator 유지
- 이전 중복 생성 경로 제거
- App → Web 순차 생성 명령과 구조 검사 제공
- 삭제된 API 생성물이 남지 않도록 `clean: true` 적용

아직 포함하지 않은 범위는 다음과 같다.

- 버튼 클릭과 mutation 연결
- 화면 진입과 query 연결
- 캐시 키와 invalidate 정책
- 인증 토큰 저장 및 refresh 정책 변경
- 기존 수동 API 호출의 일괄 교체
- 백엔드 schema, tag, `operationId` 이름 변경

