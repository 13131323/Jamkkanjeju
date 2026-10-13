-- 홈 조회(GET /api/v2/users/me/home) 등 API를 직접 호출해 보기 위한 테스트용 데이터.
-- 1번 사용자(테스트 사용자)를 기준으로 요청 위치를 김녕 해수욕장 부근(위도 33.5572, 경도 126.7591)으로 두고 확인한다.
--   - 추천: 보물찾기 31(김녕)과 협동 36(월정리)은 1번 사용자가 완료했으므로 다음으로 가까운 미션이 추천된다.
--           35(월정리 보물찾기)와 40(김녕 협동)은 비활성이라 추천되지 않는다.
--   - 진행 중: 문화 1번(2/3), 보물찾기 33 성산일출봉(2/5), 협동 37 동문재래시장 팀(2단계)
--   - 방명록: 여러 사용자의 장소·길바닥 방명록 5건
-- 미션 유형과 역할 카드는 V2 데이터를 이름으로 찾아 연결한다.

-- ---------------------------------------------------------------------
-- 사용자
-- ---------------------------------------------------------------------

-- 1번 사용자에게 온보딩 결과(제주 사진작가)를 배정해 홈의 characterImgUrl을 확인할 수 있게 한다.
UPDATE `user`
SET `onboarding_result_id` = (SELECT `id` FROM `onboarding_result` WHERE `user_type` = '제주 사진작가' ORDER BY `id` LIMIT 1)
WHERE `id` = 1;

-- 협동 미션 팀원과 방명록 작성자로 쓰는 사용자. 비밀번호는 1번 사용자와 같다.
INSERT INTO `user`
    (`id`, `onboarding_result_id`, `nickname`, `email`, `password_hash`, `role`, `status`)
VALUES
    (2, NULL, '함께 걷는 친구', '22345678@gmail.com',
     '$2a$10$LpoZ46Wmj9cManptR.Vm4ORf63v6jMhsOku..H8TkD3swRmBKwacK', 'USER', 'ACTIVE'),
    (3, NULL, '바다 보는 여행자', '32345678@gmail.com',
     '$2a$10$LpoZ46Wmj9cManptR.Vm4ORf63v6jMhsOku..H8TkD3swRmBKwacK', 'USER', 'ACTIVE');

-- ---------------------------------------------------------------------
-- 장소
-- ---------------------------------------------------------------------

INSERT INTO `location`
    (`id`, `content_id`, `title`, `address`, `category`, `radius`, `latitude`, `longitude`)
VALUES
    (1, 990001, '김녕 해수욕장', '제주특별자치도 제주시 구좌읍 김녕리', '해변', 100, 33.5576, 126.7594),
    (2, 990002, '월정리 해변', '제주특별자치도 제주시 구좌읍 월정리', '해변', 100, 33.5563, 126.7958),
    (3, 990003, '만장굴', '제주특별자치도 제주시 구좌읍 만장굴길 182', '관광지', 100, 33.5284, 126.7716),
    (4, 990004, '성산일출봉', '제주특별자치도 서귀포시 성산읍 일출로 284-12', '관광지', 150, 33.4589, 126.9425),
    (5, 990005, '새별오름', '제주특별자치도 제주시 애월읍 봉성리 산59-8', '오름', 150, 33.3663, 126.3577),
    (6, 990006, '동문재래시장', '제주특별자치도 제주시 관덕로14길 20', '시장', 80, 33.5124, 126.5280),
    (7, 990007, '사려니숲길', '제주특별자치도 제주시 조천읍 교래리 산137-1', '숲길', 120, 33.4235, 126.6434),
    (8, 990008, '협재 해수욕장', '제주특별자치도 제주시 한림읍 협재리 2497-1', '해변', 100, 33.3940, 126.2397);

INSERT INTO `visited_location`
    (`id`, `user_id`, `location_id`, `last_visited_at`)
VALUES
    (1, 1, 1, '2026-10-01 11:00:00'),
    (2, 2, 6, '2026-10-02 15:30:00'),
    (3, 3, 4, '2026-10-03 07:10:00');

-- ---------------------------------------------------------------------
-- 보물찾기·협동 미션 (공통 MISSION 31 ~ 40)
-- ---------------------------------------------------------------------

