-- 장소 동기화 DML과 같은 트랜잭션으로 완료 결과를 보관한다.
CREATE TABLE `agent_location_sync_execution` (
    `request_id` VARCHAR(80) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `added_content_ids` JSON NOT NULL,
    `deleted_content_ids` JSON NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`request_id`),
    CONSTRAINT `ck_agent_location_sync_status` CHECK (`status` IN ('PENDING', 'COMPLETED'))
) ENGINE=InnoDB;

-- 외부 requestId 형식과 겹치지 않는 내부 조정 행. 동기화 트랜잭션끼리만 직렬화한다.
INSERT INTO `agent_location_sync_execution`
    (`request_id`, `request_hash`, `status`, `added_content_ids`, `deleted_content_ids`)
VALUES ('__coordinator__', REPEAT('0', 64), 'PENDING', JSON_ARRAY(), JSON_ARRAY());
