-- ---------------------------------------------------------------------
-- 온보딩 / 사용자
-- ---------------------------------------------------------------------

CREATE TABLE `onboarding_result` (
    `id`               BIGINT       NOT NULL AUTO_INCREMENT,
    `user_type`        VARCHAR(20)  NOT NULL,
    `type_description` VARCHAR(200) NOT NULL,
    `hashtags`         JSON         NOT NULL COMMENT 'string[]',
    `profile_img_url`  VARCHAR(500) NOT NULL,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_onboarding_result_hashtags_schema`
        CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"type":"string"}}', `hashtags`))
) ENGINE = InnoDB;

CREATE TABLE `user` (
    `id`                   BIGINT      NOT NULL AUTO_INCREMENT,
    `onboarding_result_id` BIGINT      NOT NULL,
    `nickname`             VARCHAR(20) NULL,
    `point`                INT         NOT NULL DEFAULT 0,
    `target_step`          INT         NOT NULL DEFAULT 10000,
    `access_token_hash`    CHAR(64)    NOT NULL,
    `created_at`           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_access_token_hash` (`access_token_hash`),
    CONSTRAINT `chk_user_point_nonnegative`
        CHECK (`point` >= 0),
    CONSTRAINT `chk_user_target_step_nonnegative`
        CHECK (`target_step` >= 0),
    CONSTRAINT `fk_user_onboarding_result`
        FOREIGN KEY (`onboarding_result_id`) REFERENCES `onboarding_result` (`id`)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE `expectation` (
    `id`               BIGINT      NOT NULL AUTO_INCREMENT,
    `expectation_type` VARCHAR(20) NOT NULL,
    `created_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_expectation_type` (`expectation_type`)
) ENGINE = InnoDB;

CREATE TABLE `transportation` (
    `id`                  BIGINT      NOT NULL AUTO_INCREMENT,
    `transportation_type` VARCHAR(20) NOT NULL,
    `created_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_transportation_type` (`transportation_type`)
) ENGINE = InnoDB;

CREATE TABLE `travel_style` (
    `id`                BIGINT      NOT NULL AUTO_INCREMENT,
    `travel_style_type` VARCHAR(20) NOT NULL,
    `created_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_travel_style_type` (`travel_style_type`)
) ENGINE = InnoDB;

CREATE TABLE `user_expectation` (
    `user_id`        BIGINT   NOT NULL,
    `expectation_id` BIGINT   NOT NULL,
    `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `expectation_id`),
    CONSTRAINT `fk_user_expectation_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE ,
    CONSTRAINT `fk_user_expectation_expectation`
        FOREIGN KEY (`expectation_id`) REFERENCES `expectation` (`id`)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE `user_transportation` (
    `user_id`           BIGINT   NOT NULL,
    `transportation_id` BIGINT   NOT NULL,
    `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_user_transportation_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_user_transportation_transportation`
        FOREIGN KEY (`transportation_id`) REFERENCES `transportation` (`id`)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE `user_travel_style` (
    `user_id`         BIGINT   NOT NULL,
    `travel_style_id` BIGINT   NOT NULL,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_user_travel_style_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_user_travel_style_travel_style`
        FOREIGN KEY (`travel_style_id`) REFERENCES `travel_style` (`id`)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE `user_setting` (
    `user_id`                   BIGINT   NOT NULL,
    `push_notification`         BOOLEAN  NOT NULL DEFAULT TRUE,
    `near_mission_notification` BOOLEAN  NOT NULL DEFAULT TRUE,
    `created_at`                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_user_setting_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `step_reward` (
    `user_id`     BIGINT   NOT NULL,
    `reward_date` DATE     NOT NULL,
    `rewarded_at` DATETIME NOT NULL,
    `steps_count` INT      NOT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `reward_date`),
    CONSTRAINT `chk_step_reward_steps_count_nonnegative`
        CHECK (`steps_count` >= 0),
    CONSTRAINT `fk_step_reward_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `gps` (
    `id`         BIGINT   NOT NULL AUTO_INCREMENT,
    `user_id`    BIGINT   NOT NULL,
    `latitude`   DOUBLE   NOT NULL,
    `longitude`  DOUBLE   NOT NULL,
    `saved_at`   DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_gps_latitude_range`
        CHECK (`latitude` BETWEEN -90 AND 90),
    CONSTRAINT `chk_gps_longitude_range`
        CHECK (`longitude` BETWEEN -180 AND 180),
    CONSTRAINT `fk_gps_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 장소 / 쿠폰 / AR 캐릭터
-- ---------------------------------------------------------------------

CREATE TABLE `location` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `content_id` BIGINT       NOT NULL,
    `title`      VARCHAR(100) NOT NULL,
    `address`    VARCHAR(255) NOT NULL,
    `category`   VARCHAR(20)  NOT NULL,
    `radius`     INT          NOT NULL,
    `latitude`   DOUBLE       NOT NULL,
    `longitude`  DOUBLE       NOT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_location_content_id` (`content_id`),
    CONSTRAINT `chk_location_radius_nonnegative`
        CHECK (`radius` >= 0),
    CONSTRAINT `chk_location_latitude_range`
        CHECK (`latitude` BETWEEN -90 AND 90),
    CONSTRAINT `chk_location_longitude_range`
        CHECK (`longitude` BETWEEN -180 AND 180)
) ENGINE = InnoDB;

CREATE TABLE `visited_location` (
    `id`              BIGINT   NOT NULL AUTO_INCREMENT,
    `user_id`         BIGINT   NOT NULL,
    `location_id`     BIGINT   NOT NULL,
    `last_visited_at` DATETIME NOT NULL,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_visited_location_user_location` (`user_id`, `location_id`),
    CONSTRAINT `fk_visited_location_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_visited_location_location`
        FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `coupon` (
    `id`           BIGINT   NOT NULL AUTO_INCREMENT,
    `location_id`  BIGINT   NULL,
    `coupon_price` INT      NOT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_coupon_price_nonnegative`
        CHECK (`coupon_price` >= 0),
    CONSTRAINT `fk_coupon_location`
        FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `acquired_coupon` (
    `coupon_id`   BIGINT   NOT NULL,
    `user_id`     BIGINT   NOT NULL,
    `acquired_at` DATETIME NOT NULL,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`coupon_id`, `user_id`),
    CONSTRAINT `fk_acquired_coupon_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_acquired_coupon_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `ar_character` (
    `id`                   BIGINT       NOT NULL AUTO_INCREMENT,
    `name`                 VARCHAR(50)  NOT NULL,
    `description`          VARCHAR(200) NOT NULL,
    `story_title`          VARCHAR(200) NOT NULL,
    `acquire_condition`    VARCHAR(200) NOT NULL,
    `img_url`              VARCHAR(500) NOT NULL,
    `representative_color` VARCHAR(20)  NOT NULL,
    `hashtags`             JSON         NOT NULL COMMENT 'string[]',
    `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_ar_character_hashtags_schema`
        CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"type":"string"}}', `hashtags`))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 미션 공통
-- ---------------------------------------------------------------------

CREATE TABLE `mission_type` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `type`        VARCHAR(50)  NOT NULL COMMENT 'CULTURE, COOPERATIVE, TREASURE',
    `title`       VARCHAR(50)  NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `steps`       JSON         NOT NULL COMMENT '{step: int, step_title: string, description: string}[]',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_mission_type_type` (`type`),
    CONSTRAINT `chk_mission_type_type_enum`
        CHECK (`type` IN ('CULTURE', 'COOPERATIVE', 'TREASURE')),
    CONSTRAINT `chk_mission_type_steps_schema`
        CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"type":"object","required":["step","step_title","description"],"properties":{"step":{"type":"integer"},"step_title":{"type":"string"},"description":{"type":"string"}},"additionalProperties":false}}', `steps`))
) ENGINE = InnoDB;

CREATE TABLE `mission` (
    `id`              BIGINT   NOT NULL AUTO_INCREMENT,
    `mission_type_id` BIGINT   NOT NULL,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_mission_mission_type`
        FOREIGN KEY (`mission_type_id`) REFERENCES `mission_type` (`id`)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 문화 미션
-- ---------------------------------------------------------------------

CREATE TABLE `culture_mission` (
    `mission_id`      BIGINT      NOT NULL,
    `status`          VARCHAR(20) NOT NULL COMMENT 'ACTIVE, INACTIVE',
    `ar_character_id` BIGINT      NULL,
    `point`           INT         NULL,
    `coupon_id`       BIGINT      NULL,
    `created_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`mission_id`),
    CONSTRAINT `chk_culture_mission_status_enum`
        CHECK (`status` IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT `chk_culture_mission_point_nonnegative`
        CHECK (`point` IS NULL OR `point` >= 0),
    CONSTRAINT `fk_culture_mission_mission`
        FOREIGN KEY (`mission_id`) REFERENCES `mission` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_culture_mission_ar_character`
        FOREIGN KEY (`ar_character_id`) REFERENCES `ar_character` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_culture_mission_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `culture_mission_quiz` (
    `culture_mission_id` BIGINT       NOT NULL,
    `quiz_index`         INT          NOT NULL,
    `img_url`            VARCHAR(500) NULL,
    `question`           VARCHAR(500) NOT NULL,
    `options`            JSON         NULL COMMENT 'string[]',
    `answer`             VARCHAR(500) NOT NULL,
    `hint`               VARCHAR(500) NULL,
    `explanation`        VARCHAR(500) NULL,
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`culture_mission_id`, `quiz_index`),
    CONSTRAINT `chk_culture_mission_quiz_index_nonnegative`
        CHECK (`quiz_index` >= 0),
    CONSTRAINT `chk_culture_mission_quiz_options_schema`
        CHECK (`options` IS NULL OR JSON_SCHEMA_VALID('{"type":"array","items":{"type":"string"}}', `options`)),
    CONSTRAINT `fk_culture_mission_quiz_culture_mission`
        FOREIGN KEY (`culture_mission_id`) REFERENCES `culture_mission` (`mission_id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `culture_mission_reward_status` (
    `user_id`                     BIGINT   NOT NULL,
    `culture_mission_id`          BIGINT   NOT NULL,
    `ar_character_reward_granted` BOOLEAN  NOT NULL DEFAULT FALSE,
    `point_reward_granted`        BOOLEAN  NOT NULL DEFAULT FALSE,
    `coupon_reward_granted`       BOOLEAN  NOT NULL DEFAULT FALSE,
    `created_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `culture_mission_id`),
    CONSTRAINT `fk_culture_mission_reward_status_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_culture_mission_reward_status_culture_mission`
        FOREIGN KEY (`culture_mission_id`) REFERENCES `culture_mission` (`mission_id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `culture_mission_progress` (
    `id`                 BIGINT      NOT NULL AUTO_INCREMENT,
    `culture_mission_id` BIGINT      NOT NULL,
    `user_id`            BIGINT      NOT NULL,
    `mission_status`     VARCHAR(20) NOT NULL COMMENT 'IN_PROGRESS, COMPLETED',
    `current_quiz_index` INT         NOT NULL DEFAULT 1,
    `correct_count`      INT         NOT NULL DEFAULT 0,
    `last_completed_at`  DATETIME    NULL,
    `created_at`         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_culture_mission_progress_mission_user` (`culture_mission_id`, `user_id`),
    CONSTRAINT `chk_culture_mission_progress_status_enum`
        CHECK (`mission_status` IN ('IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT `chk_culture_mission_progress_quiz_index_nonnegative`
        CHECK (`current_quiz_index` >= 0),
    CONSTRAINT `chk_culture_mission_progress_correct_count_nonnegative`
        CHECK (`correct_count` >= 0),
    CONSTRAINT `fk_culture_mission_progress_culture_mission`
        FOREIGN KEY (`culture_mission_id`) REFERENCES `culture_mission` (`mission_id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_culture_mission_progress_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 협동 미션
-- ---------------------------------------------------------------------

CREATE TABLE `cooperative_mission` (
    `mission_id`      BIGINT      NOT NULL,
    `location_id`     BIGINT      NULL,
    `status`          VARCHAR(20) NOT NULL COMMENT 'ACTIVE, INACTIVE',
    `ar_character_id` BIGINT      NULL,
    `point`           INT         NULL,
    `coupon_id`       BIGINT      NULL,
    `created_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`mission_id`),
    CONSTRAINT `chk_cooperative_mission_status_enum`
        CHECK (`status` IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT `chk_cooperative_mission_point_nonnegative`
        CHECK (`point` IS NULL OR `point` >= 0),
    CONSTRAINT `fk_cooperative_mission_mission`
        FOREIGN KEY (`mission_id`) REFERENCES `mission` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_cooperative_mission_location`
        FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_cooperative_mission_ar_character`
        FOREIGN KEY (`ar_character_id`) REFERENCES `ar_character` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_cooperative_mission_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `cooperative_mission_reward_status` (
    `cooperative_mission_id`      BIGINT   NOT NULL,
    `user_id`                     BIGINT   NOT NULL,
    `ar_character_reward_granted` BOOLEAN  NOT NULL DEFAULT FALSE,
    `point_reward_granted`        BOOLEAN  NOT NULL DEFAULT FALSE,
    `coupon_reward_granted`       BOOLEAN  NOT NULL DEFAULT FALSE,
    `created_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`cooperative_mission_id`, `user_id`),
    CONSTRAINT `fk_cooperative_mission_reward_status_cooperative_mission`
        FOREIGN KEY (`cooperative_mission_id`) REFERENCES `cooperative_mission` (`mission_id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_cooperative_mission_reward_status_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `cooperative_mission_progress` (
    `id`                     BIGINT       NOT NULL AUTO_INCREMENT,
    `cooperative_mission_id` BIGINT       NOT NULL,
    `current_step`           INT          NOT NULL DEFAULT 1 COMMENT '1, 2, 3',
    `mission_status`         VARCHAR(20)  NOT NULL COMMENT 'IN_PROGRESS, COMPLETED',
    `team_token`             VARCHAR(100) NOT NULL,
    `completed_at`           DATETIME     NULL,
    `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cooperative_mission_progress_team_token` (`team_token`),
    CONSTRAINT `chk_cooperative_mission_progress_current_step_enum`
        CHECK (`current_step` IN (1, 2, 3)),
    CONSTRAINT `chk_cooperative_mission_progress_status_enum`
        CHECK (`mission_status` IN ('IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT `fk_cooperative_mission_progress_cooperative_mission`
        FOREIGN KEY (`cooperative_mission_id`) REFERENCES `cooperative_mission` (`mission_id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `cooperative_role_card` (
    `id`               BIGINT       NOT NULL AUTO_INCREMENT,
    `role_name`        VARCHAR(20)  NOT NULL,
    `role_description` VARCHAR(200) NOT NULL,
    `location_to_find` JSON         NOT NULL COMMENT 'string[]',
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_cooperative_role_card_location_schema`
        CHECK (JSON_SCHEMA_VALID('{"type":"array","items":{"type":"string"}}', `location_to_find`))
) ENGINE = InnoDB;

CREATE TABLE `cooperative_mission_participant` (
    `id`                              BIGINT      NOT NULL AUTO_INCREMENT,
    `cooperative_mission_progress_id` BIGINT      NOT NULL,
    `user_id`                         BIGINT      NOT NULL,
    `participant_status`              VARCHAR(20) NOT NULL COMMENT 'PENDING, ACCEPTED',
    `participant_role`                VARCHAR(20) NOT NULL COMMENT 'HOST, MEMBER',
    `joined_at`                       DATETIME    NULL,
    `created_at`                      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_cooperative_mission_participant_progress_user` (`cooperative_mission_progress_id`, `user_id`),
    CONSTRAINT `chk_cooperative_mission_participant_status_enum`
        CHECK (`participant_status` IN ('PENDING', 'ACCEPTED')),
    CONSTRAINT `chk_cooperative_mission_participant_role_enum`
        CHECK (`participant_role` IN ('HOST', 'MEMBER')),
    CONSTRAINT `fk_cooperative_mission_participant_progress`
        FOREIGN KEY (`cooperative_mission_progress_id`) REFERENCES `cooperative_mission_progress` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_cooperative_mission_participant_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `cooperative_mission_role_progress` (
    `cooperative_mission_participant_id` BIGINT       NOT NULL,
    `cooperative_role_card_id`           BIGINT       NOT NULL,
    `item_img_url`                       VARCHAR(500) NULL,
    `progress_status`                    VARCHAR(20)  NOT NULL COMMENT 'IN_PROGRESS, COMPLETED',
    `completed_at`                       DATETIME     NULL,
    `created_at`                         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`cooperative_mission_participant_id`, `cooperative_role_card_id`),
    CONSTRAINT `chk_cooperative_mission_role_progress_status_enum`
        CHECK (`progress_status` IN ('IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT `fk_cooperative_mission_role_progress_participant`
        FOREIGN KEY (`cooperative_mission_participant_id`) REFERENCES `cooperative_mission_participant` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_cooperative_mission_role_progress_role_card`
        FOREIGN KEY (`cooperative_role_card_id`) REFERENCES `cooperative_role_card` (`id`)
        ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 보물찾기 미션
-- ---------------------------------------------------------------------

CREATE TABLE `treasure_mission` (
    `mission_id`       BIGINT      NOT NULL,
    `location_id`      BIGINT      NULL,
    `item_total_count` INT         NOT NULL,
    `status`           VARCHAR(20) NOT NULL COMMENT 'ACTIVE, INACTIVE',
    `ar_character_id`  BIGINT      NULL,
    `point`            INT         NULL,
    `coupon_id`        BIGINT      NULL,
    `created_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`mission_id`),
    CONSTRAINT `chk_treasure_mission_item_total_count_nonnegative`
        CHECK (`item_total_count` >= 0),
    CONSTRAINT `chk_treasure_mission_status_enum`
        CHECK (`status` IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT `chk_treasure_mission_point_nonnegative`
        CHECK (`point` IS NULL OR `point` >= 0),
    CONSTRAINT `fk_treasure_mission_mission`
        FOREIGN KEY (`mission_id`) REFERENCES `mission` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_treasure_mission_location`
        FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_treasure_mission_ar_character`
        FOREIGN KEY (`ar_character_id`) REFERENCES `ar_character` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_treasure_mission_coupon`
        FOREIGN KEY (`coupon_id`) REFERENCES `coupon` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `treasure_mission_reward_status` (
    `treasure_mission_id`         BIGINT   NOT NULL,
    `user_id`                     BIGINT   NOT NULL,
    `ar_character_reward_granted` BOOLEAN  NOT NULL DEFAULT FALSE,
    `point_reward_granted`        BOOLEAN  NOT NULL DEFAULT FALSE,
    `coupon_reward_granted`       BOOLEAN  NOT NULL DEFAULT FALSE,
    `created_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`treasure_mission_id`, `user_id`),
    CONSTRAINT `fk_treasure_mission_reward_status_treasure_mission`
        FOREIGN KEY (`treasure_mission_id`) REFERENCES `treasure_mission` (`mission_id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_treasure_mission_reward_status_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `treasure_mission_progress` (
    `id`                  BIGINT      NOT NULL AUTO_INCREMENT,
    `treasure_mission_id` BIGINT      NOT NULL,
    `user_id`             BIGINT      NOT NULL,
    `found_item_count`    INT         NOT NULL DEFAULT 0,
    `mission_status`      VARCHAR(20) NOT NULL COMMENT 'IN_PROGRESS, COMPLETED',
    `completed_at`        DATETIME    NULL,
    `created_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_treasure_mission_progress_mission_user` (`treasure_mission_id`, `user_id`),
    CONSTRAINT `chk_treasure_mission_progress_found_count_nonnegative`
        CHECK (`found_item_count` >= 0),
    CONSTRAINT `chk_treasure_mission_progress_status_enum`
        CHECK (`mission_status` IN ('IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT `fk_treasure_mission_progress_treasure_mission`
        FOREIGN KEY (`treasure_mission_id`) REFERENCES `treasure_mission` (`mission_id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_treasure_mission_progress_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `treasure_mission_progress_item` (
    `treasure_mission_progress_id` BIGINT      NOT NULL,
    `item_index`                   INT         NOT NULL,
    `item_status`                  VARCHAR(20) NOT NULL COMMENT 'UNFOUND, FOUND',
    `found_at`                     DATETIME    NULL,
    `created_at`                   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`treasure_mission_progress_id`, `item_index`),
    CONSTRAINT `chk_treasure_mission_progress_item_index_nonnegative`
        CHECK (`item_index` >= 0),
    CONSTRAINT `chk_treasure_mission_progress_item_status_enum`
        CHECK (`item_status` IN ('UNFOUND', 'FOUND')),
    CONSTRAINT `fk_treasure_mission_progress_item_progress`
        FOREIGN KEY (`treasure_mission_progress_id`) REFERENCES `treasure_mission_progress` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 방명록
-- ---------------------------------------------------------------------

CREATE TABLE `guestbook` (
    `id`                          BIGINT       NOT NULL AUTO_INCREMENT,
    `user_id`                     BIGINT       NULL,
    `visited_at`                  DATE         NOT NULL,
    `content_img_url`             VARCHAR(500) NULL,
    `content_writing`             VARCHAR(500) NULL,
    `content_audio_url`           VARCHAR(500) NULL,
    `audio_title`                 VARCHAR(50)  NULL,
    `content_weather`             VARCHAR(20)  NULL,
    `content_temperature_celsius` DECIMAL(4,1) NULL,
    `content_color_code`          VARCHAR(20)  NULL,
    `saved_at`                    DATETIME     NOT NULL,
    `status`                      VARCHAR(20)  NOT NULL,
    `created_at`                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_guestbook_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `location_guestbook` (
    `guestbook_id`        BIGINT   NOT NULL,
    `visited_location_id` BIGINT   NULL,
    `mission_id`          BIGINT   NULL,
    `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`guestbook_id`),
    CONSTRAINT `fk_location_guestbook_guestbook`
        FOREIGN KEY (`guestbook_id`) REFERENCES `guestbook` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_location_guestbook_visited_location`
        FOREIGN KEY (`visited_location_id`) REFERENCES `visited_location` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_location_guestbook_mission`
        FOREIGN KEY (`mission_id`) REFERENCES `mission` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `road_guestbook` (
    `guestbook_id`   BIGINT       NOT NULL,
    `location_alias` VARCHAR(100) NOT NULL,
    `latitude`       DOUBLE       NOT NULL,
    `longitude`      DOUBLE       NOT NULL,
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`guestbook_id`),
    CONSTRAINT `chk_road_guestbook_latitude_range`
        CHECK (`latitude` BETWEEN -90 AND 90),
    CONSTRAINT `chk_road_guestbook_longitude_range`
        CHECK (`longitude` BETWEEN -180 AND 180),
    CONSTRAINT `fk_road_guestbook_guestbook`
        FOREIGN KEY (`guestbook_id`) REFERENCES `guestbook` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- 미션/방명록 하위 테이블의 수정이 발생하면 guestbook.updated_at을 현재 시간으로 갱신하는 트리거
CREATE TRIGGER `trg_location_guestbook_after_update`
    AFTER UPDATE ON `location_guestbook`
    FOR EACH ROW
    UPDATE `guestbook`
       SET `updated_at` = CURRENT_TIMESTAMP
     WHERE `id` = NEW.`guestbook_id`;

CREATE TRIGGER `trg_road_guestbook_after_update`
    AFTER UPDATE ON `road_guestbook`
    FOR EACH ROW
    UPDATE `guestbook`
       SET `updated_at` = CURRENT_TIMESTAMP
     WHERE `id` = NEW.`guestbook_id`;

CREATE TABLE `guestbook_like` (
    `guestbook_id` BIGINT   NOT NULL,
    `user_id`      BIGINT   NOT NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`guestbook_id`, `user_id`),
    CONSTRAINT `fk_guestbook_like_guestbook`
        FOREIGN KEY (`guestbook_id`) REFERENCES `guestbook` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_guestbook_like_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 획득 캐릭터 / 여행 기록
-- ---------------------------------------------------------------------

CREATE TABLE `acquired_ar_character` (
    `id`              BIGINT   NOT NULL AUTO_INCREMENT,
    `ar_character_id` BIGINT   NOT NULL,
    `user_id`         BIGINT   NOT NULL,
    `mission_id`      BIGINT   NULL,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_acquired_ar_character_mission_user` (`mission_id`, `user_id`),
    CONSTRAINT `fk_acquired_ar_character_ar_character`
        FOREIGN KEY (`ar_character_id`) REFERENCES `ar_character` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_acquired_ar_character_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_acquired_ar_character_mission`
        FOREIGN KEY (`mission_id`) REFERENCES `mission` (`id`)
        ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE `travel_ending_content` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `user_id`    BIGINT       NULL,
    `image_url`  VARCHAR(500) NOT NULL,
    `saved_at`   DATETIME     NOT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_travel_ending_content_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE `picture_with_character` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `user_id`     BIGINT       NULL,
    `picture_url` VARCHAR(500) NOT NULL,
    `saved_at`    DATETIME     NOT NULL,
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_picture_with_character_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
        ON DELETE CASCADE
) ENGINE = InnoDB;
