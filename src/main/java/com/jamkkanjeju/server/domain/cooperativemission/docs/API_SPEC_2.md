# 협동 미션 상태 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 협동 미션 상태 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress` |

### API 설명

방장과 팀원이 협동 미션 방의 최신 상태를 조회할 때 호출한다. 참여 요청 후 대기 중인 사용자도 조회할 수 있다.

프론트는 1단계부터 완료될 때까지 이 API를 폴링하여 참여 요청 수락·거절, 역할 배정, 미션 수행 및 완료 상태를 확인한다.

단계는 `1: 초대·역할 배정 → 2: 미션 수행 → 3: 미션 완료`이다. 역할 배정은 초대와 함께 1단계에서 진행하며 별도 단계로 분리하지 않는다.

1·2단계에서는 현재 참가자, 방장과 대기·수락된 팀원, 공통 역할 카드 전체, 저장된 역할 진행도와 집계값을 반환한다. 아직 역할이 배정되지 않았으면 `roleProgresses`는 빈 배열이고 두 집계값은 `0`이다. 하나의 역할 카드는 팀에서 최대 한 명에게 배정되며 한 참가자는 여러 역할을 맡을 수 있다. 모든 역할 카드를 배정할 필요는 없다.

3단계에서는 참가자·역할 관련 필드는 `null`로 반환하고 완료 장소, 현재 사용자의 완료 보상 정보와 다음 추천 장소를 반환한다. 이 API는 조회 전용으로, 호출하거나 반복 폴링해도 보상을 새로 지급하지 않는다.

보상은 수행 결과와 관계없이 해당 미션을 처음 완료하는 수락된 참가자에게 설정된 AR 캐릭터·포인트·쿠폰을 모두 제공한다. 방장과 팀원을 구분하지 않으며 같은 미션을 재도전해 완료한 경우에는 보상을 제공하지 않는다.

완료 응답의 `reward`는 현재 사용자에게 해당 팀에서 지급된 보상이다. 현재 사용자의 최초 완료 팀을 조회하면 지급된 보상을 반환하고, 이후 재도전 팀을 조회하면 세 보상 항목을 모두 `null`로 반환한다. 따라서 같은 팀의 상태를 조회해도 사용자별 보상 응답은 다를 수 있다.

사용자 좌표는 완료 단계의 다음 추천 장소와 거리 정보에 사용한다. 1·2단계에서도 같은 요청 형식으로 전달한다.

거절되어 참가자 정보가 없어진 사용자는 `COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND`를 받으며 프론트는 폴링을 중단한다. 완료 응답이나 비활성 미션 오류를 받은 경우에도 폴링을 중단한다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |

---

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `latitude` | number | 필수 | 사용자 현재 위도. `-90` 이상 `90` 이하 |
| `longitude` | number | 필수 | 사용자 현재 경도. `-180` 이상 `180` 이하 |

---

### 요청 Path

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `cooperativeMissionProgressId` | integer | 필수 | 조회할 팀의 협동 미션 진행도 ID |

요청 예시:

