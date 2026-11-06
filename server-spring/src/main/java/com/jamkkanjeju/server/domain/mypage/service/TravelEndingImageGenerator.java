package com.jamkkanjeju.server.domain.mypage.service;

import com.jamkkanjeju.server.common.client.OpenAiClient;
import com.jamkkanjeju.server.common.client.ReferenceImageClient;
import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** FastAPI 원문 프롬프트와 순서가 일치하는 manifest·참조 이미지로 엽서를 생성한다. */
@Component
public class TravelEndingImageGenerator {
    private static final Pattern PLACEHOLDERS = Pattern.compile("\\{(travel_note|manifest_json)\\}");
    private final OpenAiClient openAiClient;
    private final TourApiClient tourApiClient;
    private final ReferenceImageClient referenceImageClient;
    private final JsonMapper jsonMapper;
    private final String promptTemplate;

    public TravelEndingImageGenerator(OpenAiClient openAiClient, TourApiClient tourApiClient,
                                     ReferenceImageClient referenceImageClient, JsonMapper jsonMapper) throws IOException {
        this.openAiClient = openAiClient;
        this.tourApiClient = tourApiClient;
        this.referenceImageClient = referenceImageClient;
        this.jsonMapper = jsonMapper;
        // TODO: FastAPI와 동일하게 한글 표기·레이아웃 품질 검증 후 프롬프트를 조정한다.
        this.promptTemplate = new ClassPathResource("prompts/travel-ending.txt").getContentAsString(StandardCharsets.UTF_8);
    }

    /** 내려받지 못한 참조 이미지는 제외하되 각 재료의 이름과 순서는 보존한다. */
    public byte[] generate(List<Source> sources, String travelNote) {
        List<Map<String, Object>> manifest = new ArrayList<>();
        List<ValidatedImage> images = new ArrayList<>();
        for (Source source : sources) {
            ValidatedImage image = source.photo();
            if (image == null) {
                String url = source.imageUrl();
                if (url == null && source.contentId() != null) url = tourApiClient.getLocationImageUrl(source.contentId());
                image = referenceImageClient.download(url);
            }
            if (image != null) images.add(image);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("sourceType", source.sourceType().name());
            entry.put("displayName", source.displayName());
            entry.put("locationName", source.locationName());
            entry.put("inputImageIndex", image == null ? null : images.size());
            manifest.add(entry);
        }
        String manifestJson = jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest);
        // 치환한 사용자 데이터 안의 같은 문자열을 다시 치환하지 않는다.
        String prompt = PLACEHOLDERS.matcher(promptTemplate).replaceAll(match -> Matcher.quoteReplacement(
                "travel_note".equals(match.group(1)) ? (travelNote == null ? "" : travelNote) : manifestJson));
        return openAiClient.editImage(prompt, images);
    }

    /** 프롬프트 manifest에서 사용하는 재료 유형이다. */
    public enum SourceType { VISITED_LOCATION, MISSION, USER_PHOTO }

    /** DB 검증 후 외부 호출에 필요한 공개 정보만 전달하는 재료이다. 엔티티를 전달하지 않는다. */
    public record Source(SourceType sourceType, String displayName, String locationName,
                         Long contentId, String imageUrl, ValidatedImage photo) { }
}
