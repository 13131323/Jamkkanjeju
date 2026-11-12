# 로그인 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 로그인 |
| HTTP 메서드 | `POST` |
| 도메인 | `AUTH` |
| 엔드포인트 | `/api/v2/auth/login` |

### API 설명

사용자가 이메일 또는 관리자 아이디 `admin`과 비밀번호로 로그인할 때 호출한다.

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
| `email` | string | 필수 | 로그인에 사용할 이메일 또는 관리자 아이디 `admin` |
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

이메일 또는 `admin` 형식이 아니거나 필수 요청값이 비어 있는 경우

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

# 액세스 토큰 재발급 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 액세스 토큰 재발급 |
| HTTP 메서드 | `POST` |
| 도메인 | `AUTH` |
| 엔드포인트 | `/api/v2/auth/refresh` |

### API 설명

액세스 토큰이 만료되었거나 새 액세스 토큰이 필요할 때, 보관한 리프레시 토큰으로 호출한다.

액세스 토큰 인증 없이 호출할 수 있으며, 요청 Body의 리프레시 토큰으로 재발급 자격을 확인한다. 액세스 토큰을 `Authorization` 헤더에 보내지 않아도 되고, 해당 헤더에 만료되거나 잘못된 액세스 토큰이 있어도 Body의 리프레시 토큰을 기준으로 처리한다.

성공하면 새 액세스 토큰과 새 리프레시 토큰, 현재 사용자 정보를 반환한다. 응답 형식은 로그인 응답과 동일하다. 클라이언트는 보관한 두 토큰을 새 값으로 교체해야 하며, 재발급에 사용한 기존 리프레시 토큰은 다시 사용할 수 없다.

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
| `refreshToken` | string | 필수 | 로그인 또는 직전 재발급 응답으로 받은 리프레시 토큰 원문. 빈 문자열·공백만 있는 값은 허용하지 않는다. `Bearer ` 접두사 없이 전달한다. |

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9.refresh-token"
}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

리프레시 토큰이 유효하고 사용자가 토큰을 재발급받을 수 있는 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `accessToken` | string | 새로 발급한 JWT 액세스 토큰 |
| `refreshToken` | string | 새로 발급한 리프레시 토큰. 다음 재발급부터 이 값을 사용한다. |
| `tokenType` | string | 토큰 인증 방식. 항상 `Bearer` |
| `accessTokenExpiresIn` | integer | 새 액세스 토큰 만료까지 남은 시간. 초 단위 |
| `refreshTokenExpiresIn` | integer | 새 리프레시 토큰 만료까지 남은 시간. 초 단위 |
| `user` | object | 현재 사용자 정보 |
| `user.id` | integer | 사용자 ID |
| `user.nickname` | string, null | 사용자 닉네임. 설정하지 않았으면 null |
| `user.role` | string | 현재 사용자 권한. `USER \| ADMIN` |
| `user.onboardingCompleted` | boolean | 온보딩 완료 여부 |

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9.new-access-token",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9.new-refresh-token",
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

`refreshToken`이 누락되거나 null·빈 문자열·공백만 있는 값인 경우, 요청 Body의 타입이나 JSON 형식이 올바르지 않은 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 인증 정보에 해당하는 사용자 없음

Status Code : `401 Unauthorized`

리프레시 토큰에 해당하는 사용자가 존재하지 않는 경우