```http
GET /api/v2/cooperative-missions/10/progress?latitude=33.4996&longitude=126.5312
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `200 OK`

현재 사용자가 참가자로 등록된 팀의 상태를 조회한 경우. 완료된 팀도 조회할 수 있다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `missionProgressId` | number | 협동 미션 진행도 id |
| `missionId` | integer | 협동 미션의 공통 미션 ID |
| `missionTitle` | string | 협동 미션 제목 |
| `missionProgressStatus` | string | 협동 미션 진행 상태. `IN_PROGRESS \| COMPLETED` |
| `currentStep` | integer | 현재 단계. `1: 초대·역할 배정, 2: 미션 수행, 3: 미션 완료` |
| `completedLocation` | object 또는 null | 완료한 협동 미션의 장소. 1·2단계 또는 연결된 장소가 없으면 `null` |
| `completedLocation.locationId` | number | 완료한 협동 미션이 진행된 `LOCATION.id` |
| `completedLocation.locationTitle` | string | 완료한 협동 미션이 진행된 장소명 |
| `currentParticipant` | object \| null | Bearer 토큰으로 식별한 현재 사용자의 참가자 정보. 3단계이면 `null` |
| `currentParticipant.participantId` | number | 현재 사용자의 참가자 id |
| `currentParticipant.participantRole` | string | 현재 사용자의 역할. `HOST \| MEMBER` |
| `currentParticipant.participantStatus` | string | 현재 사용자의 참여 상태. `PENDING \| ACCEPTED` |
| `participants` | object[] 또는 null | 해당 팀의 방장과 참여 요청 목록. 3단계이면 `null` |
| `participants[].participantId` | number | 참가자 id |
| `participants[].name` | string | 참가자 닉네임 |
| `participants[].participantRole` | string | 참가자 역할. `HOST \| MEMBER` |
| `participants[].participantStatus` | string | 참여 상태. `PENDING \| ACCEPTED` |
| `roleCards` | object[] 또는 null | 공통 역할 카드 전체 목록. 1·2단계에서 반환하고 3단계이면 `null` |
| `roleCards[].roleCardId` | number | 역할 카드 id |
| `roleCards[].roleName` | string | 역할 이름 |
| `roleCards[].roleDescription` | string | 역할 설명 |
| `roleCards[].locationToFind` | string[] | 역할 수행을 위해 찾아야 하는 장소 또는 대상 |
| `roleProgresses` | object[] 또는 null | 현재 저장된 역할 배정·수행 목록. 1·2단계에서 반환하고 배정이 없으면 빈 배열, 3단계이면 `null` |
| `roleProgresses[].participantId` | number | 역할을 맡은 참가자 id |
| `roleProgresses[].participantName` | string | 역할을 맡은 참가자 닉네임 |
| `roleProgresses[].roleCardId` | number | 배정된 역할 카드 id |
| `roleProgresses[].roleName` | string | 배정된 역할 이름 |
| `roleProgresses[].progressStatus` | string | 역할 인증 진행 상태. `IN_PROGRESS \| COMPLETED` |
| `roleProgresses[].itemImgUrl` | string \| null | 역할 인증 이미지 URL. 저장된 이미지가 없으면 `null` |
| `completedRoleCount` | number \| null | 저장된 역할 진행도 중 인증을 완료한 수. 1·2단계에서만 반환 |
| `totalRoleCount` | number \| null | 실제로 생성된 역할 진행도 수. 1·2단계에서만 반환하며 배정하지 않은 역할 카드는 포함하지 않음 |
| `reward` | object \| null | 해당 팀에서 현재 사용자에게 지급된 완료 보상. 3단계에서 객체로 반환하며 재도전이면 모든 항목이 `null` |
| `reward.arCharacter` | object \| null | 지급된 AR 캐릭터. 지급되지 않았으면 `null` |
| `reward.arCharacter.id` | number | AR 캐릭터 id |
| `reward.arCharacter.name` | string | AR 캐릭터 이름 |
| `reward.arCharacter.imageUrl` | string | AR 캐릭터 이미지 URL |
| `reward.point` | number \| null | 지급된 포인트. 지급되지 않았으면 `null` |
| `reward.coupon` | object \| null | 지급된 쿠폰. 지급되지 않았으면 `null` |
| `reward.coupon.couponLocation` | string | 쿠폰 사용처 |
| `reward.coupon.couponPrice` | number | 쿠폰 금액 |
| `nextLocation` | object \| null | 다음 추천 장소. 3단계에서만 객체로 반환 |
| `nextLocation.id` | number | 다음 장소 id |
| `nextLocation.locationTitle` | string | 다음 장소명 |
| `nextLocation.locationImageUrl` | string \| null | 다음 장소 이미지 URL. 조회하지 못하면 `null` |
| `nextLocation.distanceMeter` | number | Query의 사용자 위치에서 다음 장소까지의 직선거리(m) |
| `nextLocation.mission` | object \| null | 다음 장소의 미션. 연결된 미션이 없으면 `null` |
| `nextLocation.mission.id` | number | 다음 미션 id |
| `nextLocation.mission.missionType` | string | 다음 미션 유형. `CULTURE \| COOPERATIVE \| TREASURE` |

1단계: 초대·역할 배정 중인 경우

```json
{
  "missionProgressId": 10,
  "missionId": 12,
  "missionTitle": "함께 키우는 귤나무",
  "missionProgressStatus": "IN_PROGRESS",
  "currentStep": 1,
  "completedLocation": null,
  "currentParticipant": {
    "participantId": 1,
    "participantRole": "HOST",
    "participantStatus": "ACCEPTED"
  },
  "participants": [
    {
      "participantId": 1,
      "name": "나민",
      "participantRole": "HOST",
      "participantStatus": "ACCEPTED"
    },
    {
      "participantId": 2,
      "name": "이서연",
      "participantRole": "MEMBER",
      "participantStatus": "PENDING"
    },
    {
      "participantId": 3,
      "name": "김민우",
      "participantRole": "MEMBER",
      "participantStatus": "ACCEPTED"
    }
  ],
  "roleCards": [
    {
      "roleCardId": 1,
      "roleName": "땅지기",
      "roleDescription": "귤나무가 뿌리를 내릴 건강한 땅을 찾고 비료를 주는 역할입니다.",
      "locationToFind": [
        "화산토",
        "흙길",
        "밭",
        "퇴비 주변"
      ]
    },
    {
      "roleCardId": 2,
      "roleName": "물지기",
      "roleDescription": "귤나무에 생명을 불어넣는 물을 찾는 역할입니다.",
      "locationToFind": [
        "용천수",
        "물길",
        "연못",
        "젖은 돌 주변"
      ]
    },
    {
      "roleCardId": 3,
      "roleName": "빛지기",
      "roleDescription": "귤이 달콤하게 익을 수 있도록 햇빛이 잘 드는 장소를 찾는 역할입니다.",
      "locationToFind": [
        "양지바른 길",
        "햇살 드는 공터",
        "남향 돌담",
        "빛이 비치는 나무 아래"
      ]
    },
    {
      "roleCardId": 4,
      "roleName": "바람지기",
      "roleDescription": "어린 귤나무를 강한 바람으로부터 지켜줄 장소를 찾는 역할입니다.",
      "locationToFind": [
        "돌담",
        "낮은 언덕 뒤",
        "건물 사이 골목",
        "방풍림"
      ]
    },
    {
      "roleCardId": 5,
      "roleName": "이웃지기",
      "roleDescription": "귤나무와 함께 살아갈 수 있는 자연의 흔적을 찾는 역할입니다.",
      "locationToFind": [
        "꽃밭",
        "풀숲",
        "주변 나무",
        "곤충의 흔적"
      ]
    },
    {
      "roleCardId": 6,
      "roleName": "수확지기",
      "roleDescription": "제주 사람들의 손길과 감귤 수확의 흔적이 담긴 장소를 찾는 역할입니다.",
      "locationToFind": [
        "감귤 농장",
        "귤 창고",
        "수확 도구",
        "오래된 과수원"
      ]
    }
  ],
  "roleProgresses": [
    {
      "participantId": 1,
      "participantName": "나민",
      "roleCardId": 1,
      "roleName": "땅지기",
      "progressStatus": "IN_PROGRESS",
      "itemImgUrl": null
    },
    {
      "participantId": 2,
      "participantName": "이서연",
      "roleCardId": 2,
      "roleName": "물지기",
      "progressStatus": "IN_PROGRESS",
      "itemImgUrl": null
    }
  ],
  "completedRoleCount": 0,
  "totalRoleCount": 2,
  "reward": null,
  "nextLocation": null
}
```

현재 사용자가 대기 중인 팀원이면 `currentParticipant.participantStatus`는 `PENDING`이며, 방장이 수락하면 이후 폴링 응답부터 `ACCEPTED`가 된다. 역할 배정이 없으면 `roleProgresses: []`, `completedRoleCount: 0`, `totalRoleCount: 0`을 반환한다.

2단계: 미션 수행 중인 경우

```json
{
  "missionProgressId": 10,
  "missionId": 12,
  "missionTitle": "함께 키우는 귤나무",
  "missionProgressStatus": "IN_PROGRESS",
  "currentStep": 2,
  "completedLocation": null,
  "currentParticipant": {
    "participantId": 2,
    "participantRole": "MEMBER",
    "participantStatus": "ACCEPTED"
  },
  "participants": [
    {
      "participantId": 1,
      "name": "나민",
      "participantRole": "HOST",
      "participantStatus": "ACCEPTED"
    },
    {
      "participantId": 2,
      "name": "이서연",
      "participantRole": "MEMBER",
      "participantStatus": "ACCEPTED"
    }
  ],
  "roleCards": [
    {
      "roleCardId": 1,
      "roleName": "땅지기",
      "roleDescription": "귤나무가 뿌리를 내릴 건강한 땅을 찾고 비료를 주는 역할입니다.",
      "locationToFind": [
        "화산토",
        "흙길",
        "밭",
        "퇴비 주변"
      ]
    },
    {
      "roleCardId": 2,
      "roleName": "물지기",
      "roleDescription": "귤나무에 생명을 불어넣는 물을 찾는 역할입니다.",
      "locationToFind": [
        "용천수",
        "물길",
        "연못",
        "젖은 돌 주변"
      ]
    },
    {
      "roleCardId": 3,
      "roleName": "빛지기",
      "roleDescription": "귤이 달콤하게 익을 수 있도록 햇빛이 잘 드는 장소를 찾는 역할입니다.",
      "locationToFind": [
        "양지바른 길",
        "햇살 드는 공터",
        "남향 돌담",
        "빛이 비치는 나무 아래"
      ]
    },
    {
      "roleCardId": 4,
      "roleName": "바람지기",
      "roleDescription": "어린 귤나무를 강한 바람으로부터 지켜줄 장소를 찾는 역할입니다.",
      "locationToFind": [
        "돌담",
        "낮은 언덕 뒤",
        "건물 사이 골목",
        "방풍림"
      ]
    },
    {
      "roleCardId": 5,
      "roleName": "이웃지기",
      "roleDescription": "귤나무와 함께 살아갈 수 있는 자연의 흔적을 찾는 역할입니다.",
      "locationToFind": [
        "꽃밭",
        "풀숲",
        "주변 나무",
        "곤충의 흔적"
      ]
    },
    {
      "roleCardId": 6,
      "roleName": "수확지기",
      "roleDescription": "제주 사람들의 손길과 감귤 수확의 흔적이 담긴 장소를 찾는 역할입니다.",
      "locationToFind": [
        "감귤 농장",
        "귤 창고",
        "수확 도구",
        "오래된 과수원"
      ]
    }
  ],
  "roleProgresses": [
    {
      "participantId": 1,
      "participantName": "나민",
      "roleCardId": 1,
      "roleName": "땅지기",
      "progressStatus": "COMPLETED",
      "itemImgUrl": null
    },
    {
      "participantId": 2,
      "participantName": "이서연",
      "roleCardId": 2,
      "roleName": "물지기",
      "progressStatus": "IN_PROGRESS",
      "itemImgUrl": null
    },
    {
      "participantId": 1,
      "participantName": "나민",
      "roleCardId": 3,
      "roleName": "빛지기",
      "progressStatus": "IN_PROGRESS",
      "itemImgUrl": null
    }
  ],
  "completedRoleCount": 1,
  "totalRoleCount": 3,
  "reward": null,
  "nextLocation": null
}
```

3단계: 현재 사용자가 해당 미션을 처음 완료하여 설정된 보상을 모두 받은 경우

```json
{
  "missionProgressId": 10,
  "missionId": 12,
  "missionTitle": "함께 키우는 귤나무",
  "missionProgressStatus": "COMPLETED",
  "currentStep": 3,
  "completedLocation": {
    "locationId": 68,
    "locationTitle": "제주레저힐링축제"
  },
  "currentParticipant": null,
  "participants": null,
  "roleCards": null,
  "roleProgresses": null,
  "completedRoleCount": null,
  "totalRoleCount": null,
  "reward": {
    "arCharacter": {
      "id": 1,
      "name": "감귤 캐릭터",
      "imageUrl": "https://example.com/characters/tangerine.png"
    },
    "point": 100,
    "coupon": {
      "couponLocation": "제주 감귤 카페",
      "couponPrice": 5000
    }
  },
  "nextLocation": {
    "id": 39,
    "locationTitle": "한담 해안 산책로",
    "locationImageUrl": "https://example.com/locations/handam.jpg",
    "distanceMeter": 4200,
    "mission": {
      "id": 342,
      "missionType": "TREASURE"
    }
  }
}
```

완료 장소가 없으면 `completedLocation`은 `null`이다. 완료 장소가 있으면 프론트는 `completedLocation.locationId`와 `locationTitle`을 장소 방명록 작성에 사용한다.

재도전 팀의 완료 응답은 나머지 필드 형식이 동일하며 `reward`만 다음과 같다. 최초 완료 팀에서는 미션에 설정되지 않은 보상 항목만 `null`일 수 있다.

```json
{
  "reward": {
    "arCharacter": null,
    "point": null,
    "coupon": null
  }
}
```

완료 보상이 없어도 `reward`는 객체이며 지급되지 않은 항목은 각각 `null`이다. 추천 장소가 없으면 `nextLocation`, 추천 장소에 연결된 미션이 없으면 `nextLocation.mission`은 `null`이다. 장소 이미지를 조회하지 못하면 `locationImageUrl`은 `null`이다.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

경로를 정수로 변환할 수 없거나 좌표가 누락·비숫자·허용 범위 밖인 경우는 공통 요청값 검증 실패에 해당한다.

#### 협동 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도 ID에 해당하는 팀 진행도가 없는 경우. 완료된 진행도는 이 오류에 해당하지 않는다.

```json
{
  "code": "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND",
  "message": "진행 중인 협동 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

조회 대상 팀의 협동 미션이 `INACTIVE`인 경우

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

#### 협동 미션 참가자 없음

Status Code : `404 Not Found`

현재 사용자가 해당 진행도의 참가자가 아닌 경우. 참여 요청 거절로 참가자 정보가 삭제된 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND",
  "message": "협동 미션 참여 요청을 찾을 수 없습니다."
}
```

# 협동 미션 진행도 저장 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 협동 미션 진행도 저장 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress` |

