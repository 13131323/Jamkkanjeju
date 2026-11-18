# TourAPI 장소 수집

`insert_location.ps1`은 제주 법정동 코드와 도메인 분류 규칙으로 수집하여 Spring LOCATION 테이블에 새 장소만 추가한다. Spring 서버·Maven 빌드·Python 없이 PowerShell 7에서 독립 실행한다.

## 수집 규칙

- TourAPI `areaBasedList2`, 제주 법정동 지역 코드 `lDongRegnCd=50`, 페이지당 1,000건으로 전체 페이지를 조회한다. 콘텐츠 유형별로 나누거나 `contentTypeId`로 제한하지 않는다.
- 분류체계 대분류 `lclsSystm1`에 따라 EV=축제·공연·행사, EX=체험관광, FD=음식, SH=쇼핑, VE=문화관광, LS=레저스포츠만 저장한다. 숙박·역사관광·자연관광 등 다른 대분류는 제외한다.
- 제목을 trim하고 주소는 비어 있지 않은 addr1·addr2를 공백 하나로 연결한다. 제목·주소 누락, 제목 100자·주소 255자 초과, 좌표 오류는 건너뛰지 않고 전체 적재 전에 실패시킨다.
- 인증 반경은 모두 100m이다. mapx는 longitude, mapy는 latitude에 저장한다.
- 전체 조회 건수, 페이지 번호·건수, 일정한 totalCount, 제주 지역 코드를 확인한다. 중복 contentId나 페이지 누락은 전체 적재 전에 중단한다.
- 모든 대상을 검증한 뒤 contentId 오름차순으로 적재한다. ID를 직접 지정하지 않는다.
- 기존 content_id는 건너뛴다. 기존 행은 수정하거나 삭제하지 않고 새 content_id만 추가한다. 기존 미션·쿠폰·방문 기록 등의 장소 참조를 유지한다.
- 실제 저장은 단일 트랜잭션이다. SQL 실행 중 실패하면 커밋하지 않으며 전체 저장 후 contentId별 존재 건수를 확인한다. COMMIT 전 임시 테이블 CHECK로 저장 건수를 검증하고 실패하면 전체 트랜잭션을 롤백한다. COMMIT 후 결과 출력도 확인한다.

## 사전 준비

1. PowerShell 7과 Docker Desktop을 준비한다.
2. 현재 프로젝트의 `.env`에 `TOUR_API_SERVICE_KEY`를 설정한다. 기존 Spring TourApiClient와 동일하게 디코딩된 원문 키를 넣는다.
3. 로컬 Compose의 `mysql` 서비스가 실행 중이고 Flyway의 LOCATION 스키마가 이미 적용되어 있어야 한다.

이 스크립트는 컨테이너를 기동하거나 스키마·Flyway·목 데이터 SQL을 실행하지 않는다. Azure DB 설정 파일도 읽지 않는다. DB 접속은 로컬 Compose의 `mysql` 서비스 내부 환경변수 MYSQL_USER·MYSQL_PASSWORD·MYSQL_DATABASE를 사용하며 호스트의 MYSQL_HOST·MYSQL_PORT로 외부 DB에 연결하지 않는다.

## 실행

프로젝트 루트에서 실행한다.

```powershell
cd D:\tour\jamkkanjeju\server-spring
```

먼저 수집·검증과 분류별 개수만 확인한다. 이 옵션은 실제 TourAPI를 호출하지만 DB에 연결하거나 저장하지 않는다.

```powershell
pwsh -File .\scripts\insert_location.ps1 -DryRun
```

로컬 Docker MySQL에 없는 장소만 실제 추가한다.

```powershell
pwsh -File .\scripts\insert_location.ps1
```

도움말만 확인한다. API·DB를 호출하지 않는다.

```powershell
pwsh -File .\scripts\insert_location.ps1 -Help
```

TourAPI 설정은 `.env`의 TOUR_API_BASE_URL·TOUR_API_SERVICE_KEY·TOUR_API_MOBILE_OS·TOUR_API_MOBILE_APP을 사용하며 같은 프로세스 환경변수가 있으면 우선한다. 키가 비어 있으면 실패한다. 인증키와 비밀번호는 출력하지 않는다.

재실행해도 기존 content_id는 건너뛰며 새 장소만 추가한다. inserted_count(추가), skipped_count(기존 장소 제외), verified_count(수집 대상 존재 확인)를 출력한다. 개발용 볼륨 삭제나 앱 재빌드는 필요하지 않다. 마이그레이션과 Flyway 이력은 변경하지 않는다.

## 지도 사진 캐시 사전 적재

처음부터 사진을 표시하고 싶으면 서비스 확인 전에 다음 명령을 실행한다. 재빌드는 필요하지 않다.

```powershell
pwsh -File .\scripts\warm_location_images.ps1
```

- 제주 도메인 대상 전체 페이지를 수집·검증하고 목록 응답의 firstimage/firstimage2 URL을 사용한다. 장소마다 detailCommon2를 호출하지 않는다. 페이지당 1,000건이므로 현재 전체 2,110건 기준 목록 API 3회로 대상 1,527건을 확인한다.
- HTTP(S) URL이 있는 항목만 Redis에 URL: 값으로 저장한다. TTL은 지도 정책과 같은 24시간이며 SET NX로 기존 URL·NO_IMAGE 값과 TTL을 유지한다.
- 목록의 URL 부재를 정상 사진 없음으로 확정하지 않는다. 그런 장소는 기존 백그라운드 개별 조회가 담당한다.
- MySQL·마이그레이션을 읽거나 변경하지 않는다. 모든 API 응답을 검증한 뒤 Redis에 전송하며 오류가 발생하면 메시지를 표시한다. Redis 전송 중 장애는 일부 성공할 수 있으나 재실행은 안전하다.
- Redis 캐시 삭제·유실 또는 만료 후 다시 실행하면 된다. 이 스크립트는 수동 도구이며 서버의 자동 기동 작업과 별개다. 실행 중인 앱의 개별 사진 대기열 정책은 그대로 유지된다.
- `-DryRun`은 실제 목록 API를 호출해 대상 건수만 확인하고 Redis는 변경하지 않는다. `-Help`는 외부 호출 없이 도움말만 표시한다.

서버 기동 후에는 별도 백그라운드 사전 적재가 자동 실행된다. DB 장소 중 만료·미적재 캐시만 채우고 유효한 값과 TTL은 유지한다. 홈 조회·GPS·전체 삭제는 적재를 트리거하지 않는다. 목록 URL이 없는 대상은 기존 5개 대기열에서 개별 확인하며, 이용 중 지도 miss 적재도 계속 동작한다. 위 스크립트는 수동 보조 도구다.
