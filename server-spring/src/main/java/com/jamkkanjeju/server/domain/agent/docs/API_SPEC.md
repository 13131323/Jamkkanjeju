# 에이전트 저장 장소 조회 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 에이전트 저장 장소 조회 |
| HTTP 메서드 | `GET` |
| 도메인 | `AGENT` |
| 엔드포인트 | `/api/v2/agent/locations` |

### API 설명

get_stored_locations Tool이 현재 DB의 장소를 ID 오름차순으로 페이지 조회한다. 조회만 수행하며 장소·미션·진행도·보상·방명록을 변경하지 않는다. 사용자 로그인이나 JWT 재발급은 필요하지 않다.

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `X-Agent-Token` | 필수 | 서버와 Python에 동일하게 설정한 고정 비밀 토큰 원문. Bearer 접두사 없이 헤더 한 개로 전달 |

Authorization의 사용자 JWT는 이 API의 인증을 대신하지 않는다. 고정 토큰은 일반 사용자 API에 접근할 권한을 부여하지 않는다.

### 요청 Query

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `page` | integer | 선택 | 0 이상. 기본 0 |
| `size` | integer | 선택 | 1~100. 기본 100 |

### 요청 Path

없음

### 요청 Body

없음

### 정상 응답 데이터

Status Code : `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `locations` | object[] | 요청 페이지의 장소 목록. 결과가 없으면 빈 배열 |
| `locations[].locationId` | integer | 서비스 장소 ID |
| `locations[].contentId` | integer | TourAPI 콘텐츠 ID |
| `locations[].title` | string | 장소명 |
| `locations[].address` | string | 주소 |
| `locations[].category` | string | 서비스 장소 분류 |
| `locations[].radius` | integer | 방문 인정 반경(m) |
| `locations[].latitude` | number | 위도 |
| `locations[].longitude` | number | 경도 |
| `locationsPage` | object | 페이지 정보 |
| `locationsPage.page` | integer | 요청 페이지 번호 |
| `locationsPage.size` | integer | 요청 조회 개수 |
| `locationsPage.hasNext` | boolean | 다음 페이지 존재 여부 |

```json
{
  "locations": [{"locationId": 1, "contentId": 2853982, "title": "라토커피제주", "address": "제주시", "category": "음식", "radius": 100, "latitude": 33.4987305369, "longitude": 126.5281672061}],
  "locationsPage": {"page": 0, "size": 100, "hasNext": false}
}
```

범위를 벗어난 페이지도 빈 배열과 hasNext=false로 정상 반환한다. 여러 페이지를 읽는 동안 전체 데이터가 고정된 스냅샷이라는 보장은 없다.

### 오류 응답 데이터

#### 요청값 검증 실패

Status Code : `400 Bad Request`

page가 음수, size가 1~100 밖이거나 정수 형식이 아닌 경우

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청값이 올바르지 않습니다."
}
```

#### 인증 정보 없음

Status Code : `401 Unauthorized`

X-Agent-Token 헤더가 없는 경우. 사용자 JWT만 전달해도 동일하다.

```json
{
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

#### 유효하지 않은 토큰

Status Code : `401 Unauthorized`

헤더가 비었거나 중복되거나 설정 토큰과 불일치한 경우. 서버 토큰 미설정 상태에서도 접근을 허용하지 않는다.

```json
{
  "code": "INVALID_TOKEN",
  "message": "유효하지 않은 토큰입니다."
}
```

#### 서버 오류

Status Code : `500 Internal Server Error`

조회 중 예기치 않은 오류가 발생한 경우

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "서버 내부 오류가 발생했습니다."
}
```

#### 권한 없음

Status Code : `403 Forbidden`

정상 에이전트 인증으로 허용하지 않은 에이전트 경로·메서드에 접근한 경우

```json
{
  "code": "FORBIDDEN",
  "message": "접근 권한이 없습니다."
}
```

고정 토큰은 JWT 만료 검사를 하지 않으므로 이 API에서 EXPIRED_TOKEN은 반환하지 않는다. 토큰 교체는 양쪽 설정을 갱신하고 서버를 재시작하는 방식이다.


---

# 에이전트 점검 예약 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 에이전트 점검 예약 |
| HTTP 메서드 | `POST` |
| 도메인 | `AGENT` |
| 엔드포인트 | `/api/v2/agent/maintenances` |

### API 설명

`schedule_maintenance` Tool이 점검 공지를 예약한다. 시작 시각을 지정하면 해당 KST 시각으로 예약하고, 생략·null이면 서버 요청 처리 시각 1시간 뒤로 예약한다. 종료 예정 시각은 시작 1시간 뒤이다.
점검 등록 시점에는 서비스 이용을 차단하지 않는다. 점검 상태 전환·API 차단은 저장된 일정에 따라 서버가 처리한다. 장소 동기화는 별도로 실행해야 한다.
동일한 요청을 다시 보내면 별도의 예약이 생성되므로 응답을 받지 못한 경우 저장 여부를 확인한 뒤 재요청한다.

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `X-Agent-Token` | 필수 | Spring과 에이전트에 동일하게 설정한 고정 토큰. Bearer 접두사 없이 한 개의 헤더로 전달 |
| `Content-Type` | 필수 | `application/json` |

사용자 JWT는 에이전트 토큰 인증을 대신하지 않는다.

### 요청 Query

없음

### 요청 Path

없음

