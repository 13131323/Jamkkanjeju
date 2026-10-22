package com.jamkkanjeju.server.common.config;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** JSON 정수만 Long으로 읽어 소수·문자열 등의 암묵적 변환을 막는다. 필요한 DTO 필드에만 적용한다. */
public class StrictLongDeserializer extends ValueDeserializer<Long> {

    /** 정수 토큰은 읽고 나머지 형식은 Jackson의 요청 본문 변환 오류로 처리한다. */
    @Override
    public Long deserialize(JsonParser parser, DeserializationContext context) {
        if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
            return (Long) context.handleUnexpectedToken(Long.class, parser);
        }
        return parser.getLongValue();
    }
}
