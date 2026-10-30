package com.jamkkanjeju.server.domain.map.integration;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 실제 인증·MySQL에서 수령 쿠폰 식별자와 사용자별 격리를 검증한다. */
@SpringBootTest(properties = {
        "app.dev-auth.enabled=false", "app.blob-storage.container=media",
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d"
})
@AutoConfigureMockMvc
@Transactional
class GetMapContentsCouponApiIntegrationTest extends MySqlIntegrationTestSupport {
    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean TourApiClient images;

    private <T> T persist(T entity) { em.persist(entity); return entity; }

    private void acquire(User user, Coupon coupon) {
        persist(AcquiredCoupon.builder().user(user).coupon(coupon).acquiredAt(TIME).build());
    }

    private String request(User user, boolean clustered) throws Exception {
        return mvc.perform(get("/api/v2/map/contents")
                .header("Authorization", "Bearer " + tokens.createAccessToken(user).value())
                .param("leftTopLatitude", "33.451").param("leftTopLongitude", "126.919")
                .param("rightBottomLatitude", "33.449").param("rightBottomLongitude", "126.921")
                .param("userLatitude", "33.45").param("userLongitude", "126.92")
                .param("isClustered", Boolean.toString(clustered)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void 본인의_획득_쿠폰만_ID와_함께_반환하고_동일금액도_구분한다() throws Exception {
        User current = persist(user(null, "map-coupon-current@example.com"));
        User other = persist(user(null, "map-coupon-other@example.com"));
        Location target = persist(location(null, 9_000_000_101L));
        Location empty = persist(location(null, 9_000_000_102L));
        Coupon first = persist(Coupon.builder().location(target).couponPrice(1000).build());
        Coupon second = persist(Coupon.builder().location(target).couponPrice(1000).build());
        Coupon others = persist(Coupon.builder().location(target).couponPrice(2000).build());
        persist(Coupon.builder().location(target).couponPrice(3000).build());
        acquire(current, first);
        persist(AcquiredCoupon.builder().user(current).coupon(second).acquiredAt(TIME).usedAt(TIME).build());
        acquire(other, others);
        em.flush();
        String body = request(current, false);
        List<Number> ids = JsonPath.read(body, "$.locations[?(@.id == " + target.getId() + ")].receivedCoupons[*].couponId");
        assertThat(ids.stream().map(Number::longValue)).containsExactlyInAnyOrder(first.getId(), second.getId());
        List<Map<String, Object>> couponItems = JsonPath.read(body,
                "$.locations[?(@.id == " + target.getId() + ")].receivedCoupons[*]");
        for (Map<String, Object> item : couponItems) {
            assertThat(item).containsKey("usedAt");
            if (((Number) item.get("couponId")).longValue() == first.getId()) {
                assertThat(item.get("usedAt")).isNull();
            } else {
                assertThat(LocalDateTime.parse((String) item.get("usedAt"))).isEqualTo(TIME);
            }
        }
        List<Map<String, Object>> locations = JsonPath.read(body, "$.locations");
        assertThat(locations.stream().filter(it -> ((Number) it.get("id")).longValue() == empty.getId())
                .findFirst().orElseThrow().get("receivedCoupons")).isNull();
    }

    @Test
    void 간소_응답에는_수령쿠폰_필드를_추가하지_않는다() throws Exception {
        User current = persist(user(null, "map-coupon-cluster@example.com"));
        Location target = persist(location(null, 9_000_000_103L));
        acquire(current, persist(Coupon.builder().location(target).couponPrice(1000).build()));
        em.flush();
        assertThat(request(current, true)).doesNotContain("receivedCoupons", "couponId", "usedAt");
    }
}