### API 설명

수락된 방장이 협동 미션을 다음 단계로 변경할 때 호출한다.

단계는 `1: 초대·역할 배정 → 2: 미션 수행 → 3: 미션 완료`이며 한 단계씩만 이동할 수 있다. 요청의 `currentStep`에는 변경하려는 다음 단계를 전달한다.

`1 → 2`로 변경하려면 대기 중인 참여 요청이 없어야 하며, 방장을 포함한 수락된 참가자 모두가 역할 카드를 최소 하나 배정받아야 한다. 모든 역할 카드를 배정할 필요는 없고 한 참가자가 여러 역할을 맡아도 된다.

`2 → 3`으로 변경하려면 배정된 역할의 인증이 모두 완료되어야 한다. 미인증 역할이 남은 상태에서 종료하려면 별도의 협동 미션 중단 API를 사용한다.

완료 시 해당 미션을 처음 완료하는 수락된 참가자에게 설정된 AR 캐릭터·포인트·쿠폰을 모두 제공한다. 방장과 팀원을 구분하지 않으며 재도전 참가자에게는 추가 보상을 제공하지 않는다.

성공하면 응답 본문 없이 반환한다. 변경된 팀 상태와 사용자별 보상 정보는 협동 미션 상태 조회 API의 폴링 응답으로 확인한다. 이 API에서 역할을 배정하거나 다음 장소를 추천하지 않는다.

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

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `cooperativeMissionProgressId` | integer | 필수 | 단계를 변경할 팀의 협동 미션 진행도 ID |

