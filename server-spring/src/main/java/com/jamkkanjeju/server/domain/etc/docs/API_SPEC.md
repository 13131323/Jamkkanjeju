# 쿠폰 사용 처리 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 쿠폰 사용 처리 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `ETC` |
| 엔드포인트 | `/api/v2/coupons/{couponId}/use` |

### API 설명

로그인한 사용자가 획득한 쿠폰을 사용 처리한다. 쿠폰 사용 확인 모달에서 ‘사용’을 선택했을 때 호출한다. 이미 사용한 쿠폰은 다시 사용할 수 없다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |

---

### 요청 Query

없음

---

### 요청 Path

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `couponId` | integer | 필수 | 1 이상의 쿠폰 ID. 지도 홈 `receivedCoupons[].couponId`로 제공되는 값 |

요청 예시:

```http
PATCH /api/v2/coupons/1/use
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `204 No Content`

쿠폰을 정상적으로 사용 처리한 경우. 응답 본문은 없다. 갱신된 사용 시각은 지도 홈 `receivedCoupons[].usedAt`에서 확인한다.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

#### 쿠폰 없음

Status Code : `404 Not Found`

해당 쿠폰이 존재하지 않는 경우

```json
{
  "code": "COUPON_NOT_FOUND",
  "message": "쿠폰을 찾을 수 없습니다."
}
```

#### 미획득 쿠폰

Status Code : `404 Not Found`

쿠폰은 존재하지만 로그인한 사용자가 획득한 쿠폰이 아닌 경우

```json
{
  "code": "ACQUIRED_COUPON_NOT_FOUND",
  "message": "획득한 쿠폰이 아닙니다."
}
```

#### 이미 사용한 쿠폰

Status Code : `409 Conflict`

이미 사용 완료한 쿠폰에 사용 처리를 다시 요청한 경우

```json
{
  "code": "COUPON_ALREADY_USED",
  "message": "이미 사용한 쿠폰입니다."
}
```
