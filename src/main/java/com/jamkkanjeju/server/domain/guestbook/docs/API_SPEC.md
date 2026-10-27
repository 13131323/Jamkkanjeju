# 방명록 작성 API

| 구분 | 내용 |
| --- | --- |
| API 이름 | 방명록 작성 |
| HTTP 메서드 | `POST` |
| 도메인 | `GUESTBOOK` |
| 엔드포인트 | `/api/v2/guestbooks` |

### API 설명

현재 사용자가 등록된 장소의 일반 방명록 또는 직접 지정한 좌표의 길바닥 방명록을 작성할 때 호출한다.

`guestbookType`은 `GENERAL` 또는 `ROAD`다. 이미지와 오디오는 실제 파일을 `multipart/form-data`로 전송하며 각각 한 개까지 첨부할 수 있다. 글·이미지·오디오·오디오 제목·날씨·기온·색상은 선택 값이며, 콘텐츠를 모두 생략해도 작성할 수 있다.

`GENERAL`은 해당 장소에 본인의 방문 이력이 있어야 한다. 방문 이력의 날짜와 요청한 `visitedAt`이 같을 필요는 없으며, 같은 장소에 이미 작성했어도 다시 작성할 수 있다.

일반 방명록의 `missionId`는 선택 값이다. 존재하는 활성 미션이고 본인이 완료했다면 방명록에 연결한다. 활성 미션이지만 미완료라면 연결 없이 방명록을 작성한다. 존재하지 않거나 비활성인 미션을 전달하면 작성할 수 없다.

`ROAD`는 방문 이력 없이 작성할 수 있으며 장소 별칭과 위도·경도로 위치를 지정한다. `locationId`와 `missionId`는 전달하지 않는다.

오디오 제목은 사용자가 입력한 최대 20자 문자열을 사용한다. 제목을 자동 생성하지 않으며, 오디오나 제목이 없으면 `audioTitle`은 `null`로 반환한다.

저장 성공 시 `201 Created`와 저장된 방명록 정보를 반환한다. 유형에서 사용하지 않는 필드와 값이 없는 선택 필드도 생략하지 않고 `null`로 반환한다.

---

### 요청 Header

| 헤더 | 필수 여부 | 설명 |
| --- | --- | --- |
| `Authorization` | 필수 | `Bearer {accessToken}` |
| `Content-Type` | 필수 | `multipart/form-data; boundary=...`. boundary는 multipart 요청을 생성하는 클라이언트가 설정 |

---

### 요청 Query

없음

---

### 요청 Path

없음

---

### 요청 Body

Content-Type : `multipart/form-data`

| 필드 | 타입 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `guestbookType` | string | 필수 | `GENERAL \| ROAD` |
| `locationId` | integer | 조건부 필수 | `GENERAL`이면 필수인 양수 장소 ID. `ROAD`이면 미전송 |
| `locationAlias` | string | 조건부 필수 | `ROAD`이면 필수인 장소 별칭. 최대 100자. `GENERAL`이면 미전송 |
| `latitude` | number | 조건부 필수 | `ROAD`이면 필수인 위도. -90 이상 90 이하의 유한한 숫자. `GENERAL`이면 미전송 |
| `longitude` | number | 조건부 필수 | `ROAD`이면 필수인 경도. -180 이상 180 이하의 유한한 숫자. `GENERAL`이면 미전송 |
| `visitedAt` | string | 필수 | 기록할 방문 날짜. `yyyy-MM-dd` 형식 |
| `imageFile` | file | 선택 | 이미지 파일 한 개. JPEG(`.jpg`, `.jpeg`)·PNG(`.png`)·WebP(`.webp`), 최대 10MB(10,000,000바이트). 첨부한다면 비어 있지 않고 정상적으로 읽을 수 있어야 함 |
| `contentWriting` | string | 선택 | 글 내용. 최대 500자 |
| `audioFile` | file | 선택 | 오디오 파일 한 개. MP3·M4A·AAC·WAV·OGG·WebM, 최대 10MB(10,000,000바이트)·재생 시간 30초 이하. 비어 있지 않고 정상적으로 읽을 수 있어야 함 |
| `audioTitle` | string | 선택 | 사용자가 입력한 오디오 제목. 최대 20자. 제목 없이 오디오만 첨부할 수 있으며, 오디오가 없으면 제목은 저장하지 않음 |
| `contentWeather` | string | 선택 | 날씨 정보. 최대 20자 |
| `contentTemperatureCelsius` | number | 선택 | 섭씨 기온. -999.9 이상 999.9 이하, 소수 첫째 자리까지 허용 |
| `contentColorCode` | string | 선택 | 색상 코드. 최대 20자 |
| `missionId` | integer | 선택 | `GENERAL`에서 연결할 양수 공통 미션 ID. `ROAD`이면 미전송 |