요청 예시:

```http
PATCH /api/v2/cooperative-missions/10/progress
Authorization: Bearer {accessToken}
Content-Type: application/json
```

---

### 요청 Body

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `currentStep` | integer | 필수 | 변경할 다음 단계. `2: 미션 수행, 3: 미션 완료` |

1단계에서 미션 수행 단계로 변경하는 경우

```json
{
  "currentStep": 2
}
```

2단계에서 미션을 완료하는 경우

```json
{
  "currentStep": 3
}
```

---

### 정상 응답 데이터

Status Code : `204 No Content`

다음 단계로 변경하거나 미션 완료 및 보상 처리를 마친 경우

응답 Body 없음

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

경로를 정수로 변환할 수 없거나 요청 본문·`currentStep`이 누락되거나 정수 형식이 아닌 경우는 공통 요청값 검증 실패에 해당한다. 정수이지만 허용되지 않는 단계 요청은 아래 단계 변경 오류로 처리한다.

#### 방장 전용 요청

Status Code : `403 Forbidden`

현재 사용자가 해당 팀의 수락된 방장이 아닌 경우

```json
{
  "code": "COOPERATIVE_MISSION_HOST_ONLY",
  "message": "협동 미션 방장만 참여 요청을 처리할 수 있습니다."
}
```