```json
{
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

#### 유효하지 않은 리프레시 토큰

Status Code : `401 Unauthorized`

리프레시 토큰이 변조되었거나 형식·필수 정보가 올바르지 않은 경우, 액세스 토큰 등 다른 종류의 토큰을 전달한 경우, 서버에 등록되지 않았거나 이미 폐기·사용된 리프레시 토큰인 경우

```json
{
  "code": "INVALID_TOKEN",
  "message": "유효하지 않은 토큰입니다."
}
```

#### 만료된 리프레시 토큰

Status Code : `401 Unauthorized`

리프레시 토큰의 유효기간이 지난 경우

```json
{
  "code": "EXPIRED_TOKEN",
  "message": "만료된 토큰입니다."
}
```

#### 서버 오류

Status Code : `500 Internal Server Error`

토큰 재발급 처리 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

#### 정지된 사용자

Status Code : `403 Forbidden`

리프레시 토큰은 유효하지만 정지된 계정인 경우

```json
{
  "code": "USER_SUSPENDED",
  "message": "정지된 계정입니다."
}
```

#### 탈퇴한 사용자

Status Code : `403 Forbidden`

리프레시 토큰은 유효하지만 탈퇴한 계정인 경우

```json
{
  "code": "USER_WITHDRAWN",
  "message": "탈퇴한 계정입니다."
}
```

---

# 로그아웃 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 로그아웃 |
| HTTP 메서드 | `POST` |
| 도메인 | `AUTH` |
| 엔드포인트 | `/api/v2/auth/logout` |

### API 설명

현재 기기에서 보관 중인 최신 리프레시 토큰으로 로그아웃한다. 해당 토큰으로는 더 이상 액세스 토큰을 재발급받을 수 없으며, 다른 기기나 별도 로그인에서 발급한 토큰에는 영향을 주지 않는다.

액세스 토큰 인증 없이 호출할 수 있다. `Authorization` 헤더를 생략해도 되며, 만료되거나 잘못된 액세스 토큰을 함께 보내도 로그아웃을 차단하지 않는다.

전달한 리프레시 토큰이 이미 만료·폐기되었거나 서버에 존재하지 않아도 동일하게 성공한다. 같은 토큰으로 재요청할 수 있다. 이 API는 새 토큰을 발급하지 않으며, 기존 액세스 토큰을 즉시 무효화하지 않는다.

클라이언트는 로그아웃 시 보관 중인 액세스·리프레시 토큰과 사용자 정보·인증 쿠키·사용자별 캐시를 정리하고 로그인 화면으로 이동한다.

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
| `refreshToken` | string | 필수 | 현재 기기의 로그인 또는 직전 재발급 응답으로 받은 최신 리프레시 토큰 원문. 누락·null·빈 문자열·공백만 있는 값은 허용하지 않는다. `Bearer ` 접두사 없이 전달한다. |

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9.refresh-token"
}
```

일반 웹은 HttpOnly 쿠키에 보관한 리프레시 토큰을 Next.js 서버가 읽어 Spring API의 Body로 전달한다. 앱은 보안 저장소에서 읽어 전달한다. 일반 웹의 JavaScript에 리프레시 토큰 원문을 노출하지 않는다.

---

### 정상 응답 데이터

Status Code : `204 No Content`

전달한 리프레시 토큰으로 재발급할 수 없는 상태가 된 경우. 이미 삭제되었거나 등록된 기록이 없는 경우도 포함한다.

응답 Body 없음. 액세스·리프레시 토큰을 반환하지 않는다.

---

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

`refreshToken`이 누락되거나 null·빈 문자열·공백만 있는 값인 경우, 요청 Body의 타입이나 JSON 형식이 올바르지 않은 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 서버 오류

Status Code : `500 Internal Server Error`

로그아웃 처리 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

로그아웃은 액세스 토큰 인증을 요구하지 않으므로 공통 액세스 토큰 인증 오류를 적용하지 않는다. 전달한 리프레시 토큰에 해당하는 기록이 없거나 만료·폐기된 상태라는 이유로 인증 오류를 반환하지 않는다.

---

# 공통 인증 오류

인증이 필요한 모든 API에 공통으로 적용되는 오류 응답이다. 인증이 필요한 API는 `Authorization` 헤더에 로그인 응답의 `accessToken`을 `Bearer {accessToken}` 형식으로 담아 호출한다.

로그인·액세스 토큰 재발급·로그아웃 API처럼 액세스 토큰 인증 없이 호출하는 API에는 적용되지 않는다. 재발급 API의 리프레시 토큰 오류는 해당 API의 오류 응답을 따른다.

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
