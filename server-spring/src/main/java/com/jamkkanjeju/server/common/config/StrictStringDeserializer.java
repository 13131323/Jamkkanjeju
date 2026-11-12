package com.jamkkanjeju.server.common.config;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** JSON 문자열만 허용하여 숫자·불리언의 암묵적 문자열 변환을 막는다. 필요한 DTO 필드에만 적용한다. */
public class StrictStringDeserializer extends ValueDeserializer<String> {

    /** 문자열은 원문 그대로 읽고 나머지 형식은 요청 본문 변환 오류로 처리한다. */
    @Override
    public String deserialize(JsonParser parser, DeserializationContext context) {
        if (parser.currentToken() != JsonToken.VALUE_STRING) {
            return (String) context.handleUnexpectedToken(String.class, parser);
        }
        return parser.getString();
    }
}
