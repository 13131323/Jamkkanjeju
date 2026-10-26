# 지도 홈 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 지도 홈 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `MAP` |
| 엔드포인트 | `/api/v2/map/contents` |

### API 설명

지도 화면에 진입하거나 지도를 이동·확대·축소한 뒤 장소와 길바닥 방명록을 조회할 때 호출한다. 인증된 현재 사용자 기준으로 미션 완료 여부와 수령 쿠폰을 제공한다.

프론트는 회전·기울기가 없는 지도 화면의 좌상단·우하단 좌표, 현재 사용자 좌표와 `isClustered`를 전달한다. 지도 화면 좌표는 조회 범위를 정하고, 현재 사용자 좌표는 장소까지의 거리·예상 소요 시간을 계산하는 데 사용한다.

조회 범위는 원래 화면에서 위·아래로 각각 화면 높이의 20%, 왼쪽·오른쪽으로 각각 화면 너비의 20%를 확장한 영역이다. 중심은 유지하고 가로·세로가 각각 원래 화면의 1.4배가 된다. 장소와 길바닥 방명록 모두 이 확장 범위를 적용하며 경계 위의 항목도 포함한다.

미션이나 방명록이 없는 장소도 반환한다. 장소에 연결된 활성 미션은 `mission` 하나로 반환하고, 없거나 비활성 미션만 있으면 `null`로 반환한다. 장소에 활성 미션이 둘 이상 연결된 경우에는 조회 전체가 서버 오류로 처리된다.

방명록은 상태가 `ACTIVE`인 기록만 지도에 포함한다. 길바닥 방명록 목록·장소별 방명록 수·본인의 미션 방명록 작성 여부 모두 같은 기준을 적용하며 `INACTIVE`인 기록은 제외한다.

`isClustered=false`이면 장소 상세 정보·단일 미션·방명록 수·이미지·현재 사용자의 수령 쿠폰과 길바닥 방명록 상세 정보를 반환한다. `isClustered=true`이면 같은 범위의 항목에 대해 클러스터링에 필요한 ID·좌표와 장소의 미션 ID·유형만 반환한다. 서버가 여러 항목을 하나의 클러스터로 합치지는 않는다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |

---

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `leftTopLatitude` | number | 필수 | 확장 전 지도 화면 좌상단 위도. -90 이상 90 이하 |
| `leftTopLongitude` | number | 필수 | 확장 전 지도 화면 좌상단 경도. -180 이상 180 이하 |
| `rightBottomLatitude` | number | 필수 | 확장 전 지도 화면 우하단 위도. -90 이상 90 이하 |
| `rightBottomLongitude` | number | 필수 | 확장 전 지도 화면 우하단 경도. -180 이상 180 이하 |
| `userLatitude` | number | 필수 | 현재 사용자 위도. -90 이상 90 이하 |
| `userLongitude` | number | 필수 | 현재 사용자 경도. -180 이상 180 이하 |
| `isClustered` | boolean | 필수 | `false`: 상세 응답, `true`: 클러스터링용 간소 응답 |

좌상단 위도는 우하단 위도보다 커야 하며 좌상단 경도는 우하단 경도보다 작아야 한다. 너비나 높이가 없는 범위 또는 좌상단·우하단의 방향이 올바르지 않은 요청은 허용하지 않는다. 좌표는 유한한 숫자로 전달하고 소수 정밀도를 유지한다.

확장 전 실제 화면 좌표를 전달하며, 프론트에서 미리 확장한 좌표를 보내지 않는다. 사용자 위치는 지도 중심과 같을 필요가 없으며 조회 범위 밖에 있어도 된다. `isClustered=true`에서도 같은 필수 요청 형식을 사용한다.

요청 예시:

```http
GET /api/v2/map/contents?leftTopLatitude=33.4700&leftTopLongitude=126.9100&rightBottomLatitude=33.4300&rightBottomLongitude=126.9500&userLatitude=33.4524&userLongitude=126.9248&isClustered=false
Authorization: Bearer {accessToken}
```