#### 협동 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도 ID에 해당하는 팀 진행도가 없는 경우

```json
{
  "code": "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND",
  "message": "진행 중인 협동 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

변경 대상 팀의 협동 미션이 `INACTIVE`인 경우

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

#### 허용되지 않는 단계 변경

Status Code : `409 Conflict`

이미 완료된 팀의 변경 요청, 동일 단계·역행·건너뛰기·지원하지 않는 단계 요청 또는 역할 인증이 모두 끝나지 않은 상태의 완료 요청인 경우

```json
{
  "code": "COOPERATIVE_MISSION_STEP_NOT_ALLOWED",
  "message": "현재 단계에서 허용되지 않는 요청입니다."
}
```

#### 대기 중인 참가자 존재

Status Code : `409 Conflict`

`1 → 2` 변경 시 수락하거나 거절하지 않은 대기 참가자가 있는 경우

```json
{
  "code": "COOPERATIVE_MISSION_PENDING_PARTICIPANT_EXISTS",
  "message": "대기 중인 참여 요청을 모두 처리해야 합니다."
}
```

#### 참가자 역할 배정 필요

Status Code : `409 Conflict`

`1 → 2` 변경 시 방장을 포함한 수락된 참가자 중 역할 카드를 하나도 배정받지 않은 참가자가 있는 경우

```json
{
  "code": "COOPERATIVE_PARTICIPANT_ROLE_REQUIRED",
  "message": "모든 수락된 참가자에게 역할을 배정해야 합니다."
}
```

# 협동 미션 역할 배정 저장 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 협동 미션 역할 배정 저장 |
| HTTP 메서드 | `PUT` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}` |

