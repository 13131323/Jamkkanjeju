# 보물찾기 시작/이어하기 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 보물찾기 시작/이어하기 |
| HTTP 메서드 | `POST` |
| 도메인 | `TREASURE_MISSION` |
| 엔드포인트 | `/api/v2/treasure-missions/{missionId}/progress` |

### API 설명

사용자가 보물찾기 미션을 처음 시작하거나 진행 중이던 미션을 이어서 할 때 호출한다. 완료한 미션도 다시 시작할 수 있다.

인증이 필요한 API이며, 공통 미션 ID와 사용자 현재 위치를 전달한다. 처음 시작하면 사용자 위치에서 100m 이내에 보물 3개를 배치한다. 진행 중인 미션을 이어서 할 때는 요청 위치가 바뀌어도 기존 보물 좌표와 발견 여부를 유지한다.

완료한 미션을 다시 시작하면 기존 진행도 ID를 유지하고 찾은 보물 개수와 발견 상태를 초기화하며, 요청한 현재 위치를 기준으로 보물 3개를 새로 배치한다.

진행도 ID와 진행 상태, 미션 장소 정보, 실제 전체 보물 개수 및 보물별 좌표·발견 여부를 반환한다. 비활성화된 미션은 시작·이어하기·재시작할 수 없다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |

---

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `latitude` | number | 필수 | 사용자 현재 위치의 위도. -90 이상 90 이하. 최초 시작·재시작 시 보물 배치의 기준 위치 |
| `longitude` | number | 필수 | 사용자 현재 위치의 경도. -180 이상 180 이하. 최초 시작·재시작 시 보물 배치의 기준 위치 |

이어하기 요청에서도 두 좌표는 필수이며, 저장된 보물 위치는 변경하지 않는다.

---

### 요청 Path

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `missionId` | integer | 필수 | 시작하거나 이어서 진행할 보물찾기 미션의 공통 미션 ID. 진행도 ID와 구분한다. 1 이상 |

요청 예시:

