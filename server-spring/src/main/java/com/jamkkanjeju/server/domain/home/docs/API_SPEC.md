# 홈 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 홈 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `HOME` |
| 엔드포인트 | `/api/v2/users/me/home` |

### API 설명

사용자가 메인 홈 화면에 진입하거나 홈을 새로고침할 때 호출한다. 사용자가 위치를 직접 선택한 경우 해당 행정구역의 대표 위도와 경도를 전달한다.

인증된 사용자의 추천 미션, 진행 중인 미션, 서비스에 쌓인 방명록 개수와 사용자 캐릭터 이미지 URL을 한 번에 조회한다.

요청 위치를 기준으로 미션 장소까지의 거리는 미터 단위, 예상 소요 시간은 분 단위로 반환한다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |

---

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `latitude` | number | 필수 | 현재 위치 또는 사용자가 선택한 위치의 위도 |
| `longitude` | number | 필수 | 현재 위치 또는 사용자가 선택한 위치의 경도 |

요청 예시:

```http
GET /api/v2/users/me/home?latitude=33.5572&longitude=126.7591
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

홈 정보가 정상적으로 조회된 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `missionRecommend` | object[] | 홈에 노출할 추천 미션 목록. 최대 3건이며 추천 대상이 없으면 빈 배열 |
| `missionRecommend[].missionId` | integer | 추천 미션의 공통 미션 ID |
| `missionRecommend[].missionType` | string | 미션 유형. `CULTURE \| TREASURE \| COOPERATIVE` |
| `missionRecommend[].missionTitle` | string | 미션 이름 |
| `missionRecommend[].locationTitle` | string, null | 미션 장소명. 장소가 없으면 `null` |
| `missionRecommend[].location` | object, null | 미션 장소 좌표. 장소가 없으면 `null` |
| `missionRecommend[].location.lat` | number | 미션 장소의 위도 |
| `missionRecommend[].location.lng` | number | 미션 장소의 경도 |
| `missionRecommend[].distanceMeter` | number, null | 요청 위치에서 미션 장소까지의 거리(m). 장소가 없으면 `null` |
| `missionRecommend[].durationMinutes` | number, null | 요청 위치에서 미션 장소까지의 예상 소요 시간(분). 장소가 없으면 `null` |
| `progressMission` | object[] | 사용자가 진행 중인 미션 목록. 진행 중인 미션이 없으면 빈 배열 |
| `progressMission[].missionId` | integer | 진행 중인 미션의 공통 미션 ID. 진행 기록 ID와 구분 |
| `progressMission[].missionType` | string | 미션 유형. `CULTURE \| TREASURE \| COOPERATIVE` |
| `progressMission[].missionTitle` | string | 진행 중인 미션 이름 |
| `progressMission[].locationTitle` | string, null | 미션 장소명. 장소가 없으면 `null` |
| `progressMission[].distanceMeter` | number, null | 요청 위치에서 미션 장소까지의 거리(m). 장소가 없으면 `null` |
| `progressMission[].durationMinutes` | number, null | 요청 위치에서 미션 장소까지의 예상 소요 시간(분). 장소가 없으면 `null` |
| `progressMission[].totalStep` | integer | 미션의 전체 단계 수 |
| `progressMission[].currentStep` | integer | 사용자가 현재 진행 중인 단계 |
| `guestbookCount` | integer | 서비스에 쌓인 방명록 개수. 현재 사용자가 작성한 개수가 아니며, 삭제된 방명록은 제외 |
| `characterImgUrl` | string, null | 온보딩 결과로 제공된 프로필 이미지 URL. 온보딩 결과가 없으면 `null` |

아래 JSON의 장소와 거리·시간은 응답 형식을 설명하기 위한 예시다.

```json
{
  "missionRecommend": [
    {
      "missionId": 12,
      "missionType": "TREASURE",
      "missionTitle": "보물 찾기",
      "locationTitle": "새별 오름",
      "location": {
        "lat": 33.3663,
        "lng": 126.3577
      },
      "distanceMeter": 300,
      "durationMinutes": 4
    },
    {
      "missionId": 16,
      "missionType": "COOPERATIVE",
      "missionTitle": "함께 키우는 귤나무",
      "locationTitle": "종화네 과수원",
      "location": {
        "lat": 33.4507,
        "lng": 126.5707
      },
      "distanceMeter": 600,
      "durationMinutes": 8
    },
    {
      "missionId": 36,
      "missionType": "CULTURE",
      "missionTitle": "오늘의 제주 퀴즈",
      "locationTitle": null,
      "location": null,
      "distanceMeter": null,
      "durationMinutes": null
    }
  ],
  "progressMission": [
    {
      "missionId": 52,
      "missionType": "TREASURE",
      "missionTitle": "보물 찾기",
      "locationTitle": "오구포구",
      "distanceMeter": 900,
      "durationMinutes": 12,
      "totalStep": 3,
      "currentStep": 1
    }
  ],
  "guestbookCount": 2,
  "characterImgUrl": "https://jamkkanjejustorage.blob.core.windows.net/jamkkanjeju/character_image/001.png"
}
```

---

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

필수 Query가 누락되었거나 숫자로 변환할 수 없는 값을 전달한 경우, 위도·경도가 허용 범위(위도 -90~90, 경도 -180~180)를 벗어난 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 인증 정보 없음

Status Code : `401 Unauthorized`

`Authorization` 헤더 없이 호출한 경우 또는 인증 정보에 해당하는 사용자가 존재하지 않는 경우

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

홈 정보 조회 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