INSERT INTO `mission` (`id`, `mission_type_id`)
VALUES
    (31, (SELECT `id` FROM `mission_type` WHERE `type` = 'TREASURE')),
    (32, (SELECT `id` FROM `mission_type` WHERE `type` = 'TREASURE')),
    (33, (SELECT `id` FROM `mission_type` WHERE `type` = 'TREASURE')),
    (34, (SELECT `id` FROM `mission_type` WHERE `type` = 'TREASURE')),
    (35, (SELECT `id` FROM `mission_type` WHERE `type` = 'TREASURE')),
    (36, (SELECT `id` FROM `mission_type` WHERE `type` = 'COOPERATIVE')),
    (37, (SELECT `id` FROM `mission_type` WHERE `type` = 'COOPERATIVE')),
    (38, (SELECT `id` FROM `mission_type` WHERE `type` = 'COOPERATIVE')),
    (39, (SELECT `id` FROM `mission_type` WHERE `type` = 'COOPERATIVE')),
    (40, (SELECT `id` FROM `mission_type` WHERE `type` = 'COOPERATIVE'));

INSERT INTO `treasure_mission`
    (`mission_id`, `location_id`, `item_total_count`, `status`, `ar_character_id`, `point`, `coupon_id`)
VALUES
    (31, 1, 3, 'ACTIVE', NULL, 100, NULL),
    (32, 3, 4, 'ACTIVE', NULL, 150, NULL),
    (33, 4, 5, 'ACTIVE', NULL, 200, NULL),
    (34, 5, 3, 'ACTIVE', NULL, 120, NULL),
    (35, 2, 3, 'INACTIVE', NULL, 100, NULL);

INSERT INTO `cooperative_mission`
    (`mission_id`, `location_id`, `status`, `ar_character_id`, `point`, `coupon_id`)
VALUES
    (36, 2, 'ACTIVE', NULL, 200, NULL),
    (37, 6, 'ACTIVE', NULL, 200, NULL),
    (38, 7, 'ACTIVE', NULL, 250, NULL),
    (39, 8, 'ACTIVE', NULL, 200, NULL),
    (40, 1, 'INACTIVE', NULL, 200, NULL);

-- ---------------------------------------------------------------------
-- 문화 미션 진행
-- ---------------------------------------------------------------------

-- 1번 사용자: 문화 1번 진행 중(2번째 퀴즈), 문화 2번 완료
INSERT INTO `culture_mission_progress`
    (`id`, `culture_mission_id`, `user_id`, `mission_status`, `current_quiz_index`, `correct_count`, `last_completed_at`)
VALUES
    (1, 1, 1, 'IN_PROGRESS', 2, 1, NULL),
    (2, 2, 1, 'COMPLETED', 3, 3, '2026-09-30 18:00:00');

-- ---------------------------------------------------------------------
-- 보물찾기 진행
-- ---------------------------------------------------------------------

-- 1번 사용자: 김녕(31) 완료, 성산일출봉(33) 5개 중 2개 발견
-- 2번 사용자: 만장굴(32) 완료 (1번 사용자의 추천에는 영향 없음)
INSERT INTO `treasure_mission_progress`
    (`id`, `treasure_mission_id`, `user_id`, `found_item_count`, `mission_status`, `completed_at`)
VALUES
    (1, 31, 1, 3, 'COMPLETED', '2026-10-01 11:40:00'),
    (2, 33, 1, 2, 'IN_PROGRESS', NULL),
    (3, 32, 2, 4, 'COMPLETED', '2026-10-02 10:20:00');

INSERT INTO `treasure_mission_progress_item`
    (`treasure_mission_progress_id`, `item_index`, `item_status`, `found_at`)
VALUES
    (1, 1, 'FOUND', '2026-10-01 11:15:00'),
    (1, 2, 'FOUND', '2026-10-01 11:25:00'),
    (1, 3, 'FOUND', '2026-10-01 11:40:00'),
    (2, 1, 'FOUND', '2026-10-05 09:10:00'),
    (2, 2, 'FOUND', '2026-10-05 09:30:00'),
    (2, 3, 'UNFOUND', NULL),
    (2, 4, 'UNFOUND', NULL),
    (2, 5, 'UNFOUND', NULL),
    (3, 1, 'FOUND', '2026-10-02 09:40:00'),
    (3, 2, 'FOUND', '2026-10-02 09:55:00'),
    (3, 3, 'FOUND', '2026-10-02 10:05:00'),
    (3, 4, 'FOUND', '2026-10-02 10:20:00');

-- ---------------------------------------------------------------------
-- 협동 미션 진행
-- ---------------------------------------------------------------------