```http
POST /api/v2/treasure-missions/12/progress?latitude=33.3663&longitude=126.3577
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `201 Created`

보물찾기 진행도를 처음 생성한 경우

Status Code : `200 OK`

기존 진행 중인 미션을 이어서 하거나 완료한 미션의 기존 진행도를 재사용해 다시 시작한 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `treasureMissionProgressId` | integer | 보물찾기 미션 진행도 ID. 이어하기·재시작 시 기존 ID 유지 |
| `missionProgressStatus` | string | 보물찾기 진행 상태. `IN_PROGRESS` |
| `location` | object, null | 미션 장소 정보. 연결된 장소가 없으면 `null`이며 보물찾기는 정상 시작·이어하기·재시작 가능 |
| `location.locationId` | integer | 미션 장소 ID |
| `location.locationTitle` | string | 미션 장소명 |
| `location.locationAddress` | string | 미션 장소 주소 |
| `location.locationDescription` | string, null | 장소 설명의 첫 문장. 설명이 없거나 외부 조회에 실패하면 `null` |
| `location.lat` | number | 미션 장소 위도 |
| `location.lng` | number | 미션 장소 경도 |
| `treasureCount` | integer | 해당 진행도에 실제 저장된 전체 보물 개수. 이미 찾은 보물도 포함하며 항상 `treasureItems` 개수와 동일 |
| `treasureItems` | object[] | `treasureIndex` 오름차순으로 정렬한 전체 보물 목록. 이어하기에서는 기존 개수 유지 |
| `treasureItems[].treasureIndex` | integer | 보물 번호. 1부터 시작 |
| `treasureItems[].location` | object | 저장된 보물 좌표. 미션 장소의 `location`과 별개이며 항상 제공 |
| `treasureItems[].location.lat` | number | 보물 위도 |
| `treasureItems[].location.lng` | number | 보물 경도 |
| `treasureItems[].isFound` | boolean | 해당 보물의 발견 여부. 최초 시작·재시작은 모두 `false` |

신규 시작 응답 예시 `201 Created`

```json
{
  "treasureMissionProgressId": 3,
  "missionProgressStatus": "IN_PROGRESS",
  "location": {
    "locationId": 15,
    "locationTitle": "새별 오름",
    "locationAddress": "제주특별자치도 제주시 애월읍 봉성리 산59-8",
    "locationDescription": "새별오름은 저녁 하늘에 샛별과 같이 외롭게 서 있다고 하여 붙여진 이름입니다.",
    "lat": 33.3663,
    "lng": 126.3577
  },
  "treasureCount": 3,
  "treasureItems": [
    {
      "treasureIndex": 1,
      "location": { "lat": 33.3665, "lng": 126.3579 },
      "isFound": false
    },
    {
      "treasureIndex": 2,
      "location": { "lat": 33.3661, "lng": 126.3574 },
      "isFound": false
    },
    {
      "treasureIndex": 3,
      "location": { "lat": 33.3668, "lng": 126.3581 },
      "isFound": false
    }
  ]
}
```

이어하기 응답 예시 `200 OK`

```json
{
  "treasureMissionProgressId": 3,
  "missionProgressStatus": "IN_PROGRESS",
  "location": {
    "locationId": 15,
    "locationTitle": "새별 오름",
    "locationAddress": "제주특별자치도 제주시 애월읍 봉성리 산59-8",
    "locationDescription": "새별오름은 저녁 하늘에 샛별과 같이 외롭게 서 있다고 하여 붙여진 이름입니다.",
    "lat": 33.3663,
    "lng": 126.3577
  },
  "treasureCount": 3,
  "treasureItems": [
    {
      "treasureIndex": 1,
      "location": { "lat": 33.3665, "lng": 126.3579 },
      "isFound": true
    },
    {
      "treasureIndex": 2,
      "location": { "lat": 33.3661, "lng": 126.3574 },
      "isFound": false
    },
    {
      "treasureIndex": 3,
      "location": { "lat": 33.3668, "lng": 126.3581 },
      "isFound": false
    }
  ]
}
```

장소가 없는 경우에도 응답 구조와 보물 목록은 동일하며 `location`만 `null`로 반환한다.

장소 설명은 HTML 태그·엔티티와 불필요한 공백을 정리한 후 첫 문장을 제공한다. 설명을 제공하지 못하더라도 API 전체 요청은 정상 처리한다. 보물 표시·인식 반경은 요청과 응답에 포함하지 않는다.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

Path의 타입·범위가 올바르지 않거나 Query 좌표가 누락된 경우, 숫자가 아니거나 허용 범위를 벗어난 경우 공통 요청값 검증 실패에 해당한다.

#### 보물찾기 미션 없음

Status Code : `404 Not Found`

요청한 공통 미션 ID에 해당하는 보물찾기 미션이 존재하지 않는 경우

```json
{
  "code": "TREASURE_MISSION_NOT_FOUND",
  "message": "보물찾기 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 보물찾기 미션

Status Code : `404 Not Found`

요청한 보물찾기 미션의 상태가 `INACTIVE`인 경우. 최초 시작·이어하기·완료 후 재시작에 동일하게 적용한다.

```json
{
  "code": "TREASURE_MISSION_INACTIVE",
  "message": "비활성화된 보물찾기 미션입니다."
}
```

---

# 보물찾기 진행도 저장 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 보물찾기 진행도 저장 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `TREASURE_MISSION` |
| 엔드포인트 | `/api/v2/treasure-missions/{treasureMissionProgressId}/progress` |

### API 설명

사용자가 보물찾기 미션에서 보물을 찾을 때마다 호출한다.

시작/이어하기 응답으로 받은 진행도 ID와 찾은 보물 번호를 전달한다. 현재 사용자의 진행 중인 보물찾기 미션만 저장할 수 있으며, 해당 진행도에 존재하고 아직 찾지 않은 보물만 발견 처리할 수 있다.

보물 발견 여부는 프론트에서 판정한다. 서버는 전달받은 보물 번호의 존재 여부와 기존 발견 여부를 확인하며, 사용자와 보물 사이의 거리로 발견 여부를 다시 판정하지 않는다.

보물을 하나 찾을 때마다 남은 보상 중 AR 캐릭터, 포인트, 쿠폰 순서로 한 종류를 즉시 지급한다. 같은 사용자와 같은 미션에서 이전에 지급받은 보상 항목은 재시작하더라도 다시 지급하지 않는다.

응답의 `reward`에는 이번 요청으로 실제 지급된 보상만 포함한다. 지급되지 않은 항목은 `null`이며, 지급할 보상이 없어도 보물 발견은 정상 처리하고 보상 객체의 모든 항목을 `null`로 반환한다.

찾지 않은 보물이 남아 있으면 `IN_PROGRESS`를 유지하고 `nextLocation`을 `null`로 반환한다. 모든 보물을 찾으면 `COMPLETED`로 변경하며 다음 추천 장소를 객체로 반환한다. 마지막 보물도 동일하게 보상 한 종류를 지급한다.

인증이 필요한 API이며, 진행 도중 미션이 비활성화된 경우에도 진행도를 저장할 수 없다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |
| `Content-Type` | 필수 | `application/json` |

---

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `latitude` | number | 필수 | 사용자 현재 위치의 위도. -90 이상 90 이하 |
| `longitude` | number | 필수 | 사용자 현재 위치의 경도. -180 이상 180 이하 |

진행 중에도 두 좌표는 필수이며, 완료 시 다음 장소 추천과 해당 장소까지의 거리 계산에 사용한다.

---

### 요청 Path

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `treasureMissionProgressId` | integer | 필수 | 저장할 보물찾기 미션 진행도 ID. 시작/이어하기 응답으로 받은 값을 전달한다. 미션 ID와 구분 |

요청 예시:

```http
PATCH /api/v2/treasure-missions/31/progress?latitude=33.5572&longitude=126.7591
Authorization: Bearer {accessToken}
Content-Type: application/json
```

---

### 요청 Body

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `treasureIndex` | integer | 필수 | 사용자가 찾은 보물 번호. 시작/이어하기 응답의 `treasureItems[].treasureIndex`를 전달한다 |

```json
{
  "treasureIndex": 2
}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

보물찾기 미션 진행도를 정상적으로 저장한 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `missionProgressStatus` | string | 보물찾기 진행 상태. `IN_PROGRESS \| COMPLETED` |
| `treasureCount` | integer | 해당 진행도에 실제 저장된 전체 보물 개수. 이미 찾은 보물도 포함 |
| `foundTreasureIndexes` | integer[] | 이번 요청의 발견 처리를 포함한 현재까지 찾은 보물 번호 목록. 오름차순으로 반환 |
| `nextLocation` | object, null | 다음 추천 장소 정보. 진행 중이면 `null`, 완료되면 객체 |
| `nextLocation.id` | integer | 다음 장소 ID |
| `nextLocation.locationTitle` | string | 다음 장소명 |
| `nextLocation.locationImageUrl` | string, null | 다음 장소 이미지 URL. 이미지를 제공하지 못하면 `null` |
| `nextLocation.distanceMeter` | number | 요청 위치에서 다음 장소까지의 직선거리(m) |
| `nextLocation.mission` | object, null | 다음 장소에서 수행할 활성 미션. 연결된 활성 미션이 없으면 `null` |
| `nextLocation.mission.id` | integer | 다음 미션의 공통 미션 ID |
| `nextLocation.mission.missionType` | string | 다음 미션 유형. `CULTURE \| COOPERATIVE \| TREASURE` |
| `reward` | object | 이번 요청으로 실제 지급된 보상 정보. 지급된 보상이 없어도 객체로 반환 |
| `reward.arCharacter` | object, null | 이번 요청으로 지급된 AR 캐릭터. 지급되지 않았으면 `null` |
| `reward.arCharacter.id` | integer | AR 캐릭터 ID |
| `reward.arCharacter.name` | string | AR 캐릭터 이름 |
| `reward.arCharacter.imageUrl` | string | AR 캐릭터 이미지 URL |
| `reward.point` | integer, null | 이번 요청으로 지급된 포인트. 지급되지 않았으면 `null` |
| `reward.coupon` | object, null | 이번 요청으로 지급된 쿠폰. 지급되지 않았으면 `null` |
| `reward.coupon.couponLocation` | string, null | 쿠폰 사용처. 연결된 장소가 없으면 `null` |
| `reward.coupon.couponPrice` | integer | 쿠폰 금액 |

첫 번째 보물을 찾아 미션이 아직 진행 중이며 AR 캐릭터가 지급된 경우:

```json
{
  "missionProgressStatus": "IN_PROGRESS",
  "treasureCount": 3,
  "foundTreasureIndexes": [1],
  "nextLocation": null,
  "reward": {
    "arCharacter": {
      "id": 7,
      "name": "돌담이",
      "imageUrl": "https://example.com/characters/stone-spirit.png"
    },
    "point": null,
    "coupon": null
  }
}
```

두 번째 보물을 찾아 미션이 아직 진행 중이며 포인트가 지급된 경우:

```json
{
  "missionProgressStatus": "IN_PROGRESS",
  "treasureCount": 3,
  "foundTreasureIndexes": [1, 2],
  "nextLocation": null,
  "reward": {
    "arCharacter": null,
    "point": 100,
    "coupon": null
  }
}
```

마지막 보물을 찾아 미션이 완료되고 쿠폰이 지급된 경우:

```json
{
  "missionProgressStatus": "COMPLETED",
  "treasureCount": 3,
  "foundTreasureIndexes": [1, 2, 3],
  "nextLocation": {
    "id": 39,
    "locationTitle": "한담 해안 산책로",
    "locationImageUrl": "https://example.com/locations/handam.jpg",
    "distanceMeter": 4200,
    "mission": {
      "id": 342,
      "missionType": "COOPERATIVE"
    }
  },
  "reward": {
    "arCharacter": null,
    "point": null,
    "coupon": {
      "couponLocation": "종화네 막국수",
      "couponPrice": 3000
    }
  }
}
```

이전 시도에서 모든 보상을 지급받았거나 설정된 보상이 없어 이번 요청에서 지급할 보상이 없는 경우:

```json
{
  "missionProgressStatus": "IN_PROGRESS",
  "treasureCount": 3,
  "foundTreasureIndexes": [1],
  "nextLocation": null,
  "reward": {
    "arCharacter": null,
    "point": null,
    "coupon": null
  }
}
```

완료 시 지급할 보상이 없어도 `nextLocation`은 객체로 반환하며, `reward`의 각 항목은 모두 `null`로 반환한다. 장소 이미지 조회 실패는 진행도 저장을 실패시키지 않고 이미지 URL만 `null`로 반환한다. 다음 장소에 연결된 활성 미션이 없으면 `nextLocation.mission`은 `null`로 반환한다.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

Path의 타입이 올바르지 않거나 Query 좌표가 누락·허용 범위 초과인 경우, Body의 필수값이 누락되거나 타입·JSON 형식이 올바르지 않은 경우 공통 요청값 검증 실패에 해당한다.

#### 보물찾기 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도 ID에 해당하는 현재 사용자의 진행 중인 보물찾기 기록이 없는 경우. 존재하지 않는 진행도, 다른 사용자의 진행도 또는 이미 완료된 진행도에 저장을 요청한 경우를 포함한다.

```json
{
  "code": "TREASURE_MISSION_PROGRESS_NOT_FOUND",
  "message": "보물찾기 미션 진행도를 찾을 수 없습니다."
}
```

#### 비활성화된 보물찾기 미션

Status Code : `404 Not Found`

저장하려는 진행도의 보물찾기 미션 상태가 `INACTIVE`인 경우

```json
{
  "code": "TREASURE_MISSION_INACTIVE",
  "message": "비활성화된 보물찾기 미션입니다."
}
```

#### 보물 아이템 없음

Status Code : `404 Not Found`

요청한 보물 번호가 해당 진행도의 보물 목록에 존재하지 않는 경우

```json
{
  "code": "TREASURE_ITEM_NOT_FOUND",
  "message": "보물 아이템을 찾을 수 없습니다."
}
```

#### 이미 찾은 보물

Status Code : `409 Conflict`

진행 중인 기록에서 이미 발견 처리한 보물 번호를 다시 요청한 경우

```json
{
  "code": "TREASURE_ITEM_ALREADY_FOUND",
  "message": "이미 찾은 보물입니다."
}
```