- 선택 필드를 생략하면 `null`로 처리한다. 파일은 URL 문자열이나 배열이 아닌 실제 파일 한 개씩 전송한다.
- 유형에서 사용하지 않는 장소·좌표·미션 필드에 값을 전달하거나 같은 파일 필드로 여러 파일을 전달하면 공통 요청 검증 실패로 처리한다.
- 이미지와 오디오를 함께 첨부할 수 있으며 각각 최대 10MB다. 오디오는 정확히 30초까지 허용하고 30초를 넘거나 손상되어 읽을 수 없으면 거절한다.
- 파일명이나 전송한 Content-Type을 바꾸어도 실제 허용되지 않은 형식을 전송할 수 없다. HEIC/HEIF 이미지는 JPEG 등 허용 형식으로 변환한 후 전송한다.
- 방문 날짜를 서버 저장 시각으로 대체하지 않는다. 저장 시각은 응답의 `savedAt`으로 구분한다.

일반 방명록 요청 예시:

```bash
curl -X POST \
  "http://localhost:8080/api/v2/guestbooks" \
  -H "Authorization: Bearer {accessToken}" \
  -F "guestbookType=GENERAL" \
  -F "locationId=39" \
  -F "visitedAt=2026-10-27" \
  -F "imageFile=@jeju.jpg;type=image/jpeg" \
  -F "contentWriting=산책하기 좋았어요." \
  -F "audioFile=@memo.m4a;type=audio/mp4" \
  -F "audioTitle=제주의 새소리" \
  -F "contentWeather=맑음" \
  -F "contentTemperatureCelsius=24.5" \
  -F "contentColorCode=#84C7AE" \
  -F "missionId=31"
```

길바닥 방명록 요청 예시:

```bash
curl -X POST \
  "http://localhost:8080/api/v2/guestbooks" \
  -H "Authorization: Bearer {accessToken}" \
  -F "guestbookType=ROAD" \
  -F "locationAlias=성산 바다 앞" \
  -F "latitude=33.4582" \
  -F "longitude=126.9331" \
  -F "visitedAt=2026-10-27" \
  -F "contentWriting=바다가 잘 보이는 길이에요." \
  -F "audioFile=@waves.m4a;type=audio/mp4" \
  -F "audioTitle=파도소리" \
  -F "contentWeather=흐림" \
  -F "contentTemperatureCelsius=21.3"
```

---

### 정상 응답 데이터

Status Code : `201 Created`

방명록이 정상적으로 저장된 경우

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `guestbookId` | integer | 새로 저장한 방명록 ID |
| `guestbookType` | string | `GENERAL \| ROAD` |
| `locationId` | integer \| null | 일반 방명록의 장소 ID. `ROAD`이면 null |
| `locationAlias` | string \| null | 길바닥 방명록의 장소 별칭. `GENERAL`이면 null |
| `latitude` | number \| null | 길바닥 방명록의 위도. `GENERAL`이면 null |
| `longitude` | number \| null | 길바닥 방명록의 경도. `GENERAL`이면 null |
| `visitedAt` | string | 기록한 방문 날짜. `yyyy-MM-dd` 형식 |
| `contentImageUrl` | string \| null | 저장된 이미지의 단일 URL. 미첨부이면 null |
| `contentWriting` | string \| null | 저장된 글 내용 |
| `contentAudioUrl` | string \| null | 저장된 오디오의 단일 URL. 미첨부이면 null |
| `audioTitle` | string \| null | 사용자가 입력한 최대 20자 제목. 오디오나 제목이 없으면 null |
| `contentWeather` | string \| null | 저장된 날씨 정보 |
| `contentTemperatureCelsius` | number \| null | 저장된 섭씨 기온. 소수 첫째 자리까지 |
| `contentColorCode` | string \| null | 저장된 색상 코드 |
| `missionId` | integer \| null | 실제 연결된 공통 미션 ID. 미전송·미완료·`ROAD`이면 null |
| `savedAt` | string | 서버 저장 시각. KST 기준 offset 없는 ISO 8601 형식 |

일반 방명록 응답 예시:

```json
{
  "guestbookId": 101,
  "guestbookType": "GENERAL",
  "locationId": 39,
  "locationAlias": null,
  "latitude": null,
  "longitude": null,
  "visitedAt": "2026-10-27",
  "contentImageUrl": "https://example.blob.core.windows.net/media/guestbook/general/101/images/4b690ea8.jpg",
  "contentWriting": "산책하기 좋았어요.",
  "contentAudioUrl": "https://example.blob.core.windows.net/media/guestbook/general/101/audios/16bc1c76.m4a",
  "audioTitle": "제주의 새소리",
  "contentWeather": "맑음",
  "contentTemperatureCelsius": 24.5,
  "contentColorCode": "#84C7AE",
  "missionId": 31,
  "savedAt": "2026-10-27T15:30:00"
}
```

길바닥 방명록 응답 예시:

```json
{
  "guestbookId": 102,
  "guestbookType": "ROAD",
  "locationId": null,
  "locationAlias": "성산 바다 앞",
  "latitude": 33.4582,
  "longitude": 126.9331,
  "visitedAt": "2026-10-27",
  "contentImageUrl": null,
  "contentWriting": "바다가 잘 보이는 길이에요.",
  "contentAudioUrl": "https://example.blob.core.windows.net/media/guestbook/road/102/audios/6e14f508.m4a",
  "audioTitle": "파도소리",
  "contentWeather": "흐림",
  "contentTemperatureCelsius": 21.3,
  "contentColorCode": null,
  "missionId": null,
  "savedAt": "2026-10-27T15:35:00"
}
```

---

### 오류 응답 데이터

공통 오류(400/401/403/500)는 [공통 오류 응답](../../../common/docs/commonError.md)을 따른다.

파일 형식·개별 파일 용량·이미지 및 오디오 손상·오디오 재생 시간 초과는 공통 `400 INVALID_REQUEST` 대신 아래 개별 코드와 메시지를 반환한다. 필수값 누락·조건부 필드 오류·파일 중복·첨부한 빈 파일·제목 길이 초과·일반 필드 검증 실패·해석할 수 없는 multipart 요청은 공통 요청 검증 실패를 따른다.

#### 지원하지 않는 이미지 형식

Status Code : `400 Bad Request`

실제 파일 형식이 JPEG, PNG, WebP가 아니거나 이미지 형식을 판별할 수 없는 경우

```json
{
  "code": "INVALID_IMAGE_FORMAT",
  "message": "지원하지 않는 이미지 형식입니다."
}
```

#### 이미지 파일 크기 초과

Status Code : `400 Bad Request`

이미지 파일이 10MB(10,000,000바이트)를 초과한 경우

```json
{
  "code": "IMAGE_SIZE_EXCEEDED",
  "message": "이미지 파일은 10MB를 초과할 수 없습니다."
}
```

#### 손상된 이미지 파일

Status Code : `400 Bad Request`

허용된 이미지 형식으로 판별되었으나 파일이 손상되었거나 정상적으로 읽을 수 없는 경우

```json
{
  "code": "INVALID_IMAGE",
  "message": "손상되었거나 올바르지 않은 이미지 파일입니다."
}
```

#### 지원하지 않는 오디오 형식

Status Code : `400 Bad Request`

실제 파일 형식이 MP3, M4A, AAC, WAV, OGG, WebM이 아니거나 오디오 형식을 판별할 수 없는 경우

```json
{
  "code": "INVALID_AUDIO_FORMAT",
  "message": "지원하지 않는 오디오 형식입니다."
}
```

#### 오디오 파일 크기 초과

Status Code : `400 Bad Request`

오디오 파일이 10MB(10,000,000바이트)를 초과한 경우

```json
{
  "code": "AUDIO_SIZE_EXCEEDED",
  "message": "오디오 파일은 10MB를 초과할 수 없습니다."
}
```

#### 오디오 재생 시간 초과

Status Code : `400 Bad Request`

오디오 재생 시간이 30초를 초과한 경우

```json
{
  "code": "AUDIO_DURATION_EXCEEDED",
  "message": "오디오 재생 시간은 30초를 초과할 수 없습니다."
}
```

#### 손상된 오디오 파일

Status Code : `400 Bad Request`

허용 형식으로 판별되었으나 손상되었거나 정상적으로 디코딩할 수 없는 경우, 재생 가능한 오디오가 없는 경우

```json
{
  "code": "INVALID_AUDIO",
  "message": "손상되었거나 올바르지 않은 오디오 파일입니다."
}
```

#### 장소 없음

Status Code : `404 Not Found`

`GENERAL` 요청의 `locationId`에 해당하는 장소가 존재하지 않는 경우

```json
{
  "code": "LOCATION_NOT_FOUND",
  "message": "장소를 찾을 수 없습니다."
}
```

#### 미션 없음

Status Code : `404 Not Found`

전달한 `missionId`에 해당하는 미션이 존재하지 않는 경우

```json
{
  "code": "MISSION_NOT_FOUND",
  "message": "미션을 찾을 수 없습니다."
}
```

#### 비활성화된 미션

Status Code : `404 Not Found`

전달한 `missionId`에 해당하는 미션이 비활성 상태인 경우. 본인의 완료 이력이 있어도 작성할 수 없다.

```json
{
  "code": "MISSION_INACTIVE",
  "message": "비활성화된 미션입니다."
}
```

#### 장소 방문 이력 없음

Status Code : `409 Conflict`

`GENERAL` 요청의 장소에 현재 사용자의 방문 이력이 없는 경우

```json
{
  "code": "LOCATION_NOT_VISITED",
  "message": "방문한 장소에만 방명록을 작성할 수 있습니다."
}
```
