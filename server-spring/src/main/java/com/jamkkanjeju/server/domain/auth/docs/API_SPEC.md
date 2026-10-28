# 로그인 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 로그인 |
| HTTP 메서드 | `POST` |
| 도메인 | `AUTH` |
| 엔드포인트 | `/api/v2/auth/login` |

### API 설명

사용자가 이메일과 비밀번호로 로그인할 때 호출한다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Content-Type` | 필수 | `application/json` |

---

### 요청 Query

없음

---

### 요청 Path

없음

---

### 요청 Body

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `email` | string | 필수 | 로그인에 사용할 이메일 |
| `password` | string | 필수 | 로그인에 사용할 비밀번호 |
| `deviceInfo` | string, null | 선택 | 로그인한 기기를 식별하기 위한 정보. 최대 255자이며 전달하지 않으면 null |

```json
{
  "email": "user@example.com",
  "password": "password123!",
  "deviceInfo": "iPhone 15 / iOS 18"
}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

로그인에 성공하고 토큰이 정상적으로 발급된 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `accessToken` | string | API 인증에 사용하는 JWT 액세스 토큰 |
| `refreshToken` | string | 액세스 토큰 재발급에 사용하는 리프레시 토큰 |
| `tokenType` | string | 토큰 인증 방식. 항상 `Bearer` |
| `accessTokenExpiresIn` | integer | 액세스 토큰 만료까지 남은 시간. 초 단위 |
| `refreshTokenExpiresIn` | integer | 리프레시 토큰 만료까지 남은 시간. 초 단위 |
| `user` | object | 로그인한 사용자 정보 |
| `user.id` | integer | 사용자 ID |
| `user.nickname` | string, null | 사용자 닉네임. 설정하지 않았으면 null |
| `user.role` | string | 사용자 권한. `USER \| ADMIN` |
| `user.onboardingCompleted` | boolean | 온보딩 완료 여부 |

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9.access-token",
  "refreshToken": "raw-refresh-token",
  "tokenType": "Bearer",
  "accessTokenExpiresIn": 1800,
  "refreshTokenExpiresIn": 1209600,
  "user": {
    "id": 1,
    "nickname": "몽글몽글파도",
    "role": "USER",
    "onboardingCompleted": true
  }
}
```

---

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

이메일 형식이 아니거나 필수 요청값이 비어 있는 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 로그인 정보 불일치

Status Code : `401 Unauthorized`

가입되지 않은 이메일이거나 비밀번호가 일치하지 않는 경우

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다."
}
```

#### 정지된 사용자

Status Code : `403 Forbidden`

이메일과 비밀번호는 일치하지만 정지된 계정인 경우

```json
{
  "code": "USER_SUSPENDED",
  "message": "정지된 계정입니다."
}
```

#### 탈퇴한 사용자

Status Code : `403 Forbidden`

이메일과 비밀번호는 일치하지만 탈퇴한 계정인 경우

```json
{
  "code": "USER_WITHDRAWN",
  "message": "탈퇴한 계정입니다."
}
```

#### 서버 오류

Status Code : `500 Internal Server Error`

로그인 처리 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

---

# 공통 인증 오류

인증이 필요한 모든 API에 공통으로 적용되는 오류 응답이다. 인증이 필요한 API는 `Authorization` 헤더에 로그인 응답의 `accessToken`을 `Bearer {accessToken}` 형식으로 담아 호출한다.

로그인 API처럼 인증 없이 호출하는 API에는 적용되지 않는다.

### 오류 응답 데이터

#### 인증 정보 없음

Status Code : `401 Unauthorized`

`Authorization` 헤더 없이 인증이 필요한 API를 호출한 경우

```json
{
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

#### 유효하지 않은 토큰

Status Code : `401 Unauthorized`

토큰이 변조되었거나 형식이 올바르지 않은 경우, `Bearer` 방식이 아닌 경우, 액세스 토큰이 아닌 토큰(리프레시 토큰 등)으로 호출한 경우

```json
{
  "code": "INVALID_TOKEN",
  "message": "유효하지 않은 토큰입니다."
}
```

#### 만료된 토큰

Status Code : `401 Unauthorized`

액세스 토큰의 유효기간이 지난 경우

```json
{
  "code": "EXPIRED_TOKEN",
  "message": "만료된 토큰입니다."
}
```

#### 권한 없음

Status Code : `403 Forbidden`

인증은 되었지만 API를 호출할 권한이 없는 경우 (예: `USER` 권한으로 관리자 전용 API 호출)

```json
{
  "code": "FORBIDDEN",
  "message": "접근 권한이 없습니다."
}
```
