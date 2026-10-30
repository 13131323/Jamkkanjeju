# 마이페이지 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 마이페이지 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `MYPAGE` |
| 엔드포인트 | `/api/v2/users/me/mypage` |

### API 설명

마이페이지 진입 시 사용자 프로필, 목표 걸음 수, 방문 장소 수, 완료 미션 수, 보유 포인트, 진행 중인 미션과 AR 캐릭터 도감을 함께 조회한다.

프로필은 온보딩 결과의 이미지인 `profile.characterImgUrl`을 반환한다. `profile.selectedArCharacter`는 반환하지 않는다.

AR 캐릭터 도감은 기존 범위인 ID 1~6의 캐릭터를 획득 여부와 관계없이 반환한다. 이미지 URL·이야기·해시태그·획득 조건을 함께 제공하므로 캐릭터 카드를 열기 위한 별도 상세 조회는 필요하지 않다.

캐릭터별 필요 조각 수와 현재 획득한 조각 수를 반환한다. 현재 조각 수가 필요 조각 수 이상이면 `isAcquired=true`이며, 초과한 조각도 실제 획득한 개수 그대로 반환한다. `acquiredAt`은 필요 조각 수를 처음 채운 날짜이고 미완성이면 null이다. 획득 장소인 `acquiredLocation`은 반환하지 않는다.

기존 `acquiredMissions`를 `availableMissions`로 변경한다. 해당 캐릭터를 보상으로 주는 활성 미션 중 현재 사용자가 완료했거나 이미 그 캐릭터 조각을 받은 미션을 제외하고, 남은 후보를 공통 미션 ID 오름차순으로 최대 3개 반환한다. 후보가 2개면 2개, 1개면 1개, 없으면 빈 배열이다. 캐릭터를 완성했다면 후보가 남아 있어도 빈 배열을 반환한다.

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

없음

---

### 요청 Body

없음

요청 예시:

