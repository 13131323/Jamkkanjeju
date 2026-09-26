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