### API 설명

수락된 방장이 협동 미션의 1단계인 초대·역할 배정 단계에서 역할 카드 하나의 담당자를 배정하거나 변경할 때 호출한다.

경로의 `roleCardId`로 배정할 역할 카드를 지정하고, 요청 본문의 `participantId`로 해당 역할을 맡을 참가자를 지정한다. 배정 대상은 같은 팀의 수락된 참가자이며 방장 본인도 포함한다.

해당 팀에서 아직 배정하지 않은 역할 카드이면 새로 배정하고, 이미 배정된 카드이면 담당자를 변경한다. 같은 역할 카드는 팀에서 한 명에게만 배정할 수 있으며, 한 참가자가 서로 다른 여러 역할을 맡을 수 있다. 모든 역할 카드를 배정할 필요는 없다.

담당자를 변경한 결과 이전 담당자에게 역할이 하나도 남지 않아도 저장할 수 있다. 수락된 참가자 전원의 역할 배정 여부는 미션 수행 단계로 넘어갈 때 확인한다.

같은 카드와 같은 참가자로 반복 요청하면 배정을 변경하지 않고 성공한다. 수행·완료 단계 또는 이미 완료된 팀에서는 신규 배정과 담당자 변경을 모두 허용하지 않는다.

성공하면 응답 본문 없이 반환한다. 프론트는 협동 미션 상태 조회 API의 다음 폴링 응답에서 변경된 역할 배정을 확인한다.

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

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `cooperativeMissionProgressId` | integer | 필수 | 역할을 배정할 팀의 협동 미션 진행도 ID |
| `roleCardId` | integer | 필수 | 담당자를 배정하거나 변경할 공통 역할 카드 ID |

요청 예시:

```http
PUT /api/v2/cooperative-missions/10/role-assignments/1
Authorization: Bearer {accessToken}
Content-Type: application/json
```

---

### 요청 Body

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `participantId` | integer | 필수 | 역할을 맡을 같은 팀의 `ACCEPTED` 참가자 ID. 사용자 ID와 구분 |

역할 카드 1을 참가자 21에게 처음 배정하는 경우

```json
{
  "participantId": 21
}
```

같은 경로로 역할 카드 1의 담당자를 참가자 24로 변경하는 경우

```json
{
  "participantId": 24
}
```

---

### 정상 응답 데이터

Status Code : `204 No Content`

역할을 새로 배정하거나 담당자를 변경하거나 동일한 배정을 다시 요청한 경우

응답 Body 없음

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

경로를 정수로 변환할 수 없거나 요청 본문·`participantId`가 누락되거나 올바른 정수 형식이 아닌 경우는 공통 요청값 검증 실패에 해당한다.

#### 방장 전용 요청

Status Code : `403 Forbidden`

현재 사용자가 해당 팀의 수락된 방장이 아닌 경우

```json
{
  "code": "COOPERATIVE_MISSION_HOST_ONLY",
  "message": "협동 미션 방장만 참여 요청을 처리할 수 있습니다."
}
```

#### 협동 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도 ID에 해당하는 팀 진행도가 없는 경우. 완료된 팀은 아래 단계 오류로 구분한다.

```json
{
  "code": "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND",
  "message": "진행 중인 협동 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

배정 대상 팀의 협동 미션이 `INACTIVE`인 경우

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

#### 협동 미션 참가자 없음

Status Code : `404 Not Found`

요청한 참가자가 없거나 다른 팀 소속이거나 아직 `PENDING` 상태인 경우

```json
{
  "code": "COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND",
  "message": "협동 미션 참여 요청을 찾을 수 없습니다."
}
```

#### 역할 카드 없음

Status Code : `404 Not Found`

요청한 역할 카드 ID에 해당하는 카드가 없는 경우

```json
{
  "code": "COOPERATIVE_ROLE_CARD_NOT_FOUND",
  "message": "역할 카드를 찾을 수 없습니다."
}
```

#### 현재 단계에서 허용되지 않는 요청

Status Code : `409 Conflict`

팀이 이미 완료되었거나 현재 단계가 초대·역할 배정 단계인 `1`이 아닌 경우. 동일 배정 재요청도 같은 단계 제한을 적용한다.

```json
{
  "code": "COOPERATIVE_MISSION_STEP_NOT_ALLOWED",
  "message": "현재 단계에서 허용되지 않는 요청입니다."
}
```

# 협동 미션 역할 진행도 저장 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 협동 미션 역할 진행도 저장 |
| HTTP 메서드 | `POST` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-progresses/{roleCardId}/verification` |

