-- 점검 공지와 예약 일정을 보관한다. 시각은 기존 정책과 동일한 KST DATETIME이다.
CREATE TABLE `maintenance` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `message`    VARCHAR(500) NOT NULL,
    `starts_at`  DATETIME     NOT NULL,
    `ends_at`    DATETIME     NOT NULL,
    `status`     VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_maintenance_status_starts_at` (`status`, `starts_at`),
    CONSTRAINT `chk_maintenance_status_enum`
        CHECK (`status` IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')),
    CONSTRAINT `chk_maintenance_period`
        CHECK (`ends_at` > `starts_at`)
) ENGINE = InnoDB;
