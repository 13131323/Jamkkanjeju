# 문화 미션 시작/이어하기 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 문화 미션 시작/이어하기 |
| HTTP 메서드 | `POST` |
| 도메인 | `CULTURE_MISSION` |
| 엔드포인트 | `/api/v2/culture-missions/{missionId}/progress` |

### API 설명

사용자가 문화 미션을 처음 시작하거나 진행 중이던 문화 미션을 이어서 할 때 호출한다. 완료한 문화 미션도 다시 시작할 수 있다.

처음 시작하는 경우 현재 퀴즈 번호는 1, 정답 개수는 0으로 시작한다. 진행 중인 미션을 이어서 하는 경우 기존 진행 상태를 유지한다. 완료한 미션을 다시 시작하는 경우 현재 퀴즈 번호와 정답 개수를 초기화하며 기존 진행도 ID를 유지한다.

인증이 필요한 API이며, 현재 진행도 ID와 다음에 풀 퀴즈 번호, 전체 문제 정보를 반환한다. 문제의 정답과 해설은 포함하지 않으며, 진행도 저장 API의 채점 응답으로 제공한다.

비활성화된 문화 미션은 시작·이어하기·재시작할 수 없다.

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
| `missionId` | integer | 필수 | 시작하거나 이어서 진행할 문화 미션의 공통 미션 ID. 홈 조회에서 받은 `missionId`를 전달한다. |

요청 예시:

```http
POST /api/v2/culture-missions/12/progress
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `201 Created`

문화 미션을 처음 시작하여 진행도를 새로 생성한 경우

Status Code : `200 OK`

진행 중인 문화 미션을 이어서 하거나 완료한 문화 미션을 기존 진행도 ID로 다시 시작한 경우

두 경우의 응답 형식은 동일하다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `cultureMissionProgressId` | integer | 현재 진행 중인 문화 미션의 진행도 ID. 이어하기와 재시작 시 기존 ID 유지 |
| `quizCount` | integer | 문화 미션의 전체 문제 수 |
| `currentQuizNumber` | integer | 사용자가 다음에 풀 퀴즈 번호. 최초 시작과 재시작 시 1. 예를 들어 1번 문제까지 풀었다면 2 |
| `quizDetails` | object[] | `quizIndex` 오름차순으로 정렬된 전체 문제 목록 |
| `quizDetails[].quizIndex` | integer | 문제 번호 |
| `quizDetails[].imgUrl` | string, null | 문제 이미지 URL. 이미지가 없으면 `null` |
| `quizDetails[].question` | string | 문제 내용 |
| `quizDetails[].options` | string[], null | 객관식 선택지. 주관식 문제이면 `null` |
| `quizDetails[].hint` | string, null | 문제 힌트. 힌트가 없으면 `null` |

```json
{
  "cultureMissionProgressId": 1,
  "quizCount": 3,
  "currentQuizNumber": 1,
  "quizDetails": [
    {
      "quizIndex": 1,
      "imgUrl": "https://example.com/images/quizzes/jeju-dialect-1.jpg",
      "question": "제주어로 할아버지는 무엇일까요?",
      "options": ["하르방", "하라범", "하르봉", "하르범"],
      "hint": "제주의 돌하르방을 떠올려 보세요."
    },
    {
      "quizIndex": 2,
      "imgUrl": "https://example.com/images/quizzes/jeju-drama.jpg",
      "question": "제주를 배경으로 여러 인물의 삶을 옴니버스 형식으로 담아낸 노희경 작가의 드라마는 무엇일까요?",
      "options": ["우리들의 블루스", "우도의 봄", "갯마을 차차차", "도깨비"],
      "hint": "제목에 제주 바다를 연상시키는 색상이 들어가요."
    },
    {
      "quizIndex": 3,
      "imgUrl": null,
      "question": "'하영'은 제주 방언으로 어떤 뜻일까요?",
      "options": null,
      "hint": "수량이 넉넉하다는 의미로 사용해요."
    }
  ]
}
```

---

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

`missionId`를 정수로 변환할 수 없는 경우

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

문화 미션 시작·이어하기·재시작 처리 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

#### 문화 미션 없음

Status Code : `404 Not Found`

`missionId`에 해당하는 문화 미션이 존재하지 않는 경우

```json
{
  "code": "CULTURE_MISSION_NOT_FOUND",
  "message": "문화 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 문화 미션

Status Code : `404 Not Found`

요청한 문화 미션의 상태가 `INACTIVE`인 경우

```json
{
  "code": "CULTURE_MISSION_INACTIVE",
  "message": "비활성화된 문화 미션입니다."
}
```

---

# 문화 미션 진행도 저장 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 문화 미션 진행도 저장 |
| HTTP 메서드 | `PATCH` |
| 도메인 | `CULTURE_MISSION` |
| 엔드포인트 | `/api/v2/culture-missions/{cultureMissionProgressId}/progress` |

### API 설명

사용자가 문화 미션 퀴즈를 풀고 다음 문제로 이동할 때 호출한다.

시작/이어하기 응답으로 받은 진행도 ID와 제출한 퀴즈 번호, 답변을 전달한다. 현재 사용자의 진행 중인 문화 미션만 저장할 수 있으며, 제출한 퀴즈 번호는 현재 풀어야 하는 번호와 일치해야 한다.

서버가 제출한 답변을 채점하고 해당 문제의 정답 여부, 정답과 해설을 반환한다. 객관식 답변도 선택지 번호가 아닌 선택한 문자열을 전달한다.

정답이면 정답 개수가 증가한다. 마지막 문제가 아니면 다음 퀴즈 번호를 반환하고, 마지막 문제이면 미션을 완료 처리하여 마지막 퀴즈 번호와 다음 추천 장소, 이번 요청으로 실제 지급된 보상을 반환한다.

완료 시 정답 개수에 따라 AR 캐릭터, 포인트, 쿠폰 순서로 보상을 받을 수 있다. 같은 사용자와 같은 문화 미션에서 이전에 지급받은 보상 항목은 다시 지급하지 않는다. 지급되지 않은 보상 항목은 `null`로 반환한다.

진행 중에는 `nextLocation`과 `reward`를 `null`로 반환한다. 완료 시 다음 추천 장소는 객체로 반환하며, 장소 이미지를 제공하지 못하는 경우 이미지 URL만 `null`로 반환한다.

인증이 필요한 API이며, 진행 도중 문화 미션이 비활성화된 경우에도 진행도를 저장할 수 없다.

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

---

### 요청 Path

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `cultureMissionProgressId` | integer | 필수 | 저장할 문화 미션 진행도 ID. 시작/이어하기 응답으로 받은 값을 전달한다. 미션 ID와 구분 |

요청 예시:

```http
PATCH /api/v2/culture-missions/31/progress?latitude=33.5572&longitude=126.7591
Authorization: Bearer {accessToken}
Content-Type: application/json
```

---

### 요청 Body

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `quizIndex` | integer | 필수 | 사용자가 제출한 퀴즈 번호 |
| `answer` | string | 필수 | 사용자가 제출한 답변. 객관식도 선택지 번호가 아닌 선택한 문자열 |

```json
{
  "quizIndex": 2,
  "answer": "우리들의 블루스"
}
```

---

### 정상 응답 데이터

Status Code : `200 OK`

문화 미션 진행도를 정상적으로 저장한 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `isCorrect` | boolean | 이번 요청으로 제출한 답변의 서버 채점 결과 |
| `answer` | string | 이번 요청으로 제출한 문제의 정답. 객관식도 정답 문자열 |
| `explanation` | string, null | 이번 요청으로 제출한 문제의 해설. 해설이 없으면 `null` |
| `missionProgressStatus` | string | 문화 미션 진행 상태. `IN_PROGRESS \| COMPLETED` |
| `quizCount` | integer | 문화 미션의 전체 문제 수 |
| `currentQuizNumber` | integer | 현재 퀴즈 번호. 진행 중이면 다음에 풀 번호, 완료 시 마지막 퀴즈 번호 |
| `correctNumber` | integer | 현재까지 맞힌 문제 수 |
| `nextLocation` | object, null | 다음 추천 장소 정보. 진행 중이면 `null`, 완료되면 객체 |
| `nextLocation.id` | integer | 다음 장소 ID |
| `nextLocation.locationTitle` | string | 다음 장소명 |
| `nextLocation.locationImageUrl` | string, null | 다음 장소 이미지 URL. 이미지를 제공하지 못하면 `null` |
| `nextLocation.distanceMeter` | number | 요청 위치에서 다음 장소까지의 직선거리(m) |
| `nextLocation.mission` | object, null | 다음 장소에서 수행할 활성 미션. 연결된 활성 미션이 없으면 `null` |
| `nextLocation.mission.id` | integer | 다음 미션의 공통 미션 ID |
| `nextLocation.mission.missionType` | string | 다음 미션 유형. `CULTURE \| COOPERATIVE \| TREASURE` |
| `reward` | object, null | 이번 요청으로 실제 지급된 보상 정보. 진행 중이면 `null`, 완료되면 객체 |
| `reward.arCharacter` | object, null | 이번 요청으로 지급된 AR 캐릭터. 지급되지 않았으면 `null` |
| `reward.arCharacter.id` | integer | AR 캐릭터 ID |
| `reward.arCharacter.name` | string | AR 캐릭터 이름 |
| `reward.arCharacter.imageUrl` | string | AR 캐릭터 이미지 URL |
| `reward.point` | integer, null | 이번 요청으로 지급된 포인트. 지급되지 않았으면 `null` |
| `reward.coupon` | object, null | 이번 요청으로 지급된 쿠폰. 지급되지 않았으면 `null` |
| `reward.coupon.couponLocation` | string, null | 쿠폰 사용처. 연결된 장소가 없으면 `null` |
| `reward.coupon.couponPrice` | integer | 쿠폰 금액 |

진행 중인 경우:

```json
{
  "isCorrect": true,
  "answer": "우리들의 블루스",
  "explanation": "우리들의 블루스는 제주를 배경으로 여러 인물의 삶을 옴니버스 형식으로 그린 드라마입니다.",
  "missionProgressStatus": "IN_PROGRESS",
  "quizCount": 3,
  "currentQuizNumber": 3,
  "correctNumber": 2,
  "nextLocation": null,
  "reward": null
}
```

마지막 퀴즈를 제출하여 완료한 경우. 아래는 정답 3개이며 이전에 지급받은 보상이 없어 세 항목 모두 지급된 예시다.

```json
{
  "isCorrect": true,
  "answer": "많이",
  "explanation": "하영은 제주 방언으로 많이라는 뜻입니다.",
  "missionProgressStatus": "COMPLETED",
  "quizCount": 3,
  "currentQuizNumber": 3,
  "correctNumber": 3,
  "nextLocation": {
    "id": 39,
    "locationTitle": "한담 해안 산책로",
    "locationImageUrl": "https://example.com/locations/handam.jpg",
    "distanceMeter": 4200,
    "mission": {
      "id": 342,
      "missionType": "TREASURE"
    }
  },
  "reward": {
    "arCharacter": {
      "id": 7,
      "name": "돌담이",
      "imageUrl": "https://example.com/characters/stone-spirit.png"
    },
    "point": 100,
    "coupon": {
      "couponLocation": "종화네 막국수",
      "couponPrice": 3000
    }
  }
}
```

이번 요청에서 포인트만 지급되고 다음 장소에 연결된 미션이 없는 경우:

```json
{
  "isCorrect": false,
  "answer": "많이",
  "explanation": "하영은 제주 방언으로 많이라는 뜻입니다.",
  "missionProgressStatus": "COMPLETED",
  "quizCount": 3,
  "currentQuizNumber": 3,
  "correctNumber": 1,
  "nextLocation": {
    "id": 39,
    "locationTitle": "한담 해안 산책로",
    "locationImageUrl": "https://example.com/locations/handam.jpg",
    "distanceMeter": 4200,
    "mission": null
  },
  "reward": {
    "arCharacter": null,
    "point": 100,
    "coupon": null
  }
}
```

완료했더라도 지급할 보상이 없으면 `reward`는 객체로 반환하며, 내부 보상 항목은 모두 `null`로 반환한다.

---

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

필수 요청값이 누락되었거나 Path·Query·Body의 형식이 올바르지 않은 경우, 위도·경도가 허용 범위를 벗어난 경우

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

문화 미션 진행도 저장 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

#### 문화 미션 진행도 없음

Status Code : `404 Not Found`

요청한 진행도가 존재하지 않거나 다른 사용자의 진행도인 경우, 이미 완료된 진행도인 경우

```json
{
  "code": "CULTURE_MISSION_PROGRESS_NOT_FOUND",
  "message": "진행 중인 문화 미션 진행도를 찾을 수 없습니다."
}
```

#### 퀴즈 번호 불일치

Status Code : `409 Conflict`

제출한 `quizIndex`가 현재 풀어야 하는 퀴즈 번호와 일치하지 않는 경우

```json
{
  "code": "CULTURE_MISSION_QUIZ_INDEX_MISMATCH",
  "message": "현재 풀어야 하는 퀴즈 번호와 일치하지 않습니다."
}
```

#### 비활성화된 문화 미션

Status Code : `404 Not Found`

진행도에 해당하는 문화 미션의 상태가 `INACTIVE`인 경우. 진행 도중 비활성화된 경우도 포함한다.

```json
{
  "code": "CULTURE_MISSION_INACTIVE",
  "message": "비활성화된 문화 미션입니다."
}
```