---

### 요청 Path

없음

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `200 OK`

확장 조회 범위의 지도 정보가 정상적으로 조회된 경우

#### isClustered = false

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `locations` | object[] | 확장 범위 안의 장소 목록. 없으면 빈 배열 |
| `locations[].id` | integer | 장소 ID. 미션 ID가 아님 |
| `locations[].locationTitle` | string | 장소 이름 |
| `locations[].latitude` | number | 장소 위도 |
| `locations[].longitude` | number | 장소 경도 |
| `locations[].distanceMeter` | integer | 현재 사용자 위치에서 장소까지의 거리(m) |
| `locations[].durationMinutes` | integer | 현재 사용자 위치에서 장소까지의 예상 이동 시간(분) |
| `locations[].mission` | object \| null | 장소에 연결된 활성 미션 한 건. 없으면 null |
| `locations[].mission.id` | integer | 공통 미션 ID. 미션 홈 조회·시작에 사용하는 ID |
| `locations[].mission.missionType` | string | 미션 유형. `TREASURE` 또는 `COOPERATIVE` |
| `locations[].mission.missionTitle` | string | 미션 제목 |
| `locations[].mission.isCompleted` | boolean | 현재 사용자가 해당 미션을 완료한 이력이 있는지 여부 |
| `locations[].mission.hasWrittenGuestbook` | boolean \| null | 완료한 해당 미션과 장소를 참조하여 본인이 작성한 ACTIVE 방명록이 있는지 여부. 미션 미완료이면 null |
| `locations[].guestbooksCount` | integer | 해당 장소의 ACTIVE 방명록 수. 없으면 0 |
| `locations[].representativeImageUrl` | string \| null | TourAPI 장소 대표 이미지 URL. 제공하지 못하면 null |
| `locations[].receivedCoupons` | object[] \| null | 현재 사용자가 실제 지급받은 쿠폰 중 해당 장소의 쿠폰 목록. 없으면 null |
| `locations[].receivedCoupons[].couponPrice` | integer | 쿠폰 금액 |
| `locations[].receivedCoupons[].locationAddress` | string | 쿠폰 사용 장소의 주소 |
| `roadGuestbooks` | object[] | 같은 확장 범위 안의 길바닥 방명록 목록. 없으면 빈 배열 |
| `roadGuestbooks[].id` | integer | 길바닥 방명록 ID |
| `roadGuestbooks[].latitude` | number | 길바닥 방명록 위도 |
| `roadGuestbooks[].longitude` | number | 길바닥 방명록 경도 |
| `roadGuestbooks[].locationAlias` | string | 길바닥 방명록의 위치 별칭 |
| `roadGuestbooks[].representativeGuestbookImageUrl` | string \| null | 길바닥 방명록의 첨부 이미지 URL. 없으면 null |

```json
{
  "locations": [
    {
      "id": 101,
      "locationTitle": "현애원",
      "latitude": 33.4582,
      "longitude": 126.9331,
      "distanceMeter": 1004,
      "durationMinutes": 13,
      "mission": {
        "id": 301,
        "missionType": "TREASURE",
        "missionTitle": "오구포구 보물찾기",
        "isCompleted": true,
        "hasWrittenGuestbook": false
      },
      "guestbooksCount": 2,
      "representativeImageUrl": "https://example.com/locations/101.jpg",
      "receivedCoupons": [
        {
          "couponPrice": 1000,
          "locationAddress": "제주특별자치도 제주시 예시로 44"
        }
      ]
    },
    {
      "id": 103,
      "locationTitle": "바다 산책로",
      "latitude": 33.4518,
      "longitude": 126.9252,
      "distanceMeter": 76,
      "durationMinutes": 1,
      "mission": null,
      "guestbooksCount": 0,
      "representativeImageUrl": null,
      "receivedCoupons": null
    }
  ],
  "roadGuestbooks": [
    {
      "id": 131,
      "latitude": 33.4582,
      "longitude": 126.9331,
      "locationAlias": "성산 바다 앞",
      "representativeGuestbookImageUrl": "https://example.com/guestbooks/131.jpg"
    }
  ]
}
```