```http
GET /api/v2/users/me/mypage
Authorization: Bearer {accessToken}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

마이페이지 정보를 정상적으로 조회한 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `profile` | object | 사용자 프로필 |
| `profile.nickname` | string \| null | 닉네임. 설정하지 않았으면 null |
| `profile.travelStyle` | object \| null | 온보딩 결과의 여행 유형. 결과가 없으면 null |
| `profile.travelStyle.userType` | string | 여행 유형명 |
| `profile.travelStyle.hashtags` | string[] | 여행 유형 해시태그 |
| `profile.characterImgUrl` | string \| null | 온보딩 프로필 이미지 URL. 온보딩 결과가 없으면 null |
| `dailyStep` | object | 목표 걸음 수 정보 |
| `dailyStep.targetStepCount` | integer | 설정한 하루 목표 걸음 수 |
| `summary` | object | 사용자 활동 요약 |
| `summary.visitedLocationCount` | integer | 중복을 제외한 방문 장소 수 |
| `summary.completedMissionCount` | integer | 완료한 미션 진행도 수. 협동은 현재 사용자가 ACCEPTED로 참가한 완료 팀 진행도만 포함 |
| `summary.point` | integer | 현재 보유 포인트 |
| `progressMissions` | object[] | 진행 중인 미션. 없으면 빈 배열 |
| `progressMissions[].missionId` | integer | 공통 미션 ID. 미션 진행도 ID와 구분 |
| `progressMissions[].missionType` | string | 미션 유형. `CULTURE \| TREASURE \| COOPERATIVE` |
| `progressMissions[].missionTitle` | string | 미션 제목 |
| `progressMissions[].currentCount` | integer | 현재 진행 수. 문화는 현재 퀴즈 번호, 보물찾기는 찾은 보물 수, 협동은 현재 팀 단계 |
| `progressMissions[].totalCount` | integer | 전체 진행 수. 문화는 실제 문제 수, 보물찾기는 전체 보물 수, 협동은 전체 단계 수 |
| `arCharacters` | object[] | ID 1~6의 캐릭터 도감. ID 오름차순. 대상 캐릭터가 없으면 빈 배열 |
| `arCharacters[].id` | integer | AR 캐릭터 ID |
| `arCharacters[].name` | string | 캐릭터 이름. 미완성도 반환 |
| `arCharacters[].imageUrl` | string | 캐릭터 이미지 URL. 미완성도 실제 URL 반환 |
| `arCharacters[].characterColor` | string \| null | 대표 색상 |
| `arCharacters[].requiredFragmentCount` | integer | 캐릭터 완성에 필요한 조각 수. 현재 초기 캐릭터는 모두 10 |
| `arCharacters[].acquiredFragmentCount` | integer | 현재 사용자가 획득한 조각 수. 없으면 0. 필요 조각 수를 초과해도 실제 개수를 반환 |
| `arCharacters[].isAcquired` | boolean | 현재 조각 수가 필요 조각 수 이상이면 true |
| `arCharacters[].acquiredAt` | string \| null | 필요 조각 수를 처음 채운 날짜. KST 기준 `yyyy-MM-dd`. 미완성이면 null |
| `arCharacters[].storyTitle` | string | 캐릭터 이야기 제목 |
| `arCharacters[].storyContent` | string | 캐릭터 이야기 내용 |
| `arCharacters[].hashtags` | string[] | 캐릭터 해시태그 |
| `arCharacters[].acquireCondition` | string | 캐릭터 획득 조건 설명 |
| `arCharacters[].availableMissions` | object[] | 아직 완료하지 않았고 해당 캐릭터 조각도 받지 않은 활성 보상 미션. 공통 미션 ID 오름차순, 최대 3개. 캐릭터 완성 또는 후보 없음이면 빈 배열 |
| `arCharacters[].availableMissions[].missionId` | integer | 공통 미션 ID. 기존 유형별 세부 ID를 사용하지 않음 |
| `arCharacters[].availableMissions[].missionType` | string | 미션 유형. `CULTURE \| TREASURE \| COOPERATIVE` |
| `arCharacters[].availableMissions[].missionTitle` | string | 미션 제목 |

- `profile`·`dailyStep`·`summary`와 목록 필드는 항상 포함한다. 목록은 null 대신 빈 배열을 반환하며 nullable 항목은 키를 생략하지 않는다.
- 캐릭터 미완성 표시 방식은 `isAcquired`를 기준으로 클라이언트가 결정한다.
- 필요 조각 수는 연결 가능한 미션의 최대 개수가 아니다. 예를 들어 필요 10개·현재 6개이고 유효 후보가 4개면 3개를, 유효 후보가 2개면 2개를 반환한다. 필요 10개·현재 12개이면 12개와 `isAcquired=true`, 빈 `availableMissions`를 반환한다.
- 배열과 캐릭터 상세 정보는 이 응답에서 함께 제공한다. 좌표 입력이나 거리순 추천은 사용하지 않는다.

아래 값과 날짜는 응답 형식 설명을 위한 예시다.

```json
{
  "profile": {
    "nickname": "테스트 사용자",
    "travelStyle": {
      "userType": "제주 사진작가",
      "hashtags": [
        "#사진",
        "#제주"
      ]
    },
    "characterImgUrl": "https://example.com/profiles/photo.png"
  },
  "dailyStep": {
    "targetStepCount": 10000
  },
  "summary": {
    "visitedLocationCount": 1,
    "completedMissionCount": 10,
    "point": 0
  },
  "progressMissions": [
    {
      "missionId": 31,
      "missionType": "COOPERATIVE",
      "missionTitle": "협동 미션",
      "currentCount": 1,
      "totalCount": 3
    }
  ],
  "arCharacters": [
    {
      "id": 1,
      "name": "바람 정령",
      "imageUrl": "https://example.com/characters/1.png",
      "characterColor": "yellow",
      "requiredFragmentCount": 10,
      "acquiredFragmentCount": 0,
      "isAcquired": false,
      "acquiredAt": null,
      "storyTitle": "바람 정령의 제주 이야기",
      "storyContent": "제주를 여행하며 만날 수 있는 친구입니다.",
      "hashtags": [
        "#제주",
        "#여행"
      ],
      "acquireCondition": "미션에서 캐릭터 조각 10개를 모아보세요.",
      "availableMissions": []
    },
    {
      "id": 2,
      "name": "누비",
      "imageUrl": "https://example.com/characters/2.png",
      "characterColor": "green",
      "requiredFragmentCount": 10,
      "acquiredFragmentCount": 0,
      "isAcquired": false,
      "acquiredAt": null,
      "storyTitle": "누비의 제주 이야기",
      "storyContent": "제주를 여행하며 만날 수 있는 친구입니다.",
      "hashtags": [
        "#제주",
        "#여행"
      ],
      "acquireCondition": "미션에서 캐릭터 조각 10개를 모아보세요.",
      "availableMissions": []
    },
    {
      "id": 3,
      "name": "점박이 물범",
      "imageUrl": "https://example.com/characters/3.png",
      "characterColor": "blue",
      "requiredFragmentCount": 10,
      "acquiredFragmentCount": 0,
      "isAcquired": false,
      "acquiredAt": null,
      "storyTitle": "점박이 물범의 제주 이야기",
      "storyContent": "제주를 여행하며 만날 수 있는 친구입니다.",
      "hashtags": [
        "#제주",
        "#여행"
      ],
      "acquireCondition": "미션에서 캐릭터 조각 10개를 모아보세요.",
      "availableMissions": []
    },
    {
      "id": 4,
      "name": "보물이",
      "imageUrl": "https://example.com/characters/4.png",
      "characterColor": "grey",
      "requiredFragmentCount": 10,
      "acquiredFragmentCount": 10,
      "isAcquired": true,
      "acquiredAt": "2026-10-30",
      "storyTitle": "보물이의 제주 이야기",
      "storyContent": "제주를 여행하며 만날 수 있는 친구입니다.",
      "hashtags": [
        "#제주",
        "#여행"
      ],
      "acquireCondition": "미션에서 캐릭터 조각 10개를 모아보세요.",
      "availableMissions": []
    },
    {
      "id": 5,
      "name": "감귤이",
      "imageUrl": "https://example.com/characters/5.png",
      "characterColor": "orange",
      "requiredFragmentCount": 10,
      "acquiredFragmentCount": 0,
      "isAcquired": false,
      "acquiredAt": null,
      "storyTitle": "감귤이의 제주 이야기",
      "storyContent": "제주를 여행하며 만날 수 있는 친구입니다.",
      "hashtags": [
        "#제주",
        "#여행"
      ],
      "acquireCondition": "미션에서 캐릭터 조각 10개를 모아보세요.",
      "availableMissions": [
        {
          "missionId": 31,
          "missionType": "COOPERATIVE",
          "missionTitle": "협동 미션"
        }
      ]
    },
    {
      "id": 6,
      "name": "돌담이",
      "imageUrl": "https://example.com/characters/6.png",
      "characterColor": "grey",
      "requiredFragmentCount": 10,
      "acquiredFragmentCount": 0,
      "isAcquired": false,
      "acquiredAt": null,
      "storyTitle": "돌담이의 제주 이야기",
      "storyContent": "제주를 여행하며 만날 수 있는 친구입니다.",
      "hashtags": [
        "#제주",
        "#여행"
      ],
      "acquireCondition": "미션에서 캐릭터 조각 10개를 모아보세요.",
      "availableMissions": [
        {
          "missionId": 32,
          "missionType": "TREASURE",
          "missionTitle": "보물찾기"
        }
      ]
    }
  ]
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다. 이 API 전용 도메인 오류는 정의하지 않는다.


---

# 사용자 정보 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 사용자 정보 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `MYPAGE` |
| 엔드포인트 | `/api/v2/users/me` |

### API 설명

프로필 수정 화면에서 현재 사용자의 여행 유형·온보딩 프로필 이미지·닉네임·여행 선택값·하루 목표 걸음 수를 조회한다. 사용자 정보를 변경하지 않는다.

여행 기대 항목은 `expectations` 배열이며 선택 내역이 없으면 빈 배열을 반환한다. 주 이동 수단과 자투리 시간 여행 방식은 각각 단일 문자열이며 선택 내역이 없으면 null이다. 프로필 이미지는 마이페이지 조회와 동일한 `characterImgUrl`을 사용한다.

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

없음

---

### 요청 Body

없음

요청 예시:

```http
GET /api/v2/users/me
Authorization: Bearer {accessToken}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

현재 사용자 정보를 정상적으로 조회한 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `userType` | string \| null | 배정된 온보딩 여행 유형명. 결과가 없으면 null |
| `characterImgUrl` | string \| null | 온보딩 프로필 이미지 URL. 결과가 없으면 null |
| `nickname` | string \| null | 닉네임. 설정하지 않았으면 null |
| `expectations` | string[] | 선택한 여행 기대 항목. `PHOTO \| LOCAL \| NATURE \| CULTURE \| CAFE \| WALKING`. 선택 내역이 없으면 빈 배열 |
| `transportation` | string \| null | 선택한 주 이동 수단 한 개. `WALK \| BUS \| CAR \| BICYCLE`. 선택 내역이 없으면 null |
| `travelStyle` | string \| null | 선택한 자투리 시간 여행 방식 한 개. `RIGHT_HERE \| NEAR_AROUND \| NEAR_DESTINATION`. 선택 내역이 없으면 null |
| `targetStepCount` | integer | 현재 설정된 하루 목표 걸음 수 |

- nullable 필드도 키를 생략하지 않는다. `expectations`는 항상 배열이며 null로 반환하지 않는다.
- 온보딩 결과가 없어도 저장된 닉네임·선택값·목표 걸음 수를 반환한다.
- 여행 선택값은 기존 Spring 온보딩 API와 동일한 영문 코드를 사용한다.

```json
{
  "userType": "제주 사진작가",
  "characterImgUrl": "https://example.com/profiles/photo.png",
  "nickname": "여행자",
  "expectations": ["PHOTO", "CAFE"],
  "transportation": "WALK",
  "travelStyle": "RIGHT_HERE",
  "targetStepCount": 10000
}
```

온보딩 결과·여행 선택값·닉네임이 없는 경우:

```json
{
  "userType": null,
  "characterImgUrl": null,
  "nickname": null,
  "expectations": [],
  "transportation": null,
  "travelStyle": null,
  "targetStepCount": 10000
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다. 이 API 전용 도메인 오류는 정의하지 않는다.

---

# 사용자 정보 변경 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 사용자 정보 변경 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `MYPAGE` |
| 엔드포인트 | `/api/v2/users/me/profile` |

### API 설명

프로필 수정 화면에서 변경한 필드만 전달하여 현재 사용자 정보를 수정한다. 생략한 필드는 기존 값을 유지한다. 온보딩 완료 API인 `PATCH /api/v2/users/me`와 별개의 API다.

여행 기대 항목·주 이동 수단·자투리 시간 여행 방식의 실제 선택값이 바뀌면 여행 유형과 온보딩 프로필 이미지도 다시 배정한다. 닉네임이나 목표 걸음 수만 변경한 경우에는 기존 배정을 유지한다. 변경 후 사용자 정보는 `GET /api/v2/users/me`, 마이페이지 정보는 `GET /api/v2/users/me/mypage`에서 확인한다.

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
| `nickname` | string | 선택 | 앞뒤 공백 제거 후 1~20자. 중복 닉네임 허용. null·빈 문자열·공백만 있는 문자열은 허용하지 않는다 |
| `expectations` | string[] | 선택 | 여행 기대 항목의 최종 선택 목록. 중복 불가. `PHOTO \| LOCAL \| NATURE \| CULTURE \| CAFE \| WALKING`. 빈 배열은 선택 전체 해제, null은 허용하지 않는다 |
| `transportation` | string \| null | 선택 | 주 이동 수단 한 개. `WALK \| BUS \| CAR \| BICYCLE`. null은 현재 선택 해제 |
| `travelStyle` | string \| null | 선택 | 자투리 시간 여행 방식 한 개. `RIGHT_HERE \| NEAR_AROUND \| NEAR_DESTINATION`. null은 현재 선택 해제 |
| `targetStepCount` | integer | 선택 | 하루 목표 걸음 수. 1~100000의 정수. null은 허용하지 않는다 |

- 모든 필드는 생략할 수 있다. 생략과 명시적인 null은 서로 다른 의미다.
- `expectations`를 전달하면 해당 목록 전체를 교체한다. 기존 목록에 추가하는 요청이 아니다.
- 이동 수단과 여행 방식은 사용자 정보 조회와 동일하게 단일 문자열로 전달하며 배열을 받지 않는다.
- 빈 객체 `{}`는 기존 정보를 변경하지 않고 정상 처리한다. Body 자체의 생략이나 null은 허용하지 않는다.
- 정의하지 않은 필드, 허용하지 않는 코드·타입, 중복 기대 항목, 닉네임·목표 걸음 수 제약 위반은 공통 요청 검증 오류로 처리한다.
- `userType`, `characterImgUrl`은 서버가 배정하는 값이므로 수정 필드로 받지 않는다.

닉네임만 변경하는 경우:

```json
{
  "nickname": "몽글몽글파도"
}
```

여행 선택값과 목표 걸음 수를 변경하는 경우:

```json
{
  "expectations": ["PHOTO", "CAFE"],
  "transportation": "WALK",
  "travelStyle": "NEAR_AROUND",
  "targetStepCount": 12000
}
```

여행 선택값을 모두 해제하는 경우:

```json
{
  "expectations": [],
  "transportation": null,
  "travelStyle": null
}
```

---

### 정상 응답 데이터

Status Code : `204 No Content`

요청에 포함된 변경 사항이 정상 반영된 경우. 응답 Body 없음.

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다. 이 API 전용 도메인 오류는 정의하지 않는다.

---

# 여행 마무리 엽서 요소 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 여행 마무리 엽서 요소 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `MYPAGE` |
| 엔드포인트 | `/api/v2/users/me/travel-ending-elements` |

### API 설명

여행 마무리 엽서 화면에서 선택할 수 있는 현재 사용자의 방문 장소와 완료 미션, 보유 포인트를 조회한다. 사진 목록·사진 개수는 반환하지 않는다. 페이징 없이 전체 목록을 반환하며 조회로 사용자 상태나 포인트를 변경하지 않는다.

완료 미션은 현재 활성 상태인 문화·보물찾기·협동 미션만 포함한다. 중단으로 완료 처리된 미션도 완료 목록에 포함한다. 같은 미션을 여러 번 완료했으면 가장 최근 완료 기록 한 건만 반환한다. 협동 미션은 참여를 수락한 사용자의 완료 기록만 포함한다.

방문 장소는 최근 방문순, 같은 시각이면 장소 ID 내림차순이다. 완료 미션은 최근 완료순, 같은 시각이면 미션 유형 문자열·미션 ID 오름차순이다. 문화 미션의 완료 장소는 null이며, 연결 장소가 없는 보물찾기·협동 미션은 반환하지 않는다.

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

없음

---

### 요청 Body

없음

```http
GET /api/v2/users/me/travel-ending-elements
Authorization: Bearer {accessToken}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

현재 사용자의 엽서 요소를 정상적으로 조회한 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `point` | integer | 현재 사용자의 보유 포인트 |
| `visitedLocationCount` | integer | 중복을 제외한 방문 장소 수. `visitedLocations` 배열 길이와 동일 |
| `visitedLocations` | object[] | 방문 장소 목록. 없으면 빈 배열 |
| `visitedLocations[].id` | integer | 장소 ID |
| `visitedLocations[].locationTitle` | string | 장소명 |
| `completedMissionCount` | integer | 필터링·중복 제거 후 완료 미션 수. `completedMissions` 배열 길이와 동일 |
| `completedMissions` | object[] | 활성 상태인 완료 미션 목록. 없으면 빈 배열 |
| `completedMissions[].missionId` | integer | 공통 `MISSION.id`. 현재 Spring에서는 유형별 세부 미션과 같은 ID |
| `completedMissions[].missionType` | string | `CULTURE \| TREASURE \| COOPERATIVE` |
| `completedMissions[].missionTitle` | string | 미션 제목 |
| `completedMissions[].completedLocation` | string \| null | 완료 장소명. 문화 미션은 null |
| `completedMissions[].completedAt` | string | 가장 최근 완료 시각. KST 기준 offset 없는 ISO 8601 형식 |
| `completedMissions[].rewardDetail` | object | 미션에 설정된 전체 보상과 종류별 수령 여부. 보상이 없어도 객체 유지 |
| `completedMissions[].rewardDetail.arCharacter` | object \| null | AR 캐릭터 보상. 없으면 null |
| `completedMissions[].rewardDetail.arCharacter.id` | integer | AR 캐릭터 ID |
| `completedMissions[].rewardDetail.arCharacter.name` | string | AR 캐릭터 이름 |
| `completedMissions[].rewardDetail.arCharacter.imageUrl` | string | AR 캐릭터 이미지 URL |
| `completedMissions[].rewardDetail.arCharacter.isReceived` | boolean | 해당 미션의 캐릭터 보상 수령 여부 |
| `completedMissions[].rewardDetail.point` | object \| null | 포인트 보상. 없으면 null |
| `completedMissions[].rewardDetail.point.amount` | integer | 설정된 포인트 보상량 |
| `completedMissions[].rewardDetail.point.isReceived` | boolean | 해당 미션의 포인트 보상 수령 여부 |
| `completedMissions[].rewardDetail.coupon` | object \| null | 쿠폰 보상. 없으면 null |
| `completedMissions[].rewardDetail.coupon.couponLocation` | string \| null | 쿠폰 사용 장소명. 연결된 사용처가 없으면 null |
| `completedMissions[].rewardDetail.coupon.couponPrice` | integer | 쿠폰 금액 |
| `completedMissions[].rewardDetail.coupon.isReceived` | boolean | 해당 미션의 쿠폰 보상 수령 여부. 쿠폰 사용 여부와 별개 |

- 보상을 이미 받았어도 설정된 보상 정보는 유지하며 `isReceived`로 구분한다.
- 방문 장소·완료 미션이 없으면 각 개수는 0, 목록은 빈 배열이다. nullable 필드도 키를 생략하지 않는다.

```json
{
  "point": 2000,
  "visitedLocationCount": 1,
  "visitedLocations": [
    { "id": 1, "locationTitle": "라토커피제주" }
  ],
  "completedMissionCount": 2,
  "completedMissions": [
    {
      "missionId": 1,
      "missionType": "CULTURE",
      "missionTitle": "문화 미션",
      "completedLocation": null,
      "completedAt": "2026-10-30T14:20:00",
      "rewardDetail": {
        "arCharacter": { "id": 4, "name": "보물이", "imageUrl": "https://example.com/characters/4.png", "isReceived": true },
        "point": { "amount": 100, "isReceived": false },
        "coupon": null
      }
    },
    {
      "missionId": 32,
      "missionType": "TREASURE",
      "missionTitle": "보물찾기",
      "completedLocation": "라토커피제주",
      "completedAt": "2026-10-29T11:30:00",
      "rewardDetail": {
        "arCharacter": { "id": 6, "name": "돌담이", "imageUrl": "https://example.com/characters/6.png", "isReceived": true },
        "point": { "amount": 100, "isReceived": true },
        "coupon": { "couponLocation": "라토커피제주", "couponPrice": 1000, "isReceived": false }
      }
    }
  ]
}
```

조회할 방문 장소와 완료 미션이 없는 경우:

```json
{
  "point": 0,
  "visitedLocationCount": 0,
  "visitedLocations": [],
  "completedMissionCount": 0,
  "completedMissions": []
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다. 이 API 전용 도메인 오류는 정의하지 않는다.