### 요청 Body

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `message` | string, null | 선택 | 점검 공지 문구. 앞뒤 공백 제거 후 최대 500자. 생략·null·빈 문자열·공백이면 기본 공지 사용 |
| `startsAt` | string(date-time), null | 선택 | 점검 시작 시각. KST 기준 offset 없는 ISO 8601. 생략·null이면 서버 현재 시각 1시간 뒤 |

기본 공지: `장소 데이터 동기화를 위한 서비스 점검이 예정되어 있습니다. 점검 시간 동안 서비스 이용이 제한됩니다.`

기본 공지 요청:

```json
{}
```

직접 지정한 공지 요청:

```json
{"message":"장소 정보 갱신을 위한 점검이 예정되어 있습니다."}
```

요청 JSON 본문은 필수이며 종료 시각은 입력받지 않는다. 시작 시각 지정 예시:

```json
{"startsAt":"2026-11-17T15:27:00"}
```

이 경우 종료 예정 시각은 `2026-11-17T16:27:00`이다.

### 정상 응답 데이터

Status Code : `201 Created`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `maintenanceId` | integer | 저장된 점검 예약 ID |
| `message` | string | 기본값·공백 정규화가 적용된 공지 문구 |
| `startsAt` | string(date-time) | 지정한 시작 시각 또는 서버 요청 처리 시각에서 1시간 뒤. KST 기준 offset 없는 ISO 8601, 초 단위 |
| `endsAt` | string(date-time) | 시작 시각에서 1시간 뒤. KST 기준 offset 없는 ISO 8601, 초 단위 |
| `status` | string | `SCHEDULED` |

```json
{
  "maintenanceId": 1,
  "message": "장소 데이터 동기화를 위한 서비스 점검이 예정되어 있습니다. 점검 시간 동안 서비스 이용이 제한됩니다.",
  "startsAt": "2026-11-18T02:00:00",
  "endsAt": "2026-11-18T03:00:00",
  "status": "SCHEDULED"
}
```

### 오류 응답 데이터

요청 검증(400), 인증·인가(401/403), 서버 오류(500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다. 도메인 고유 오류는 없다.
고정 토큰 누락은 `UNAUTHORIZED`, 비어 있거나 중복·불일치한 토큰 및 서버 토큰 미설정은 `INVALID_TOKEN`이다.
고정 토큰에는 JWT 만료 판정을 적용하지 않는다.

---

# 에이전트 장소 동기화 API

| 구분 | 내용 |
| --- | --- |
| HTTP 메서드 | `POST` |
| 엔드포인트 | `/api/v2/agent/locations/sync` |

### API 설명

사용자가 승인한 장소 추가·삭제 계획을 반영한다. 승인 절차는 에이전트 CLI에서 수행하며 이 API는 고정 토큰을 가진 에이전트 전용이다. 사용자 JWT로 호출할 수 없다.

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `X-Agent-Token` | 필수 | 기존 에이전트 고정 토큰 |
| `Idempotency-Key` | 필수 | 본문의 requestId와 동일 |

### 요청 Body

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| requestId | string | `location-sync-` 뒤 소문자 16진수 32자리. 같은 ID와 같은 계획은 기존 결과 반환 |
| storedSnapshotId | string | 필수, 공백 불가·최대 80자. 에이전트 DB 스냅샷 참조 |
| tourapiSnapshotId | string | 필수, 공백 불가·최대 80자. 에이전트 TourAPI 스냅샷 참조 |
| addLocations | object[] | 필수. contentId 양수·title 필수 최대 100자·address 필수 최대 255자·category 6분류·radius 0 이상·latitude -90~90·longitude -180~180 |
| deleteLocations | object[] | 필수. locationId와 contentId 모두 양수 |

허용 category는 축제·공연·행사, 체험관광, 음식, 쇼핑, 문화관광, 레저스포츠이다. 좌표는 유한한 수여야 한다. 배열 내 contentId 중복과 삭제 locationId 중복, 동일 contentId의 추가·삭제 동시 요청은 허용하지 않는다. 두 배열은 비어 있을 수 있다.

```json
{"requestId":"location-sync-11111111111111111111111111111111","storedSnapshotId":"db-example","tourapiSnapshotId":"tourapi-example","addLocations":[{"contentId":3000001,"title":"추가할 장소","address":"제주시","category":"음식","radius":100,"latitude":33.5,"longitude":126.5}],"deleteLocations":[{"locationId":11,"contentId":3000002}]}
```

### 정상 응답

Status Code: `200 OK`

```json
{"requestId":"location-sync-11111111111111111111111111111111","status":"COMPLETED","addedCount":1,"deletedCount":1,"addedContentIds":[3000001],"deletedContentIds":[3000002]}
```

같은 requestId와 같은 계획을 재전송하면 최초 완료 결과를 반환한다. 배열 순서는 contentId 오름차순이다. 공통 요청·인증·서버 오류는 기존 [공통 오류](../../../common/docs/commonError.md)를 따른다.

### 동기화 충돌

Status Code: `409 Conflict`

같은 requestId의 본문이 달라졌거나, 추가 contentId가 이미 존재하거나, 삭제할 locationId/contentId가 현재 DB와 다르면 반영하지 않는다. 새 비교와 승인이 필요하다.

```json
{"code":"LOCATION_SYNC_CONFLICT","message":"동기화 계획 또는 처리 상태가 변경되었습니다. 장소를 다시 비교하고 승인해 주세요."}
```
