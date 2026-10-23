import http from 'k6/http';
import { check } from 'k6';

const url = __ENV.K6_MAP_URL;
const iterations = Number(__ENV.K6_MAP_ITERATIONS);
if (!url || !/^https?:\/\/[^/?#]+\/api\/v2\/map\/contents\?/.test(url)) {
    throw new Error('run.ps1을 통해 지도 홈 조회 URL을 전달하십시오.');
}
const clusteredParams = url.split('?')[1].split('&').filter((param) => param.split('=')[0] === 'isClustered');
if (clusteredParams.length !== 1 || clusteredParams[0] !== 'isClustered=false') {
    throw new Error('지도 홈 조회 측정은 isClustered=false 상세 응답으로 고정됩니다.');
}
if (iterations !== 30 && iterations !== 100) {
    throw new Error('호출 횟수는 예열 30회 또는 측정 100회여야 합니다.');
}

// 각 반복은 정확히 한 번 호출하며 동시 요청·재시도·리다이렉트를 하지 않는다.
export const options = {
    scenarios: {
        map_home: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations,
            maxDuration: '24h',
        },
    },
    discardResponseBodies: true,
    maxRedirects: 0,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
    summaryTimeUnit: 'ms',
    // 지연시간 합격 기준은 두지 않으며 비정상 응답이 있으면 실행을 실패로 표시한다.
    thresholds: {
        http_req_failed: ['rate==0'],
    },
};

const headers = { Accept: 'application/json' };
if (__ENV.K6_MAP_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.K6_MAP_ACCESS_TOKEN}`;
}
http.setResponseCallback(http.expectedStatuses(200));

/** 지도 API 응답 본문 수신까지 기다린 뒤 상태 코드와 k6 기본 시간 지표를 수집한다. */
export default function () {
    const response = http.get(url, {
        headers,
        timeout: __ENV.K6_MAP_REQUEST_TIMEOUT || '60s',
        tags: { name: 'GET /api/v2/map/contents' },
    });
    check(response, { 'HTTP 200': (result) => result.status === 200 });
    if (response.status !== 200) {
        console.warn(`지도 홈 조회 실패: status=${response.status}, error_code=${response.error_code || 0}`);
    }
}
