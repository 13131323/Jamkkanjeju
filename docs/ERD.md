```mermaid
erDiagram
USER {
	bigint id PK "NOT NULL"
	bigint onboarding_result_id FK "NULL"
	varchar_20 nickname
	int point "NOT NULL, DEFAULT: 0"
	int target_step "NOT NULL, DEFAULT: 10000"
	char_64 access_token_hash UK "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	
	UNIQUE(access_token_hash)
}

EXPECTATION {
    bigint id PK "NOT NULL"
    varchar_20 expectation_type "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (expectation_type)
}

TRANSPORTATION {
    bigint id PK "NOT NULL"
    varchar_20 transportation_type "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (transportation_type)
}

TRAVEL_STYLE {
    bigint id PK "NOT NULL"
    varchar_20 travel_style_type "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (travel_style_type)
}

USER_EXPECTATION {
    bigint user_id PK, FK "NOT NULL"
    bigint expectation_id PK, FK "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

USER_TRANSPORTATION {
    bigint user_id PK, FK "NOT NULL"
    bigint transportation_id FK "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

USER_TRAVEL_STYLE {
    bigint user_id PK, FK "NOT NULL"
    bigint travel_style_id FK "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

ONBOARDING_RESULT {
	bigint id PK "NOT NULL"
	varchar_20 user_type "NOT NULL"
	varchar_200 type_description "NOT NULL"
	json hashtags "NOT NULL, json: string[]"
	varchar_500 profile_img_url "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

USER_SETTING {
	bigint user_id PK, FK "NOT NULL"
	boolean push_notification "NOT NULL, DEFAULT: TRUE"
	boolean near_mission_notification "NOT NULL, DEFAULT: TRUE"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

STEP_REWARD {
	bigint user_id PK, FK "NOT NULL"
	date reward_date PK "NOT NULL"
	datetime rewarded_at "NOT NULL"
	int steps_count "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

MISSION_TYPE {
	bigint id PK "NOT NULL"
	varchar_50 type "NOT NULL, Enum: CULTURE, COOPERATIVE, TREASURE"
	varchar_50 title "NOT NULL"
	varchar_200 description "NOT NULL"
	json steps "NOT NULL, json: {step: int, step_title: string, description: string}"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	
    UNIQUE(type)
}

MISSION {
    bigint id PK "NOT NULL"
    bigint mission_type_id FK "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

LOCATION {
	bigint id PK "NOT NULL"
	bigint content_id "NOT NULL"
	varchar_100 title "NOT NULL"
	varchar_255 address "NOT NULL"
	varchar_20 category "NOT NULL"
	int radius "NOT NULL"
	double latitude "NOT NULL"
	double longitude "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	
	UNIQUE(content_id)
}

VISITED_LOCATION {
	bigint user_id PK, FK "NOT NULL"
	bigint location_id PK, FK "NOT NULL"
	datetime last_visited_at "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

COUPON {
   	bigint id PK "NOT NULL"
   	bigint location_id FK
   	int coupon_price "NOT NULL"
   	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

ACQUIRED_COUPON {
    bigint coupon_id PK, FK "NOT NULL"
    bigint user_id PK, FK "NOT NULL"
    datetime acquired_at "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

GPS {
	bigint id PK "NOT NULL"
	bigint user_id FK "NOT NULL"
	double latitude "NOT NULL"
	double longitude "NOT NULL"
	datetime saved_at "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

CULTURE_MISSION {
	bigint mission_id PK, FK "NOT NULL"
	varchar_20 status "NOT NULL, Enum: ACTIVE, INACTIVE"
	bigint ar_character_id FK
	int point
	bigint coupon_id FK
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

CULTURE_MISSION_QUIZ {
    bigint culture_mission_id PK, FK "NOT NULL"
    int quiz_index PK "NOT NULL"
    varchar_500 img_url
    varchar_500 question "NOT NULL"
    json options "json: string[]"
    varchar_500 answer "NOT NULL"
    varchar_500 hint
    varchar_500 explanation
}

CULTURE_MISSION_REWARD_STATUS {
    bigint user_id PK, FK "NOT NULL"
    bigint culture_mission_id PK, FK "NOT NULL"
    boolean ar_character_reward_granted "NOT NULL, DEFAULT: FALSE"
    boolean point_reward_granted "NOT NULL, DEFAULT: FALSE"
    boolean coupon_reward_granted "NOT NULL, DEFAULT: FALSE"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

CULTURE_MISSION_PROGRESS {
    bigint id PK "NOT NULL"
	bigint culture_mission_id FK "NOT NULL"
	bigint user_id FK "NOT NULL"
	varchar_20 mission_status "NOT NULL, Enum: IN_PROGRESS, COMPLETED"
	int current_quiz_index "NOT NULL, DEFAULT: 1"
	int correct_count "NOT NULL, DEFAULT: 0"
	datetime last_completed_at
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	
	UNIQUE (culture_mission_id, user_id)
}

COOPERATIVE_MISSION {
	bigint mission_id PK, FK "NOT NULL"
	bigint location_id FK
	varchar_20 status "NOT NULL, Enum: ACTIVE, INACTIVE"
	bigint ar_character_id FK
	int point
	bigint coupon_id FK
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

COOPERATIVE_MISSION_REWARD_STATUS {
    bigint cooperative_mission_id PK, FK "NOT NULL"
    bigint user_id PK, FK "NOT NULL"
    boolean ar_character_reward_granted "NOT NULL, DEFAULT: FALSE"
    boolean point_reward_granted "NOT NULL, DEFAULT: FALSE"
    boolean coupon_reward_granted "NOT NULL, DEFAULT: FALSE"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

COOPERATIVE_MISSION_PROGRESS {
    bigint id PK "NOT NULL"
    bigint cooperative_mission_id FK "NOT NULL"
    int current_step "NOT NULL, DEFAULT: 1, ENUM: 1,2,3"
    varchar_20 mission_status "NOT NULL, Enum: IN_PROGRESS, COMPLETED"
    varchar_100 team_token "NOT NULL"
    datetime completed_at
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (team_token)
}

COOPERATIVE_ROLE_CARD {
	bigint id PK "NOT NULL"
	varchar_20 role_name "NOT NULL"
	varchar_200 role_description "NOT NULL"
	json location_to_find "NOT NULL, json: string[]"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

COOPERATIVE_MISSION_PARTICIPANT {
    bigint id PK "NOT NULL"
    bigint cooperative_mission_progress_id FK "NOT NULL"
    bigint user_id FK "NOT NULL"
	varchar_20 participant_status "NOT NULL, Enum: PENDING | ACCEPTED"
    varchar_20 participant_role "NOT NULL, Enum: HOST | MEMBER"
    datetime joined_at
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (cooperative_mission_progress_id, user_id)
}

COOPERATIVE_MISSION_ROLE_PROGRESS {
    bigint cooperative_mission_participant_id PK, FK "NOT NULL"
    bigint cooperative_role_card_id PK, FK "NOT NULL"
    varchar_500 item_img_url
    varchar_20 progress_status "NOT NULL, Enum: IN_PROGRESS, COMPLETED"
    datetime completed_at
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

TREASURE_MISSION {
	bigint mission_id PK, FK "NOT NULL"
	bigint location_id FK
	int item_total_count "NOT NULL"
	varchar_20 status "NOT NULL, Enum: ACTIVE, INACTIVE"
	bigint ar_character_id FK
	int point
	bigint coupon_id FK
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

TREASURE_MISSION_REWARD_STATUS {
    bigint treasure_mission_id PK, FK "NOT NULL"
    bigint user_id PK, FK "NOT NULL"
    boolean ar_character_reward_granted "NOT NULL, DEFAULT: FALSE"
    boolean point_reward_granted "NOT NULL, DEFAULT: FALSE"
    boolean coupon_reward_granted "NOT NULL, DEFAULT: FALSE"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

TREASURE_MISSION_PROGRESS {
    bigint id PK "NOT NULL"
	bigint treasure_mission_id FK "NOT NULL"
	bigint user_id FK "NOT NULL"
	int found_item_count "NOT NULL, DEFAULT: 0"
	varchar_20 mission_status "NOT NULL, Enum: IN_PROGRESS, COMPLETED"
	datetime completed_at
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (treasure_mission_id, user_id)
}

TREASURE_MISSION_PROGRESS_ITEM {
    bigint treasure_mission_progress_id PK, FK "NOT NULL"
    int item_index PK "NOT NULL"
    varchar_20 item_status "NOT NULL, Enum: UNFOUND, FOUND"
    datetime found_at
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

GUESTBOOK {
	bigint id PK "NOT NULL"
	bigint user_id FK "NOT NULL"
	bigint location_id FK
	date visited_at "NOT NULL"
	varchar_500 content_img_url
	varchar_500 content_writing
	varchar_500 content_audio_url
	varchar_50 audio_title
	varchar_20 content_weather
	decimal(4,1) content_temperature_celsius
	varchar_20 content_color_code
	datetime saved_at "NOT NULL"
    bigint mission_id FK
	varchar_20 status "NOT NULL, Enum: ACTIVE, INACTIVE"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

GUESTBOOK_LIKE {
    bigint guestbook_id PK, FK "NOT NULL"
    bigint user_id PK, FK "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

ROAD_GUESTBOOK {
	bigint id PK "NOT NULL"
	bigint user_id FK "NOT NULL"
	varchar_100 location_alias "NOT NULL"
	date visited_at "NOT NULL"
	varchar_500 content_img_url
	varchar_500 content_writing
	varchar_500 content_audio_url
	varchar_50 audio_title
	varchar_20 content_weather
	decimal(4,1) content_temperature_celsius
	varchar_20 content_color_code
	double latitude "NOT NULL"
	double longitude "NOT NULL"
	datetime saved_at "NOT NULL"
	varchar_20 status "NOT NULL, Enum: ACTIVE, INACTIVE"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

ROAD_GUESTBOOK_LIKE {
    bigint road_guestbook_id PK, FK "NOT NULL"
    bigint user_id PK, FK "NOT NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

ACQUIRED_AR_CHARACTER {
    bigint id PK "NOT NULL"
    bigint ar_character_id FK "NOT NULL"
    bigint user_id FK "NOT NULL"
    bigint mission_id FK "NULL"
    datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
    
    UNIQUE (mission_id, user_id)
}

AR_CHARACTER {
	bigint id PK "NOT NULL"
	varchar_50 name "NOT NULL"
	varchar_200 description "NOT NULL"
	varchar_200 story_title "NOT NULL"
	varchar_200 acquire_condition "NOT NULL"
	varchar_500 img_url "NOT NULL"
	varchar_20 representative_color "NOT NULL"
	json hashtags "NOT NULL, json: string[]"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

TRAVEL_ENDING_CONTENT {
	bigint id PK "NOT NULL"
	bigint user_id FK "NOT NULL"
	varchar_500 image_url "NOT NULL"
	datetime saved_at "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}

PICTURE_WITH_CHARACTER {
	bigint id PK "NOT NULL"
	bigint user_id FK "NOT NULL"
	varchar_500 picture_url "NOT NULL"
	datetime saved_at "NOT NULL"
	datetime created_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
	datetime updated_at "NOT NULL, DEFAULT: CURRENT_TIMESTAMP"
}


ONBOARDING_RESULT ||--o{ USER : classifies

USER ||--o{ USER_EXPECTATION : selects
EXPECTATION ||--o{ USER_EXPECTATION : selected_by
USER ||--o| USER_TRANSPORTATION : selects
TRANSPORTATION ||--o{ USER_TRANSPORTATION : selected_by
USER ||--o| USER_TRAVEL_STYLE : selects
TRAVEL_STYLE ||--o{ USER_TRAVEL_STYLE : selected_by

USER ||--|| USER_SETTING : has
USER ||--o{ STEP_REWARD : receives
USER ||--o{ VISITED_LOCATION : visits
USER ||--o{ GPS : records
USER ||--o{ CULTURE_MISSION_REWARD_STATUS : receives
USER ||--o{ CULTURE_MISSION_PROGRESS : progresses
USER ||--o{ COOPERATIVE_MISSION_REWARD_STATUS : receives
USER ||--o{ COOPERATIVE_MISSION_PARTICIPANT : joins
USER ||--o{ TREASURE_MISSION_REWARD_STATUS : receives
USER ||--o{ TREASURE_MISSION_PROGRESS : progresses
USER ||--o{ GUESTBOOK : writes
USER ||--o{ ROAD_GUESTBOOK : writes
USER ||--o{ GUESTBOOK_LIKE : likes
USER ||--o{ ROAD_GUESTBOOK_LIKE : likes
USER ||--o{ ACQUIRED_AR_CHARACTER : acquires
USER ||--o{ TRAVEL_ENDING_CONTENT : owns
USER ||--o{ PICTURE_WITH_CHARACTER : has
USER ||--o{ ACQUIRED_COUPON : acquires

LOCATION ||--o{ VISITED_LOCATION : visited_by
LOCATION o|--o{ COUPON : provides
LOCATION o|--o{ GUESTBOOK : contains
LOCATION o|--o{ COOPERATIVE_MISSION : hosts
LOCATION o|--o{ TREASURE_MISSION : hosts

MISSION_TYPE ||--o{ MISSION : categorizes
MISSION ||--o| CULTURE_MISSION : has_detail
MISSION ||--o| COOPERATIVE_MISSION : has_detail
MISSION ||--o| TREASURE_MISSION : has_detail
MISSION o|--o{ GUESTBOOK : relates_to
MISSION o|--o{ ACQUIRED_AR_CHARACTER : rewards

AR_CHARACTER o|--o{ CULTURE_MISSION : rewards
AR_CHARACTER o|--o{ COOPERATIVE_MISSION : rewards
AR_CHARACTER o|--o{ TREASURE_MISSION : rewards
AR_CHARACTER ||--o{ ACQUIRED_AR_CHARACTER : acquired_as

COUPON o|--o{ CULTURE_MISSION : rewards
COUPON o|--o{ COOPERATIVE_MISSION : rewards
COUPON o|--o{ TREASURE_MISSION : rewards
COUPON ||--o{ ACQUIRED_COUPON : acquired_as

CULTURE_MISSION ||--|{ CULTURE_MISSION_QUIZ : contains
CULTURE_MISSION ||--o{ CULTURE_MISSION_REWARD_STATUS : tracks
CULTURE_MISSION ||--o{ CULTURE_MISSION_PROGRESS : tracks

COOPERATIVE_MISSION ||--o{ COOPERATIVE_MISSION_REWARD_STATUS : tracks
COOPERATIVE_MISSION ||--o{ COOPERATIVE_MISSION_PROGRESS : tracks
COOPERATIVE_MISSION_PROGRESS ||--|{ COOPERATIVE_MISSION_PARTICIPANT : has
COOPERATIVE_MISSION_PARTICIPANT ||--o{ COOPERATIVE_MISSION_ROLE_PROGRESS : progresses
COOPERATIVE_ROLE_CARD ||--o{ COOPERATIVE_MISSION_ROLE_PROGRESS : assigned_as

TREASURE_MISSION ||--o{ TREASURE_MISSION_REWARD_STATUS : tracks
TREASURE_MISSION ||--o{ TREASURE_MISSION_PROGRESS : tracks
TREASURE_MISSION_PROGRESS ||--|{ TREASURE_MISSION_PROGRESS_ITEM : contains

GUESTBOOK ||--o{ GUESTBOOK_LIKE : liked_by
ROAD_GUESTBOOK ||--o{ ROAD_GUESTBOOK_LIKE : liked_by
```