### API 설명

수락된 참가자가 자신에게 배정된 역할의 인증 사진을 제출할 때 호출한다. 미션 수행 단계인 `2`에서만 사용할 수 있다.

경로의 팀 진행도 ID와 역할 카드 ID로 인증 대상을 지정한다. 참가자 ID·사용자 ID·인증 성공 여부는 요청하지 않는다. 방장도 본인에게 배정된 역할만 인증할 수 있다.

사진은 `multipart/form-data`의 `itemImage`로 전송한다. JPEG·PNG·WebP 형식만 허용하며 최대 크기는 10MB(10,000,000바이트)이다. 손상되어 정상적으로 읽을 수 없는 파일은 허용하지 않는다. HEIC/HEIF는 프론트에서 JPEG로 변환한 뒤 전송한다.

인증에 성공하면 사진을 저장하고 해당 역할을 완료 처리한 뒤 `isVerified: true`를 반환한다. 판정 결과 인증에 실패하면 사진과 역할 진행도를 변경하지 않고 `isVerified: false`를 반환한다. 판정 실패는 요청 오류가 아니므로 정상 응답으로 구분한다.

이미 완료된 역할은 다시 인증하거나 기존 사진을 덮어쓸 수 없다. 한 참가자가 여러 역할을 맡았다면 카드별로 각각 요청한다.

마지막 역할 인증이 완료되어도 팀 단계·팀 완료 상태를 자동 변경하거나 보상을 지급하지 않는다. 방장이 별도의 진행도 저장 API로 `2 → 3` 완료 요청을 보내야 한다.

프론트는 응답으로 인증 성공 여부를 확인하고, 사진 URL과 갱신된 역할 상태는 협동 미션 상태 조회 API의 다음 폴링 응답에서 확인한다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |
| `Content-Type` | 필수 | `multipart/form-data; boundary=...` |

---

### 요청 Query

없음

---

### 요청 Path

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `cooperativeMissionProgressId` | integer | 필수 | 역할을 수행 중인 팀의 협동 미션 진행도 ID |
| `roleCardId` | integer | 필수 | 해당 팀에서 본인에게 배정된 역할 카드 ID. 단일 역할 진행도 ID가 아님 |

요청 예시:

```http
POST /api/v2/cooperative-missions/10/role-progresses/1/verification
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data; boundary=...
```

---

### 요청 Body

Content-Type: `multipart/form-data`

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `itemImage` | file | 필수 | 역할 인증 사진 한 개. JPEG(`.jpg`, `.jpeg`), PNG(`.png`), WebP(`.webp`). 비어 있지 않고 최대 10MB이며 정상적으로 읽을 수 있는 이미지 |

```text
itemImage: material.jpg
```

GIF·SVG·BMP·TIFF·HEIC·HEIF 등 다른 형식은 허용하지 않는다. 파일명이나 전송한 Content-Type만 변경하는 것으로 허용되지 않은 파일을 전송할 수는 없다.

---

### 정상 응답 데이터

Status Code : `200 OK`

사진 인증 결과가 정상적으로 반환된 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `isVerified` | boolean | 사진 인증 성공 여부 |

인증에 성공한 경우

```json
{
  "isVerified": true
}
```

판정 결과 인증에 실패한 경우

