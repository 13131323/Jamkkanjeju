# 에이전트 저장 장소 조회 테스트

- 상태: 완료
- 실행일: 2026-11-16
- 결과: Spring 28개 + Python 24개, 총 52개 통과 (실패·오류·건너뜀 0개)
- 기준: API_SPEC.md와 BUISNESS_RULE.md. 이 API와 Tool의 개별 테스트만 실행한다.

## 진행 방식

| 구분 | 방법 |
| --- | --- |
| 단위 | 실제 필터·Mockito·MockHttpServletRequest로 토큰 미설정·누락·불일치·중복·일치와 토큰 마스킹 검증 |
| 통합 | MockMvc·실제 JWT·Docker MySQL의 실행별 임시 DB로 인증 격리·페이지·응답·데이터 보존 확인. 테스트별 롤백 |
| Python | HTTP 대역으로 고정 헤더·입력·페이지·오류·비밀 정보 비노출 검증 |

## 검증 항목

| 클래스 | 준비 조건·기대 결과 |
| --- | --- |
| AgentTokenAuthenticationFilterTest | 정확한 토큰만 전용 권한 부여, credentials 없음, 누락과 잘못된 토큰 구분, 비어 있는 서버 설정 거부, 중복 헤더 거부, 설정 객체 출력 마스킹 |
| GetStoredLocationsApiIntegrationTest | 기본값·전체 필드·ID순·다음 페이지·빈 결과·최대 size·입력 경계·형식 오류, 누락·오류 토큰·JWT만 사용 시 거부, 정상 토큰에 잘못된 Authorization이 있어도 조회, 에이전트 토큰의 일반 API 접근 거부와 정상 JWT의 일반 API 접근 유지, 허용하지 않은 에이전트 메서드 거부, 장소 및 관련 테이블 변경 없음 |
| Python test_stored_locations.py | Authorization 대신 X-Agent-Token, 기존 경계·실패 테스트 유지, 환경변수에서 고정 키 읽기, 토큰이 Tool 스키마에 없고 결과·오류에 노출되지 않음 |

## 결과

| 클래스 | 개수 | 결과 |
| --- | --- | --- |
| AgentTokenAuthenticationFilterTest | 12 | 통과 |
| GetStoredLocationsApiIntegrationTest | 16 | 통과 |
| Python test_stored_locations.py | 24 | 통과 |
| 합계 | 52 | 전부 통과 |

## 발견하고 수정한 점

- 컴파일과 계획한 개별 테스트만 실행했다. 전체 API 테스트는 실행하지 않았다.
- 별도 보안 체인으로 에이전트 고정 토큰과 사용자 JWT를 분리했다. 토큰 누락·불일치, JWT만 사용, 일반 API에 고정 토큰만 사용, 허용하지 않은 메서드 접근을 확인했다.
- 실제 MySQL 페이지 순회에서 ID 정렬·다음 페이지·누락 및 중복 없음과 잘못된 입력·범위 밖 페이지를 검증했다. 조회 전후 장소·미션·진행도·보상 상태·방명록 개수는 유지되었다.
- 테스트 DB는 실행 종료 후 자동 삭제되었다. 개발 DB·볼륨이나 마이그레이션을 변경하지 않았다.
- Python Tool은 Authorization 및 사용자 액세스 토큰 의존성을 제거하고, 비밀 설정을 모델 입력에 노출하지 않는 X-Agent-Token 방식으로 변경했다.

- 로컬 Spring 컨테이너 재빌드 후 Python CLI를 실제 실행했다. page=0·size=2에서 라토커피제주·블루메베이글 두 장소와 hasNext=true가 반환되었다. 로그인·사용자 액세스 토큰 없이 고정 토큰으로 호출했다.
