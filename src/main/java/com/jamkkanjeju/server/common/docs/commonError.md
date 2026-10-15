# 공통 오류 응답

API에서 공통으로 사용하는 요청 검증, 인증·인가 및 서버 오류 응답이다. 각 API의 요청 형식과 제약은 해당 API 명세를 따른다.

오류 응답은 공통 래퍼 없이 `code`와 `message`로 구성한다. 도메인에 종속된 오류는 해당 API 명세에 별도로 작성한다.

인증이 필요한 API는 `Authorization: Bearer {accessToken}` 형식으로 호출한다. 인증·인가 오류는 해당 인증·권한 조건이 적용되는 API에서 발생하며, 로그인 실패 등 도메인 고유의 401/403 오류와 구분한다.

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

해당 API의 필수 입력값이 누락되거나 입력값의 타입·형식·허용 범위가 올바르지 않은 경우, 요청 JSON을 해석할 수 없는 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 인증 정보 없음

Status Code : `401 Unauthorized`

인증이 필요한 API에 인증 정보 없이 호출한 경우 또는 인증 정보에 해당하는 사용자가 존재하지 않는 경우

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

인증은 되었지만 해당 API를 호출할 권한이 없는 경우

```json
{
  "code": "FORBIDDEN",
  "message": "접근 권한이 없습니다."
}
```

#### 서버 오류

Status Code : `500 Internal Server Error`

요청 처리 중 예기치 않은 서버 오류가 발생한 경우. 구체적인 내부 오류 원인은 응답에 노출하지 않는다.

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```
