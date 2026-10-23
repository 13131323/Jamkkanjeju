# TourAPI 장소 수집

`insert_location.ps1`은 FastAPI의 `scripts/insert_location.py`와 같은 수집 규칙으로 현재 Spring LOCATION 테이블에 장소를 적재한다. Spring 서버·Maven 빌드·Python 없이 PowerShell 7에서 독립 실행한다.

## 수집 규칙

- TourAPI `areaBasedList2`, 제주 `areaCode=39`, 페이지당 1,000건으로 전체 페이지를 조회한다. 콘텐츠 유형별로 나누거나 `contentTypeId`로 제한하지 않는다.
- 분류체계 대분류 `lclsSystm1`에 따라 EV=축제·공연·행사, EX=체험관광, FD=음식, SH=쇼핑, VE=문화관광, LS=레저스포츠만 저장한다. 숙박·역사관광·자연관광 등 다른 대분류는 제외한다.
- 제목을 trim하고 주소는 비어 있지 않은 addr1·addr2를 공백 하나로 연결한다. 제목·주소 누락, 제목 100자·주소 255자 초과, 좌표 오류는 건너뛰지 않고 전체 적재 전에 실패시킨다.
- 인증 반경은 모두 100m이다. mapx는 longitude, mapy는 latitude에 저장한다.
- 전체 조회 건수와 totalCount를 비교한다. 같은 contentId의 동일 데이터는 한 건으로 합치고 값이 다르면 중단한다.
- 모든 대상을 검증한 뒤 contentId 오름차순으로 적재한다. ID를 직접 지정하지 않는다.
- 기존 content_id는 장소 PK를 유지하며 제목·주소·분류·반경·좌표만 갱신한다. 새 content_id는 추가하고, 수집 결과에 없는 기존 장소는 삭제하지 않는다. 기존 미션 등의 장소 참조를 유지한다.
- 실제 저장은 단일 트랜잭션이다. SQL 실행 중 실패하면 커밋하지 않으며 전체 저장 후 contentId별 존재 건수를 확인한다. 저장 건수 검증은 COMMIT 이후이므로 해당 검증 실패 시에는 DB를 확인해야 한다.

## 사전 준비

1. PowerShell 7과 Docker Desktop을 준비한다.
2. 현재 프로젝트의 `.env`에 `TOUR_API_SERVICE_KEY`를 설정한다. 기존 Spring TourApiClient와 동일하게 디코딩된 원문 키를 넣는다.
3. 로컬 Compose의 `mysql` 서비스가 실행 중이고 Flyway의 LOCATION 스키마가 이미 적용되어 있어야 한다.

이 스크립트는 컨테이너를 기동하거나 스키마·Flyway·목 데이터 SQL을 실행하지 않는다. Azure DB 설정 파일도 읽지 않는다. DB 접속은 로컬 Compose의 `mysql` 서비스 내부 환경변수 MYSQL_USER·MYSQL_PASSWORD·MYSQL_DATABASE를 사용하며 호스트의 MYSQL_HOST·MYSQL_PORT로 외부 DB에 연결하지 않는다.

## 실행

프로젝트 루트에서 실행한다.

```powershell
cd D:\tour\server-spring
```

먼저 수집·검증과 분류별 개수만 확인한다. 이 옵션은 실제 TourAPI를 호출하지만 DB에 연결하거나 저장하지 않는다.

```powershell
pwsh -File .\scripts\insert_location.ps1 -DryRun
```

로컬 Docker MySQL에 실제 추가·갱신한다.

```powershell
pwsh -File .\scripts\insert_location.ps1
```

도움말만 확인한다. API·DB를 호출하지 않는다.

```powershell
pwsh -File .\scripts\insert_location.ps1 -Help
```

TourAPI 설정은 `.env`의 TOUR_API_BASE_URL·TOUR_API_SERVICE_KEY·TOUR_API_MOBILE_OS·TOUR_API_MOBILE_APP을 사용하며 같은 프로세스 환경변수가 있으면 우선한다. 키가 비어 있으면 실패한다. 인증키와 비밀번호는 출력하지 않는다.

재실행하면 같은 규칙으로 기존 장소 정보를 갱신한다. 개발용 볼륨을 삭제하거나 앱 이미지를 재빌드할 필요가 없다.
