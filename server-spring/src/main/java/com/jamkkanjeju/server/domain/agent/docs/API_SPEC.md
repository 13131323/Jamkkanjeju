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