- `mission`은 배열이 아니며 보물찾기·협동 미션 필드를 따로 반환하지 않는다. 미션 유형은 `missionType`으로 구분한다.
- 미션 미완료 시 `hasWrittenGuestbook`은 null이고, 완료 시 작성 여부에 따라 true 또는 false이다.
- 장소에 방명록이 없어도 TourAPI 대표 이미지가 있으면 반환한다. 장소 대표 이미지와 길바닥 방명록 첨부 이미지는 서로 다른 정보다.
- `receivedCoupons`는 장소에서 제공하는 전체 쿠폰 목록이 아니다. 현재 사용자가 지급받지 않은 쿠폰은 포함하지 않는다.
- 상세 응답의 nullable 필드는 값이 없어도 생략하지 않고 null로 반환한다.

#### isClustered = true

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `locations` | object[] | 같은 확장 범위 안의 장소 목록. 없으면 빈 배열 |
| `locations[].id` | integer | 장소 ID |
| `locations[].latitude` | number | 장소 위도 |
| `locations[].longitude` | number | 장소 경도 |
| `locations[].missionId` | integer \| null | 장소에 연결된 활성 미션의 공통 미션 ID. 없으면 null |
| `locations[].missionType` | string \| null | 활성 미션 유형. `TREASURE` 또는 `COOPERATIVE`. 없으면 null |
| `roadGuestbooks` | object[] | 같은 확장 범위 안의 길바닥 방명록 목록. 없으면 빈 배열 |
| `roadGuestbooks[].id` | integer | 길바닥 방명록 ID |
| `roadGuestbooks[].latitude` | number | 길바닥 방명록 위도 |
| `roadGuestbooks[].longitude` | number | 길바닥 방명록 경도 |

```json
{
  "locations": [
    {
      "id": 101,
      "latitude": 33.4582,
      "longitude": 126.9331,
      "missionId": 301,
      "missionType": "TREASURE"
    },
    {
      "id": 102,
      "latitude": 33.4561,
      "longitude": 126.9295,
      "missionId": 401,
      "missionType": "COOPERATIVE"
    },
    {
      "id": 103,
      "latitude": 33.4518,
      "longitude": 126.9252,
      "missionId": null,
      "missionType": null
    }
  ],
  "roadGuestbooks": [
    {
      "id": 131,
      "latitude": 33.4582,
      "longitude": 126.9331
    }
  ]
}
```

간소 응답에서는 장소 이름·거리·예상 시간·미션 상세 객체·방명록 수·이미지·수령 쿠폰·길바닥 방명록 상세 필드를 반환하지 않는다. 해당 필드를 null로 나열하는 것이 아니라 응답에서 제외한다. 미션이 없는 장소의 `missionId`와 `missionType`은 둘 다 null로 유지한다.

두 응답 모두 조회 결과가 없으면 `locations`와 `roadGuestbooks`를 빈 배열로 반환하며, 결과 없음 자체는 오류가 아니다.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

필수 쿼리 누락·타입 오류·좌표 허용 범위 초과·유한하지 않은 좌표·올바른 사각형을 만들지 못하는 화면 좌표는 공통 요청값 검증 실패를 따른다. 장소별 활성 미션 중복 등 서버 데이터 이상은 공통 서버 오류를 따른다. 별도 도메인 오류는 정의하지 않는다.

---

# 지도 모달 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 지도 모달 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `MAP` |
| 엔드포인트 | `/api/v2/map/modals` |

### API 설명

