import { describe, expect, it } from 'vitest';
import { buildCardCaptureOptions, estimateBase64ByteSize } from './cardCapture';

describe('buildCardCaptureOptions', () => {
  it('폰트 임베드 CSS가 없으면(null) fontEmbedCSS를 아예 안 붙인다 — html-to-image가 그 자리에서 계산하게 둔다', () => {
    const options = buildCardCaptureOptions({ width: 300, height: 440 }, null);
    expect(options).toEqual({ pixelRatio: 2, width: 300, height: 440, style: { transform: 'none', backfaceVisibility: 'visible', height: '440px', maxHeight: 'none' } });
    expect(options.fontEmbedCSS).toBeUndefined();
  });

  it('폰트 임베드 CSS가 있으면 그대로 옵션에 실어 재계산을 막는다', () => {
    const options = buildCardCaptureOptions({ width: 300, height: 620 }, '@font-face{...}');
    expect(options.fontEmbedCSS).toBe('@font-face{...}');
    expect(options.width).toBe(300);
    expect(options.height).toBe(620);
  });

  it('pixelRatio는 항상 2로 고정한다 — 기기 실제 배율(2.5~3배)을 그대로 쓰면 base64가 그만큼 커진다', () => {
    expect(buildCardCaptureOptions({ width: 100, height: 100 }, null).pixelRatio).toBe(2);
  });

  it('뒷면 캡처를 위해 transform은 항상 none, backfaceVisibility는 항상 visible로 되돌린다', () => {
    const { style } = buildCardCaptureOptions({ width: 300, height: 440 }, null);
    expect(style.transform).toBe('none');
    expect(style.backfaceVisibility).toBe('visible');
  });

  it('넘어온 높이를 style에도 박는다 — 면 노드가 absolute라 높이를 명시해야 복제본이 그만큼 펴진다', () => {
    const { height, style } = buildCardCaptureOptions({ width: 300, height: 660 }, null);
    expect(height).toBe(660);
    expect(style.height).toBe('660px');
    // 부모에서 물려받은 max-height가 남아 있으면 늘린 높이가 다시 잘린다
    expect(style.maxHeight).toBe('none');
  });
});

describe('estimateBase64ByteSize', () => {
  it('패딩이 없는 base64는 길이의 3/4이 원본 바이트 수다 — "Man"의 base64는 "TWFu"(4글자→3바이트)', () => {
    expect(estimateBase64ByteSize('data:text/plain;base64,TWFu')).toBe(3);
  });

  it('패딩 1글자(=)는 인코딩되지 않은 바이트가 하나 있다는 뜻이라 그만큼 뺀다 — "Ma"의 base64는 "TWE="', () => {
    expect(estimateBase64ByteSize('data:text/plain;base64,TWE=')).toBe(2);
  });

  it('패딩 2글자(==)는 둘을 뺀다 — "M"의 base64는 "TQ=="', () => {
    expect(estimateBase64ByteSize('data:text/plain;base64,TQ==')).toBe(1);
  });

  it('payload가 비어 있으면 0이다', () => {
    expect(estimateBase64ByteSize('data:image/png;base64,')).toBe(0);
  });
});

