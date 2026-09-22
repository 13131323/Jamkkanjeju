ALTER TABLE `expectation`
    ADD CONSTRAINT `chk_expectation_type_enum`
        CHECK (`expectation_type` IN (
            'PHOTO',
            'LOCAL',
            'NATURE',
            'CULTURE',
            'CAFE',
            'WALKING'
        ));

ALTER TABLE `transportation`
    ADD CONSTRAINT `chk_transportation_type_enum`
        CHECK (`transportation_type` IN (
            'WALK',
            'BUS',
            'CAR',
            'BICYCLE'
        ));

ALTER TABLE `travel_style`
    ADD CONSTRAINT `chk_travel_style_type_enum`
        CHECK (`travel_style_type` IN (
            'RIGHT_HERE',
            'NEAR_AROUND',
            'NEAR_DESTINATION'
        ));