지도에서 장소 또는 길바닥 방명록 아이콘을 선택했을 때 호출한다. 인증된 현재 사용자 기준으로 선택한 대상의 모달 정보를 조회한다.

`targetType=LOCATION`이면 장소 기본 정보·대표 이미지·거리·예상 이동 시간·현재 사용자의 방문 여부·연결된 활성 미션과 전체 보상 및 수령 여부·최신 활성 장소 방명록을 반환한다. `targetType=ROAD_GUESTBOOK`이면 활성 길바닥 방명록의 작성자 닉네임·위치 별칭·거리·예상 이동 시간과 저장된 콘텐츠를 반환한다.

두 대상은 하나의 API에서 조회하되 유형별 응답 구조를 구분하며, 공통 래퍼 없이 해당 유형의 응답만 반환한다. 미션 자체를 조회 대상으로 받지는 않는다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |

---

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `targetType` | string | 필수 | 조회 대상 유형. `LOCATION` 또는 `ROAD_GUESTBOOK` |
| `targetId` | integer | 필수 | 1 이상의 정수. `LOCATION`이면 장소 ID, `ROAD_GUESTBOOK`이면 길바닥 방명록 ID. 미션 ID가 아님 |
| `userLatitude` | number | 필수 | 현재 사용자 위도. -90 이상 90 이하 |
| `userLongitude` | number | 필수 | 현재 사용자 경도. -180 이상 180 이하 |

좌표는 유한한 숫자로 전달하며 소수 정밀도를 유지한다. 현재 사용자 위치는 선택한 장소 또는 길바닥 방명록의 위치와 달라도 된다.

장소 모달 요청 예시:

```http
GET /api/v2/map/modals?targetType=LOCATION&targetId=39&userLatitude=33.4524&userLongitude=126.9248
Authorization: Bearer {accessToken}
```

길바닥 방명록 모달 요청 예시:

```http
GET /api/v2/map/modals?targetType=ROAD_GUESTBOOK&targetId=100&userLatitude=33.4524&userLongitude=126.9248
Authorization: Bearer {accessToken}
```

---

### 요청 Path

없음

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `200 OK`

선택한 장소 또는 활성 길바닥 방명록의 모달 정보가 정상적으로 조회된 경우

