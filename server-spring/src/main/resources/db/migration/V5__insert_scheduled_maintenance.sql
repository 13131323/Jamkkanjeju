-- 홈 점검 예약 공지 확인용 데이터. Flyway 최초 적용 시각(KST)을 기준으로 예약한다.
-- 적용 1시간 뒤 점검 시작, 2시간 뒤 종료 예정이며 예약 상태로 저장한다.
-- 점검 시작 시 상태를 IN_PROGRESS로 전환하는 스케줄러는 별도 구현 대상이다.
INSERT INTO `maintenance`
    (`message`, `starts_at`, `ends_at`, `status`)
VALUES
    ('장소 데이터 동기화를 위한 서비스 점검이 예정되어 있습니다. 점검 시간 동안 서비스 이용이 제한됩니다.',
     DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR),
     DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 HOUR),
     'SCHEDULED');
