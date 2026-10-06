# 사용자 온보딩 완료 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 사용자 온보딩 완료 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `ONBOARDING` |
| 엔드포인트 | `/api/v2/users/me` |

### API 설명

사용자가 온보딩의 모든 단계를 완료하거나 **나중에 할게요**를 선택했을 때 호출한다.

온보딩을 완료한 경우 사용자가 선택한 여행 기대 항목, 주 이동 수단, 자투리 시간 여행 방식을 전달한다. **나중에 할게요**를 선택한 경우 빈 객체 `{}`를 전달한다.

인증이 필요한 API이며, 정상 처리되면 사용자의 온보딩 결과를 반환한다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |
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
| `expectations` | string[] | 조건부 필수 | 여행 기대 항목. 온보딩 완료 시 한 개 이상의 중복되지 않은 값을 전달한다. 허용값: `PHOTO \| LOCAL \| NATURE \| CULTURE \| CAFE \| WALKING` |
| `transportation` | string | 조건부 필수 | 주 이동 수단. 온보딩 완료 시 전달한다. 허용값: `WALK \| BUS \| CAR \| BICYCLE` |
| `travelStyle` | string | 조건부 필수 | 자투리 시간 여행 방식. 온보딩 완료 시 전달한다. 허용값: `RIGHT_HERE \| NEAR_AROUND \| NEAR_DESTINATION` |

정상적으로 온보딩을 완료한 경우:

```json
{
  "expectations": ["PHOTO", "LOCAL", "NATURE", "CAFE"],
  "transportation": "WALK",
  "travelStyle": "NEAR_DESTINATION"
}
```

**나중에 할게요**를 선택한 경우:

```json
{}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

온보딩 정보가 정상적으로 반영된 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `user` | object | 온보딩을 완료한 사용자 정보 |
| `user.id` | integer | 사용자 ID |
| `user.onboardingCompleted` | boolean | 온보딩 완료 여부. 정상 응답에서는 항상 `true` |
| `user.onboardingResult` | object | 사용자에게 배정된 온보딩 결과 |
| `user.onboardingResult.id` | integer | 온보딩 결과 ID |
| `user.onboardingResult.userType` | string | 사용자 여행 유형명 |
| `user.onboardingResult.typeDescription` | string | 사용자 여행 유형 설명 |
| `user.onboardingResult.hashtags` | string[] | 사용자 여행 유형 해시태그 목록 |
| `user.onboardingResult.profileImageUrl` | string | 사용자 여행 유형 프로필 이미지 URL |

```json
{
  "user": {
    "id": 1,
    "onboardingCompleted": true,
    "onboardingResult": {
      "id": 1,
      "userType": "제주 사진작가",
      "typeDescription": "제주의 빛과 색을 카메라에 담으며 여행지마다 특별한 순간을 발견하는 여행자입니다.",
      "hashtags": ["PHOTO", "인생사진", "제주풍경"],
      "profileImageUrl": "https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/character_image/001.png"
    }
  }
}
```

---

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

요청 형식이 하나라도 올바르지 않을 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 인증 정보 없음

Status Code : `401 Unauthorized`

`Authorization` 헤더 없이 호출한 경우

```json
{
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

#### 유효하지 않은 토큰

Status Code : `401 Unauthorized`

토큰이 변조되었거나 형식이 올바르지 않은 경우, 리프레시 토큰으로 호출한 경우

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

#### 서버 오류

Status Code : `500 Internal Server Error`

온보딩 처리 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```
