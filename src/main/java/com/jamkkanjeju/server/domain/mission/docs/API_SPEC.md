# 미션 홈 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 미션 홈 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `MISSION` |
| 엔드포인트 | `/api/v2/missions/{missionId}` |

### API 설명

사용자가 미션을 클릭하여 미션 홈 화면에 진입할 때 호출한다.

인증이 필요한 API이며, 공통 미션 ID로 미션의 유형과 제목, 설명, 단계 정보 및 현재 사용자에게 아직 한 번도 지급되지 않은 보상 정보를 조회한다. 요청에 미션 유형을 별도로 전달하지 않는다.

같은 미션을 여러 번 진행하더라도 해당 미션에서 현재 사용자에게 한 번이라도 지급된 보상은 `remainingReward`의 해당 항목을 `null`로 반환한다. 보상이 설정되어 있지 않은 경우에도 해당 항목은 `null`로 반환한다.

비활성화된 미션은 조회할 수 없다.

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
| `missionId` | integer | 필수 | 조회할 미션의 공통 미션 ID. 미션 진행도 ID와 구분한다. |

요청 예시:

```http
GET /api/v2/missions/12
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `200 OK`

미션 홈 정보가 정상적으로 조회된 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | integer | 조회한 미션의 공통 미션 ID |
| `missionType` | string | 미션 유형. `CULTURE \| COOPERATIVE \| TREASURE` |
| `missionTitle` | string | 미션 제목 |
| `description` | string | 미션 설명 |
| `remainingReward` | object | 현재 사용자에게 아직 한 번도 지급되지 않은 미션 보상 정보. 남은 보상이 없어도 객체를 반환하며 각 항목은 모두 `null` |
| `remainingReward.arCharacter` | object, null | 해당 미션에서 아직 지급되지 않은 AR 캐릭터 보상. 이미 지급됐거나 캐릭터 보상이 없으면 `null` |
| `remainingReward.arCharacter.id` | integer | AR 캐릭터 ID |
| `remainingReward.arCharacter.name` | string | AR 캐릭터 이름 |
| `remainingReward.arCharacter.imageUrl` | string | AR 캐릭터 이미지 URL |
| `remainingReward.point` | integer, null | 해당 미션에서 아직 지급되지 않은 포인트 보상. 이미 지급됐거나 포인트 보상이 없으면 `null` |
| `remainingReward.coupon` | object, null | 해당 미션에서 아직 지급되지 않은 쿠폰 보상. 이미 지급됐거나 쿠폰 보상이 없으면 `null` |
| `remainingReward.coupon.couponLocation` | string, null | 쿠폰 사용처. 연결된 장소가 없으면 `null` |
| `remainingReward.coupon.couponPrice` | integer | 쿠폰 금액 |
| `steps` | object[] | 미션 단계 목록. `step` 오름차순으로 반환 |
| `steps[].step` | integer | 단계 번호 |
| `steps[].stepTitle` | string | 단계 제목 |
| `steps[].description` | string | 단계 설명 |

```json
{
  "id": 12,
  "missionType": "CULTURE",
  "missionTitle": "오늘의 제주 퀴즈",
  "description": "제주의 퀴즈를 맞춰보세요.",
  "remainingReward": {
    "arCharacter": {
      "id": 7,
      "name": "돌담이",
      "imageUrl": "https://example.com/characters/stone-spirit.png"
    },
    "point": 100,
    "coupon": {
      "couponLocation": "종화네 막국수",
      "couponPrice": 1000
    }
  },
  "steps": [
    {
      "step": 1,
      "stepTitle": "퀴즈 시작하기",
      "description": "제주 방언에 대한 퀴즈를 풀어보세요."
    },
    {
      "step": 2,
      "stepTitle": "3문제 풀기",
      "description": "각 문제마다 4개의 보기 중 정답을 선택하세요."
    },
    {
      "step": 3,
      "stepTitle": "정답 확인",
      "description": "문제를 다 풀면 결과를 확인할 수 있어요."
    }
  ]
}
```

해당 미션의 보상 3개가 모두 한 번 이상 지급된 경우

```json
{
  "id": 12,
  "missionType": "CULTURE",
  "missionTitle": "오늘의 제주 퀴즈",
  "description": "제주의 퀴즈를 맞춰보세요.",
  "remainingReward": {
    "arCharacter": null,
    "point": null,
    "coupon": null
  },
  "steps": [
    {
      "step": 1,
      "stepTitle": "퀴즈 시작하기",
      "description": "제주 방언에 대한 퀴즈를 풀어보세요."
    },
    {
      "step": 2,
      "stepTitle": "3문제 풀기",
      "description": "각 문제마다 4개의 보기 중 정답을 선택하세요."
    },
    {
      "step": 3,
      "stepTitle": "정답 확인",
      "description": "문제를 다 풀면 결과를 확인할 수 있어요."
    }
  ]
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

`missionId`를 정수로 변환할 수 없거나 지원하는 정수 범위를 벗어난 경우 공통 요청값 검증 실패에 해당한다.

#### 미션 없음

Status Code : `404 Not Found`

요청한 공통 미션 ID에 해당하는 미션이 존재하지 않는 경우

```json
{
  "code": "MISSION_NOT_FOUND",
  "message": "미션을 찾을 수 없습니다."
}
```

#### 비활성화된 미션

Status Code : `404 Not Found`

요청한 미션의 상태가 `INACTIVE`인 경우. 문화·협동·보물찾기 미션에 동일하게 적용한다.

```json
{
  "code": "MISSION_INACTIVE",
  "message": "비활성화된 미션입니다."
}
```