#### targetType = LOCATION

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | integer | 장소 ID |
| `locationTitle` | string | 장소 이름 |
| `locationCategory` | string | 장소 분류 |
| `representativeImageUrl` | string \| null | 장소 대표 이미지 URL. 원본을 우선하고 없으면 축소 이미지를 사용하며, 이미지가 없거나 조회에 실패하면 null |
| `distanceMeter` | integer | 현재 사용자 위치에서 장소까지의 거리(m) |
| `durationMinutes` | integer | 현재 사용자 위치에서 장소까지의 예상 이동 시간(분) |
| `isVisited` | boolean | 현재 사용자의 해당 장소 방문 기록이 있으면 true, 없으면 false |
| `mission` | object \| null | 장소에 연결된 활성 미션 한 건. 없거나 비활성 미션만 있으면 null |
| `mission.missionId` | integer | 공통 미션 ID. 미션 홈 조회·시작에 사용하는 ID |
| `mission.missionType` | string | 미션 유형. `TREASURE` 또는 `COOPERATIVE` |
| `mission.missionTitle` | string | 미션 제목 |
| `mission.isCompleted` | boolean | 현재 사용자의 해당 미션 완료 여부. 보상 수령 여부와 별개 |
| `mission.rewardDetail` | object | 해당 미션에 설정된 전체 보상과 현재 사용자의 수령 여부. 보상이 없어도 객체를 반환하며 각 보상 항목은 null |
| `mission.rewardDetail.arCharacter` | object \| null | AR 캐릭터 보상 정보. 설정된 보상이 없으면 null |
| `mission.rewardDetail.arCharacter.id` | integer | AR 캐릭터 ID |
| `mission.rewardDetail.arCharacter.name` | string | AR 캐릭터 이름 |
| `mission.rewardDetail.arCharacter.imageUrl` | string | AR 캐릭터 이미지 URL |
| `mission.rewardDetail.arCharacter.isReceived` | boolean | 현재 사용자가 해당 미션의 AR 캐릭터 보상을 지급받았는지 여부 |
| `mission.rewardDetail.point` | object \| null | 포인트 보상 정보. 설정된 보상이 없으면 null |
| `mission.rewardDetail.point.amount` | integer | 포인트 보상량 |
| `mission.rewardDetail.point.isReceived` | boolean | 현재 사용자가 해당 미션의 포인트 보상을 지급받았는지 여부 |
| `mission.rewardDetail.coupon` | object \| null | 쿠폰 보상 정보. 설정된 보상이 없으면 null |
| `mission.rewardDetail.coupon.couponLocation` | string \| null | 쿠폰 사용처. 연결된 장소가 없으면 null |
| `mission.rewardDetail.coupon.couponPrice` | integer | 쿠폰 금액 |
| `mission.rewardDetail.coupon.isReceived` | boolean | 현재 사용자가 해당 미션의 쿠폰 보상을 지급받았는지 여부 |
| `guestbooksCount` | integer | 해당 장소에 연결된 모든 ACTIVE 장소 방명록의 개수. 없으면 0 |
| `guestbooks` | object[] | 해당 장소의 ACTIVE 장소 방명록 중 방문일 내림차순, 같은 방문일이면 ID 내림차순으로 최대 3개. 없으면 빈 배열 |
| `guestbooks[].id` | integer | 장소 방명록 ID |
| `guestbooks[].representativeImageUrl` | string \| null | 방명록에 저장된 단일 첨부 이미지 URL. 없으면 null |
| `guestbooks[].userId` | integer \| null | 작성자 사용자 ID. 작성자가 없으면 null |
| `guestbooks[].userNickname` | string \| null | 작성자 닉네임. 작성자 또는 닉네임이 없으면 null |
| `guestbooks[].characterImgUrl` | string \| null | 작성자의 온보딩 결과 프로필 이미지 URL. 작성자 또는 온보딩 결과가 없으면 null |
| `guestbooks[].missionTitle` | string \| null | 방명록이 참조하는 미션 제목. 연결된 미션이 없으면 null |
| `guestbooks[].visitedAt` | string | 방명록 방문일. `YYYY-MM-DD` 형식 |
| `guestbooks[].contentWriting` | string \| null | 방명록 글 내용. 없으면 null |

```json
{
  "id": 39,
  "locationTitle": "현애원",
  "locationCategory": "관광지",
  "representativeImageUrl": "https://example.com/locations/39.jpg",
  "distanceMeter": 1200,
  "durationMinutes": 16,
  "isVisited": true,
  "mission": {
    "missionId": 31,
    "missionType": "TREASURE",
    "missionTitle": "오구포구 보물찾기",
    "isCompleted": true,
    "rewardDetail": {
      "arCharacter": {
        "id": 3,
        "name": "돌담이",
        "imageUrl": "https://example.com/characters/3.png",
        "isReceived": true
      },
      "point": {
        "amount": 100,
        "isReceived": true
      },
      "coupon": {
        "couponLocation": "현애원 카페",
        "couponPrice": 3000,
        "isReceived": false
      }
    }
  },
  "guestbooksCount": 10,
  "guestbooks": [
    {
      "id": 300,
      "representativeImageUrl": "https://example.com/guestbooks/300.jpg",
      "userId": 1,
      "userNickname": "제주 여행자",
      "characterImgUrl": "https://example.com/onboarding/photographer.png",
      "missionTitle": "오구포구 보물찾기",
      "visitedAt": "2026-10-25",
      "contentWriting": "산책하기 좋았어요."
    },
    {
      "id": 302,
      "representativeImageUrl": null,
      "userId": null,
      "userNickname": null,
      "characterImgUrl": null,
      "missionTitle": null,
      "visitedAt": "2026-10-23",
      "contentWriting": "조용한 장소였어요."
    }
  ]
}
```