```json
{
  "isVerified": false
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

이미지 형식·용량·손상 오류는 공통 `400 INVALID_REQUEST` 대신 아래 개별 오류를 반환한다. `itemImage` 누락·빈 파일·잘못된 multipart 요청과 정수로 변환할 수 없는 경로는 공통 요청값 검증 실패를 따른다.

#### 지원하지 않는 이미지 형식

Status Code : `400 Bad Request`

파일의 실제 형식이 JPEG·PNG·WebP가 아니거나 이미지 형식을 판별할 수 없는 경우

```json
{
  "code": "INVALID_IMAGE_FORMAT",
  "message": "지원하지 않는 이미지 형식입니다."
}
```

#### 이미지 파일 크기 초과

Status Code : `400 Bad Request`

파일 크기가 10MB(10,000,000바이트)를 초과한 경우

```json
{
  "code": "IMAGE_SIZE_EXCEEDED",
  "message": "이미지 파일은 10MB를 초과할 수 없습니다."
}
```

#### 손상된 이미지 파일

Status Code : `400 Bad Request`

허용된 이미지 형식으로 판별되었으나 손상되었거나 정상적으로 읽을 수 없는 경우

```json
{
  "code": "INVALID_IMAGE",
  "message": "손상되었거나 올바르지 않은 이미지 파일입니다."
}
```

#### 역할 진행도 접근 권한 없음

Status Code : `403 Forbidden`

현재 사용자가 해당 역할의 담당자가 아니거나 담당 참가자가 `ACCEPTED` 상태가 아닌 경우

```json
{
  "code": "COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED",
  "message": "해당 역할을 인증할 권한이 없습니다."
}
```

#### 협동 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도 ID에 해당하는 팀 진행도가 없는 경우

```json
{
  "code": "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND",
  "message": "진행 중인 협동 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

대상 팀의 협동 미션이 `INACTIVE`인 경우

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

#### 역할 진행도 없음

Status Code : `404 Not Found`

요청한 팀과 역할 카드 조합에 해당하는 역할 배정·수행 기록이 없는 경우. 카드가 없거나 해당 팀에 배정되지 않은 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_ROLE_PROGRESS_NOT_FOUND",
  "message": "협동 미션 역할 진행도를 찾을 수 없습니다."
}
```

#### 현재 단계에서 허용되지 않는 요청

Status Code : `409 Conflict`

팀이 이미 완료되었거나 현재 단계가 미션 수행 단계인 `2`가 아닌 경우

```json
{
  "code": "COOPERATIVE_MISSION_STEP_NOT_ALLOWED",
  "message": "현재 단계에서 허용되지 않는 요청입니다."
}
```

#### 이미 완료된 역할 진행도

Status Code : `409 Conflict`

대상 역할이 이미 인증 완료된 경우. 같은 사진을 다시 제출한 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED",
  "message": "이미 완료된 협동 미션 역할입니다."
}
```

---

# 협동 미션 중단 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 협동 미션 중단 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress/stop` |

### API 설명

사용자가 협동 미션의 첫 단계인 `1`에서 본인의 참여를 중단할 때 호출한다. 팀 진행도 ID로 대상을 지정하며 다른 참가자를 내보내는 API가 아니다.

방장·팀원 모두 호출할 수 있으며 `PENDING` 참가자는 본인의 참여 요청을 취소할 수 있다. 미션이 비활성화되었거나 팀이 이미 완료된 경우, 현재 단계가 `2` 또는 `3`인 경우에는 중단할 수 없다.

팀원이 중단하면 해당 참가자의 참여와 역할 배정이 해제된다. 방장이 중단하면 남아 있는 수락된 참가자 중 가장 먼저 합류한 사람에게 방장 권한이 승계된다. 수락된 참가자가 남아 있지 않으면 대기 중인 참여 요청을 포함하여 팀이 해산된다. 마지막 참가자가 중단하는 경우도 팀이 해산된다.

성공 시 응답 본문 없이 반환하며 보상을 지급하거나 완료 화면 데이터를 반환하지 않는다. 중단한 사용자는 해당 팀의 폴링을 종료한다. 남은 참가자는 기존 상태 조회 API로 변경된 방장·참가자·역할 배정을 확인한다.

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
| `cooperativeMissionProgressId` | integer | 필수 | 본인이 참가 중이며 중단하려는 협동 미션 팀 진행도 ID |

요청 예시:

```http
PATCH /api/v2/cooperative-missions/10/progress/stop
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `204 No Content`

본인의 참여 중단과 필요한 방장 승계 또는 팀 해산이 정상 처리된 경우

응답 본문 없음

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

정수로 변환할 수 없는 경로는 공통 요청값 검증 실패를 따른다.

#### 협동 미션 중단 권한 없음

Status Code : `403 Forbidden`

현재 사용자가 해당 팀의 참가자가 아닌 경우. 이미 중단한 사용자가 남아 있는 팀에 다시 중단을 요청하는 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_MISSION_LEAVE_ACCESS_DENIED",
  "message": "해당 협동 미션의 참가자가 아닙니다."
}
```

#### 협동 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도 ID에 해당하는 팀 진행도가 없는 경우. 마지막 참가자의 중단 또는 팀 해산으로 팀이 사라진 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_MISSION_PROGRESS_NOT_FOUND",
  "message": "진행 중인 협동 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

대상 팀의 협동 미션이 `INACTIVE`인 경우. 참여 도중 비활성화된 경우에도 중단할 수 없다.

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

#### 현재 단계에서 허용되지 않는 요청

Status Code : `409 Conflict`

팀이 이미 완료되었거나 현재 단계가 첫 단계인 `1`이 아닌 경우

```json
{
  "code": "COOPERATIVE_MISSION_STEP_NOT_ALLOWED",
  "message": "현재 단계에서 허용되지 않는 요청입니다."
}
```
