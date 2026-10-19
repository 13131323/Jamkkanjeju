# 협동 미션 시작/이어하기 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 협동 미션 시작/이어하기 |
| HTTP 메서드 | `POST` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/{missionId}/progress` |

### API 설명

사용자가 협동 미션을 처음 시작하거나 본인이 참가 중인 팀의 협동 미션을 이어서 할 때 호출한다.

해당 미션의 진행 중인 팀에 본인이 `PENDING` 또는 `ACCEPTED` 상태로 등록되어 있으면 방장(`HOST`)·팀원(`MEMBER`) 구분 없이 기존 팀의 진행도 ID를 반환한다. 이어하기는 기존 팀과 참가 상태를 변경하지 않는다.

해당 미션에서 이어갈 팀이 없으면 새 팀을 만들고 본인을 방장으로 참가시킨다. 다른 사용자의 팀이 같은 미션을 진행하고 있더라도 해당 팀에 자동으로 합류하지 않는다.

같은 미션에서는 사용자당 참가·대기 중인 팀을 하나만 유지하며 기존 팀이 있으면 새로 만들지 않는다. 다른 협동 미션의 참가·대기 기록은 이 미션을 시작하는 데 영향을 주지 않는다.

`PENDING` 상태로 이어가는 경우에도 기존 참가 상태를 자동으로 수락 처리하지 않는다. 프론트는 상태 조회 결과에 따라 참가 대기 화면을 표시한다.

완료된 팀의 참가 이력은 새 시작을 제한하지 않는다. 완료한 미션을 다시 시작하면 과거 팀을 초기화하거나 재사용하지 않고 새 진행도 ID를 반환한다.

시작·이어하기 모두 진행도 ID와 팀 토큰을 반환한다. 팀 토큰은 현재 사용자가 수락된 방장(`HOST + ACCEPTED`)인 경우에만 문자열로 반환하며, 대기 중인 방장이나 팀원은 `null`을 반환한다. 팀 상태·참가자 목록·역할 정보·보상 정보는 이 응답에 포함하지 않는다. 프론트는 성공 응답을 받은 뒤 반환된 진행도 ID로 협동 미션 상태 조회를 즉시 호출하고, 이후 폴링으로 화면을 동기화한다.

같은 사용자가 같은 미션의 시작을 반복하거나 동시에 요청해도 팀을 중복 생성하지 않는다.

비활성화된 협동 미션은 시작하거나 이어서 할 수 없다.

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
| `missionId` | integer | 필수 | 시작하거나 이어서 진행할 협동 미션의 공통 미션 ID. 팀 진행도 ID와 구분 |

요청 예시:

```http
POST /api/v2/cooperative-missions/4/progress
Authorization: Bearer {accessToken}
```

---

### 요청 Body

없음

---

### 정상 응답 데이터

Status Code : `201 Created`

새 팀을 만들어 협동 미션을 시작한 경우

Status Code : `200 OK`

본인이 `PENDING` 또는 `ACCEPTED` 상태로 등록된 해당 미션의 진행 중인 팀을 이어서 하는 경우

두 경우의 응답 형식은 동일하다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `cooperativeMissionProgressId` | integer | 시작하거나 이어서 진행할 팀의 협동 미션 진행도 ID. 신규 시작이면 새 ID, 이어하기면 기존 ID |
| `teamToken` | string 또는 null | 현재 사용자가 `HOST + ACCEPTED`이면 팀원 초대에 사용할 팀 토큰, 그 외에는 `null` |

```json
{
  "cooperativeMissionProgressId": 31,
  "teamToken": "example_team_token"
}
```

현재 사용자가 대기 중이거나 팀원인 경우:

```json
{
  "cooperativeMissionProgressId": 31,
  "teamToken": null
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

`missionId`를 정수로 변환할 수 없는 경우는 공통 요청값 검증 실패에 해당한다.

#### 협동 미션 없음

Status Code : `404 Not Found`

요청한 미션 ID에 해당하는 협동 미션이 없는 경우. 문화 미션·보물찾기 미션 등 다른 유형의 미션 ID를 전달한 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_MISSION_NOT_FOUND",
  "message": "협동 미션을 찾을 수 없습니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

요청한 협동 미션의 상태가 `INACTIVE`인 경우. 신규 시작과 기존 팀 이어하기 모두 해당한다.

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

---

# URL로 참여 요청 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | URL로 협동 미션 참여 요청 |
| HTTP 메서드 | `POST` |
| 도메인 | `COOPERATIVE_MISSION` |
| 엔드포인트 | `/api/v2/cooperative-missions/join-requests` |

### API 설명

초대 URL을 연 사용자가 해당 협동 미션 팀에 참여를 요청할 때 호출한다.

프론트는 초대 URL에서 팀 토큰을 추출하여 요청 Body의 `teamToken`으로 전달한다.

새로운 참여 요청을 생성하면 사용자는 해당 팀의 `MEMBER + PENDING` 참가자로 등록된다. 동일한 팀에 현재 사용자의 `PENDING` 또는 `ACCEPTED` 참가자 정보가 이미 있으면 중복 생성하지 않고 기존 참가자 정보를 반환한다.

현재 사용자가 같은 협동 미션의 다른 진행 중인 팀에 이미 `PENDING` 또는 `ACCEPTED` 상태로 참가하고 있으면 새로운 팀에 참여를 요청할 수 없다. 다른 협동 미션의 참가 기록과 완료된 팀의 참가 이력은 이 요청을 제한하지 않는다.

프론트는 응답의 `cooperativeMissionProgressId`를 사용하여 협동 미션 상태 조회 API를 폴링한다. 참가 상태가 `PENDING`이면 수락 대기 화면을 유지하고, `ACCEPTED`이면 협동 미션 방으로 이동한다.

비활성화된 협동 미션에는 참여를 요청할 수 없다.

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

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `teamToken` | string | 필수 | 초대 URL에서 추출한 팀 단위 초대 토큰. 공백일 수 없으며 최대 100자 |

```json
{
  "teamToken": "example_team_token"
}
```

---

### 정상 응답 데이터

Status Code : `201 Created`

새로운 `PENDING` 참가자를 생성한 경우

Status Code : `200 OK`

대상 팀에 현재 사용자의 `PENDING` 또는 `ACCEPTED` 참가자 정보가 이미 존재하는 경우

두 경우의 응답 형식은 동일하다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `cooperativeMissionProgressId` | integer | 참여를 요청한 팀의 협동 미션 진행도 ID. 이후 상태 조회에 사용 |
| `participantId` | integer | 현재 사용자의 협동 미션 참가자 ID |
| `participantStatus` | string | 현재 참가 상태. `PENDING` 또는 `ACCEPTED` |

새로운 참여 요청을 생성한 경우:

```json
{
  "cooperativeMissionProgressId": 31,
  "participantId": 47,
  "participantStatus": "PENDING"
}
```

기존 참가자 정보를 반환하는 경우:

```json
{
  "cooperativeMissionProgressId": 31,
  "participantId": 47,
  "participantStatus": "ACCEPTED"
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

`teamToken`이 누락되거나 공백이거나 100자를 초과한 경우는 공통 요청값 검증 실패에 해당한다.

#### 유효하지 않은 초대 토큰

Status Code : `404 Not Found`

`teamToken`에 해당하는 진행 중인 협동 미션 팀을 찾을 수 없는 경우. 존재하지 않는 토큰이거나 해당 팀이 이미 완료된 경우를 포함한다.

```json
{
  "code": "INVALID_INVITE_TOKEN",
  "message": "유효하지 않은 초대 링크입니다."
}
```

#### 비활성화된 협동 미션

Status Code : `404 Not Found`

팀 토큰에 해당하는 협동 미션의 상태가 `INACTIVE`인 경우. 대상 팀에 기존 참가자 정보가 있는 경우도 포함한다.

```json
{
  "code": "COOPERATIVE_MISSION_INACTIVE",
  "message": "비활성화된 협동 미션입니다."
}
```

#### 동일 협동 미션의 다른 팀에 참가 중

Status Code : `409 Conflict`

현재 사용자가 같은 협동 미션의 다른 진행 중인 팀에 `PENDING` 또는 `ACCEPTED` 상태로 참가하고 있는 경우

```json
{
  "code": "COOPERATIVE_MISSION_ALREADY_PARTICIPATING",
  "message": "이미 해당 협동 미션에 참여 중입니다."
}
```

#### 협동 미션 참여 인원 초과

Status Code : `409 Conflict`

대상 팀의 `PENDING`과 `ACCEPTED` 참가자가 방장을 포함하여 이미 6명인 경우

```json
{
  "code": "COOPERATIVE_MISSION_FULL",
  "message": "협동 미션 참여 인원이 가득 찼습니다."
}
```

#### 협동 미션 참여 요청 마감

Status Code : `409 Conflict`

대상 팀이 참여 요청을 받을 수 있는 1단계를 지난 경우

```json
{
  "code": "COOPERATIVE_MISSION_JOIN_CLOSED",
  "message": "협동 미션 참여 요청이 마감되었습니다."
}
```