- `mission`은 단일 객체이며, 미션이나 방명록이 없는 장소도 정상 응답한다. 연결된 활성 미션이 여러 개이면 조회 전체를 서버 오류로 처리한다.
- `rewardDetail`은 남은 보상만 반환하는 값이 아니다. 이미 받은 보상도 상세 정보는 유지하고 해당 `isReceived`를 true로 반환한다. 지급 이력이 없으면 설정된 각 보상의 `isReceived`는 false다.
- `guestbooksCount`는 최대 3개인 `guestbooks`의 길이가 아니라 해당 장소의 ACTIVE 장소 방명록 전체 개수다. 길바닥 방명록은 이 개수에 포함하지 않는다.
- 방문 여부와 방명록 작성 여부·미션 완료 여부는 서로 다른 값이다.
- 장소 대표 이미지와 방명록 첨부 이미지는 서로 다르며, 작성자의 `characterImgUrl`은 미션 보상 AR 캐릭터 이미지가 아니다.
- 작성자가 없어도 대상 장소에 연결된 ACTIVE 방명록은 목록과 개수에 포함하고, 작성자 관련 값만 null로 반환한다.

#### targetType = ROAD_GUESTBOOK

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | integer | 길바닥 방명록 ID |
| `userNickname` | string \| null | 작성자 닉네임. 작성자 또는 닉네임이 없으면 null |
| `locationAlias` | string | 작성자가 지정한 위치 별칭 |
| `distanceMeter` | integer | 현재 사용자 위치에서 길바닥 방명록까지의 거리(m) |
| `durationMinutes` | integer | 현재 사용자 위치에서 길바닥 방명록까지의 예상 이동 시간(분) |
| `visitedAt` | string | 방명록 방문일. `YYYY-MM-DD` 형식 |
| `contentImageUrl` | string \| null | 저장된 단일 사진 URL. 없으면 null |
| `contentWriting` | string \| null | 저장된 글 내용. 없으면 null |
| `contentAudioUrl` | string \| null | 저장된 단일 음성 URL. 없으면 null |
| `contentWeather` | string \| null | 저장된 날씨 콘텐츠. 없으면 null |
| `contentColorCode` | string \| null | 저장된 색상 코드 콘텐츠. 없으면 null |

```json
{
  "id": 100,
  "userNickname": "제주 여행자",
  "locationAlias": "성산 바다 앞",
  "distanceMeter": 850,
  "durationMinutes": 11,
  "visitedAt": "2026-10-25",
  "contentImageUrl": "https://example.com/guestbooks/100.jpg",
  "contentWriting": "잠시 쉬어가기 좋았어요.",
  "contentAudioUrl": "https://example.com/guestbooks/100.mp3",
  "contentWeather": "맑음",
  "contentColorCode": null
}
```

- `contentImageUrl`과 `contentAudioUrl`은 배열이 아닌 단일 URL이다.
- 작성자가 없어도 ACTIVE 길바닥 방명록은 조회할 수 있으며 `userNickname`만 null로 반환한다.
- nullable 필드는 값이 없어도 키를 생략하지 않고 null로 반환한다. 두 응답 유형에만 있는 필드들을 하나의 객체에 합쳐 나열하지 않는다.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

#### 조회 대상 없음

Status Code : `404 Not Found`

`targetType`에 해당하는 장소 또는 길바닥 방명록이 존재하지 않거나, 조회한 길바닥 방명록이 INACTIVE인 경우

```json
{
  "code": "MAP_MODAL_TARGET_NOT_FOUND",
  "message": "조회할 장소 또는 길바닥 방명록을 찾을 수 없습니다."
}
```
