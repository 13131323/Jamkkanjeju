import { describe, expect, it } from 'vitest';
import { buildOneStoreUrl, ONE_STORE_PRODUCT_ID } from './oneStoreUrl';

describe('buildOneStoreUrl', () => {
  it('상품ID가 있으면 원스토어 짧은 주소를 만든다', () => {
    // 원스토어 공식 형식: https://onesto.re/{숫자 10자리 PID}
    expect(buildOneStoreUrl('0000747601')).toBe('https://onesto.re/0000747601');
  });

  it('앞뒤 공백을 지운다 — 콘솔에서 값을 복사해 붙이면 따라온다', () => {
    expect(buildOneStoreUrl(' 0000747601 ')).toBe('https://onesto.re/0000747601');
  });

  // `undefined`는 여기 없다 — JS 기본 파라미터는 undefined에만 적용되므로 그것은 "값이 없다"가
  // 아니라 "저장소에 설정된 PID를 쓴다"는 뜻이다(아래 별도 케이스). null은 명시적으로 "없음"이다.
  it.each([null, '', '   ', 'com.tamnalog.app', '747601', '00007476012'])('상품ID가 없거나 형식이 아니면 검색으로 보낸다: %s', (productId) => {
    // 죽은 링크(404)보다 검색 결과가 낫다. 사용자는 한 번 더 눌러 설치까지 갈 수 있다.
    expect(buildOneStoreUrl(productId)).toBe('https://m.onestore.co.kr/ko-kr/search/integrateSearch.omp?integrateQuery=%EC%9E%A0%EA%B9%90%EC%A0%9C%EC%A3%BC');
  });

  // 설정된 값이 형식을 벗어나면 buildOneStoreUrl이 조용히 검색으로 내려간다 — 버튼은 살아 있어서
  // 눈으로는 알아채기 어렵다. 오타가 배포까지 가지 않도록 값 자체를 여기서 못 박는다.
  it('저장소에 설정된 상품ID가 원스토어 형식(숫자 10자리)이다', () => {
    expect(ONE_STORE_PRODUCT_ID).toMatch(/^\d{10}$/);
  });

  it('설정된 상품ID로는 검색이 아니라 상세 페이지로 간다', () => {
    expect(buildOneStoreUrl()).toBe(`https://onesto.re/${ONE_STORE_PRODUCT_ID}`);
  });

  it('패키지명은 상품ID가 아니다 — 원스토어는 PID로만 상세를 가리킨다', () => {
    expect(buildOneStoreUrl('com.tamnalog.app')).not.toContain('com.tamnalog.app');
  });

  it('인자를 생략하면 저장소에 설정된 상품ID를 쓴다', () => {
    expect(buildOneStoreUrl()).toBe(buildOneStoreUrl(ONE_STORE_PRODUCT_ID));
  });

  it('항상 https 주소를 돌려준다 — 버튼이 죽는 갈래를 만들지 않는다', () => {
    expect(buildOneStoreUrl()).toMatch(/^https:\/\//);
    expect(buildOneStoreUrl('0000747601')).toMatch(/^https:\/\//);
  });
});
