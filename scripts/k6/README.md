# 지도 홈 조회 k6 측정

`"GET /api/v2/map/contents"` 문자열을 입력받아 같은 요청을 **1 VU(동시 사용자 1명)로 30회 예열 → 100회 본 측정**한다. 각 응답을 받은 다음 요청하며 별도의 대기·재시도·리다이렉트는 없다. 현재는 지도 홈 조회만 지원하며 `GET /api/v2/users/me/home`은 지원하지 않는다.

## 준비

PowerShell 7과 최신 k6를 사용한다. Windows 설치는 [k6 공식 설치 안내](https://grafana.com/docs/k6/latest/set-up/install-k6/)를 따른다.

```powershell
winget install k6 --source winget
```

설치 후 새 터미널에서 `k6 version`으로 확인한다. 서버와 MySQL은 미리 실행되어 있어야 한다. 이 모듈은 서버·컨테이너를 기동하거나 DB 데이터를 준비하지 않는다.

설치 전부터 열어 둔 터미널에서 실행하더라도 스크립트는 저장된 시스템·사용자 PATH를 추가로 탐색해 k6를 찾는다. 터미널이나 시스템의 PATH 자체를 변경하지 않는다.

인증은 아래 중 하나를 사용한다.

- 개발 서버의 `DEV_AUTH_ENABLED=true`와 자동 로그인 대상 사용자 데이터가 준비되어 있으면 토큰 없이 실행한다.
- 그 외에는 유효한 액세스 토큰을 `K6_MAP_ACCESS_TOKEN` 환경변수 또는 `-AccessToken`으로 전달한다. 모듈은 로그인 API를 추가 호출하지 않는다.

## 실행

```powershell
cd D:\tour\server-spring
pwsh -File .\scripts\k6\run.ps1 "GET /api/v2/map/contents"
```

30회 예열 결과가 먼저 터미널에 출력되고, 정상 종료하면 100회 측정 결과가 별도로 출력된다. **성능 비교에는 두 번째인 본 측정 결과를 사용한다.** 별도 실행이므로 예열 30회의 지표는 100회 집계에 섞이지 않지만 본 측정 첫 요청의 연결 수립 비용은 새로 발생할 수 있다.

API를 호출하지 않고 URL·횟수·인증 방식만 확인하려면:

```powershell
pwsh -File .\scripts\k6\run.ps1 "GET /api/v2/map/contents" -DryRun
```

현재 PowerShell 세션에서 설정한 토큰은 자식 `pwsh`와 k6에 전달된다. `.env`는 자동으로 읽지 않는다.

```powershell
$env:K6_MAP_ACCESS_TOKEN = '발급받은 액세스 토큰 원문'
pwsh -File .\scripts\k6\run.ps1 "GET /api/v2/map/contents"
Remove-Item Env:K6_MAP_ACCESS_TOKEN
```

### 요청 옵션

`isClustered=false` 상세 응답만 측정하며 사용자가 변경하는 옵션은 제공하지 않는다.

기본 좌표는 2026-10-23 로컬 Docker MySQL의 실제 좌표를 조회해 정했다. 서버의 사방 20% 확장(가로·세로 1.4배)을 적용한 범위에 **장소 14개 + 길바닥 방명록 1개 = 총 15개**가 포함되는 것을 DB에서 확인했다. 데이터 추가·삭제·좌표 변경 또는 다른 서버 사용 시 개수는 달라질 수 있다. 10~20개 조건은 현재 데이터에 맞춘 기본 범위이며 실행 때마다 자동으로 범위를 재선정하거나 DB를 변경하지 않는다.

| 옵션 | 기본값 | 의미 |
| --- | --- | --- |
| `-BaseUrl` | `http://localhost:8080` | 서버 주소. 다른 서버를 대상으로 할 때는 부하 테스트 권한을 확인한다. |
| `-LeftTopLatitude` | `33.516564` | 좌상단 위도 |
| `-LeftTopLongitude` | `126.871019` | 좌상단 경도 |
| `-RightBottomLatitude` | `33.473436` | 우하단 위도 |
| `-RightBottomLongitude` | `126.922981` | 우하단 경도 |
| `-UserLatitude` | `33.495` | 사용자 위도 |
| `-UserLongitude` | `126.897` | 사용자 경도 |
| `-RequestTimeout` | `60s` | 요청별 제한 시간. 예: `120s` |
| `-AccessToken` | `K6_MAP_ACCESS_TOKEN` 환경변수 | `Bearer ` 접두사 없는 액세스 토큰 원문 |

좌표·서버를 바꾸려면:

```powershell
pwsh -File .\scripts\k6\run.ps1 "GET /api/v2/map/contents" `
    -BaseUrl http://localhost:8080 `
    -LeftTopLatitude 33.52 -LeftTopLongitude 126.50 `
    -RightBottomLatitude 33.48 -RightBottomLongitude 126.55 `
    -UserLatitude 33.50 -UserLongitude 126.52
```

## 출력 지표

k6 기본 full summary를 터미널에 직접 출력하며 결과 파일이나 Grafana 서버는 만들지 않는다. 시간 지표에는 `avg`, `min`, `med`, `max`, `p(90)`, `p(95)`, `p(99)`를 표시한다. `p(95)`는 측정값의 95%가 그 값 이하라는 의미다. [공식 출력 옵션](https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/#summary-mode)

| 지표 | 의미 |
| --- | --- |
| `http_req_duration` | 요청 전송 + 서버 응답 대기 + 응답 수신 시간. 최초 DNS·연결 수립 시간은 제외 |
| `http_req_waiting` | 첫 응답 바이트까지 대기 시간(TTFB) |
| `http_req_sending` / `http_req_receiving` | 요청 전송 / 응답 수신 시간 |
| `http_req_blocked` / `http_req_connecting` / `http_req_tls_handshaking` | 요청 전 대기 / TCP 연결 / TLS 협상 시간 |
| `http_req_failed` | HTTP 200이 아니거나 통신에 실패한 요청 비율 |
| `http_reqs` | 실제 HTTP 요청 수와 초당 처리량 |
| `iterations` / `iteration_duration` | 반복 횟수 / 검증 코드까지 포함한 한 반복의 소요 시간 |
| `checks` 관련 지표 | HTTP 200 검증 결과 |
| `data_received` / `data_sent` | 수신 / 송신 데이터 크기와 속도 |

정확한 시간 구분은 [k6 기본 지표 문서](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)를 따른다. 서버 필터의 내부 처리 시간과 달리 클라이언트 관측 시간이며 응답 본문 수신도 포함한다. 이미지 URL을 실제로 다운로드하거나 화면을 렌더링하지는 않는다.

## 결과 해석과 주의

- 총 API 호출은 정상 완료 기준 130회다. 예열에 HTTP 오류·타임아웃이 있으면 예열 지표를 출력한 뒤 실패로 종료하고 100회 측정은 시작하지 않는다. 본 측정 오류도 실패율과 실패 로그에 표시하며 0이 아닌 종료 코드를 반환한다. 응답 본문·토큰은 출력하지 않는다.
- 지연시간 합격 기준은 임의로 두지 않았다. HTTP 200 여부만 검증하며 각 단계의 전체 실행 상한은 24시간이다. `Ctrl+C`로 중단할 수 있다.
- 같은 사용자·좌표·상세 응답 형식으로 반복한다. 기본값이 아닌 좌표를 지정하면 10~20개 범위를 벗어날 수 있으므로 비교할 때 데이터와 좌표를 유지한다.
- 상세 응답은 서버에서 TourAPI 이미지를 조회한다. 외부 호출 지연·캐시 상태·호출 한도가 측정에 반영되며, 이미지 조회 실패를 서버가 null로 처리해도 HTTP 200이면 성공으로 집계된다. 반복 측정 전에 TourAPI 호출량을 고려한다.
- 동시 다중 사용자 한계 측정이 아닌 **단일 요청 순차 반복 기준의 응답 속도 측정**이다. 실행 중 다른 요청이나 데이터 변경은 결과에 영향을 줄 수 있다.
- 기존 `RequestLoggingFilter`와 등록 코드는 제거했다. 필터 제거를 실행 중인 Docker 앱에도 반영하려면 별도로 `docker compose up -d --build app`을 실행한다. k6 파일·옵션만 바꿀 때는 앱 재빌드가 필요 없다.
