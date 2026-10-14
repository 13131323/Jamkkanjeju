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

인증이 필요한 API이며, 현재 진행도 ID와 다음에 풀 퀴즈 번호, 전체 문제 정보를 반환한다. 문제의 정답은 주관식과 객관식 모두 문자열로 반환한다.

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
| `quizDetails[].answer` | string | 문제 정답. 객관식도 선택지 번호가 아닌 정답 문자열 |
| `quizDetails[].hint` | string, null | 문제 힌트. 힌트가 없으면 `null` |
| `quizDetails[].explanation` | string, null | 문제 정답 해설. 해설이 없으면 `null` |

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
      "answer": "하르방",
      "hint": "제주의 돌하르방을 떠올려 보세요.",
      "explanation": "제주어에서 할아버지를 뜻하는 대표적인 표현은 하르방입니다."
    },
    {
      "quizIndex": 2,
      "imgUrl": "https://example.com/images/quizzes/jeju-drama.jpg",
      "question": "제주를 배경으로 여러 인물의 삶을 옴니버스 형식으로 담아낸 노희경 작가의 드라마는 무엇일까요?",
      "options": ["우리들의 블루스", "우도의 봄", "갯마을 차차차", "도깨비"],
      "answer": "우리들의 블루스",
      "hint": "제목에 제주 바다를 연상시키는 색상이 들어가요.",
      "explanation": "우리들의 블루스는 제주를 배경으로 여러 인물의 삶을 옴니버스 형식으로 그린 드라마입니다."
    },
    {
      "quizIndex": 3,
      "imgUrl": null,
      "question": "'하영'은 제주 방언으로 어떤 뜻일까요?",
      "options": null,
      "answer": "많이",
      "hint": "수량이 넉넉하다는 의미로 사용해요.",
      "explanation": "하영은 제주 방언으로 많이라는 뜻입니다."
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