-- 팀 1: 월정리(36) 완료 팀 (1번 HOST, 2번 MEMBER)
-- 팀 2: 동문재래시장(37) 2단계 진행 중 팀 (1번 HOST, 2번 MEMBER, 3번 초대 대기)
INSERT INTO `cooperative_mission_progress`
    (`id`, `cooperative_mission_id`, `current_step`, `mission_status`, `team_token`, `completed_at`)
VALUES
    (1, 36, 3, 'COMPLETED', 'mock-team-0001', '2026-09-28 16:00:00'),
    (2, 37, 2, 'IN_PROGRESS', 'mock-team-0002', NULL);

INSERT INTO `cooperative_mission_participant`
    (`id`, `cooperative_mission_progress_id`, `user_id`, `participant_status`, `participant_role`, `joined_at`)
VALUES
    (1, 1, 1, 'ACCEPTED', 'HOST', '2026-09-28 14:00:00'),
    (2, 1, 2, 'ACCEPTED', 'MEMBER', '2026-09-28 14:05:00'),
    (3, 2, 1, 'ACCEPTED', 'HOST', '2026-10-06 13:00:00'),
    (4, 2, 2, 'ACCEPTED', 'MEMBER', '2026-10-06 13:03:00'),
    (5, 2, 3, 'PENDING', 'MEMBER', NULL);

-- 1번 사용자는 진행 중인 팀에서 역할을 두 개 맡아, 홈 진행 목록에서 팀이 한 번만 나오는지 확인할 수 있다.
INSERT INTO `cooperative_mission_role_progress`
    (`cooperative_mission_participant_id`, `cooperative_role_card_id`, `item_img_url`, `progress_status`, `completed_at`)
VALUES
    (1, (SELECT `id` FROM `cooperative_role_card` WHERE `role_name` = '땅지기'), NULL, 'COMPLETED', '2026-09-28 15:00:00'),
    (2, (SELECT `id` FROM `cooperative_role_card` WHERE `role_name` = '물지기'), NULL, 'COMPLETED', '2026-09-28 15:20:00'),
    (3, (SELECT `id` FROM `cooperative_role_card` WHERE `role_name` = '빛지기'), NULL, 'COMPLETED', '2026-10-06 13:40:00'),
    (3, (SELECT `id` FROM `cooperative_role_card` WHERE `role_name` = '바람지기'), NULL, 'IN_PROGRESS', NULL),
    (4, (SELECT `id` FROM `cooperative_role_card` WHERE `role_name` = '이웃지기'), NULL, 'IN_PROGRESS', NULL);

-- ---------------------------------------------------------------------
-- 방명록 (장소 방명록 3건, 길바닥 방명록 2건)
-- ---------------------------------------------------------------------

INSERT INTO `guestbook`
    (`id`, `user_id`, `visited_at`, `content_img_url`, `content_writing`, `content_audio_url`, `audio_title`,
     `content_weather`, `content_temperature_celsius`, `content_color_code`, `saved_at`, `status`)
VALUES
    (1, 1, '2026-10-01', NULL, '김녕 바다에서 보물을 다 찾았다!', NULL, NULL, '맑음', 22.5, '#4FC3F7',
     '2026-10-01 12:00:00', 'ACTIVE'),
    (2, 1, '2026-10-04', NULL, '돌담길 따라 걷다가 쉬어 간 곳', NULL, NULL, '흐림', 19.0, '#A5D6A7',
     '2026-10-04 17:30:00', 'ACTIVE'),
    (3, 2, '2026-10-02', NULL, '시장 귤이 정말 달았다', NULL, NULL, '맑음', 23.0, '#FFB74D',
     '2026-10-02 16:00:00', 'ACTIVE'),
    (4, 3, '2026-10-03', NULL, '성산일출봉 일출 성공', NULL, NULL, '맑음', 15.5, '#FF8A65',
     '2026-10-03 07:30:00', 'ACTIVE'),
    (5, 3, '2026-10-03', NULL, '바람 많이 부는 해안도로', NULL, NULL, '바람', 17.0, '#90A4AE',
     '2026-10-03 10:10:00', 'ACTIVE');

INSERT INTO `location_guestbook` (`guestbook_id`, `visited_location_id`, `mission_id`)
VALUES
    (1, 1, 31),
    (3, 2, 37),
    (4, 3, NULL);

INSERT INTO `road_guestbook` (`guestbook_id`, `location_alias`, `latitude`, `longitude`)
VALUES
    (2, '종달리 돌담길', 33.4950, 126.8970),
    (5, '애월 해안도로', 33.4630, 126.3100);
