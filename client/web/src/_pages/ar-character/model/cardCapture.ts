export type CardCaptureOptions = {
  pixelRatio: number;
  width: number;
  height: number;
  style: { transform: string; backfaceVisibility: string; height: string; maxHeight: string };
  fontEmbedCSS?: string;
};

export function buildCardCaptureOptions(rect: { width: number; height: number }, fontEmbedCss: string | null): CardCaptureOptions {
  const options: CardCaptureOptions = {
    pixelRatio: 2,
    // 뒷면 노드에는 `rotateY(180deg)`·`backface-visibility: hidden`·`position: absolute`가 걸려 있다.
    // 그대로 뜨면 좌우가 뒤집히거나 아예 빈 그림이 나오므로 **복제본에서만** 걷어낸다.
    // 크기는 원본에서 재서 넘긴다 — absolute를 풀면 스스로 크기를 잃는다.
    width: rect.width,
    height: rect.height,
    // height/maxHeight를 함께 박는다 — 캡처 대상은 화면 밖 사본이라(captureCardPng) 부모에서
    // 물려받은 제한이 남아 있으면 다시 그 선에서 잘린다.
    style: { transform: 'none', backfaceVisibility: 'visible', height: `${rect.height}px`, maxHeight: 'none' },
  };
  if (fontEmbedCss !== null) {
    options.fontEmbedCSS = fontEmbedCss;
  }
  return options;
}

/**
 * data URL(base64)의 실제 바이트 크기를 어림한다. 브릿지로 넘기는 페이로드가 얼마나 큰지 실기기에서
 * 재보기 위해 Sentry 브레드크럼에 남기는 용도라 순수 계산으로 뗀다.
 *
 * base64는 3바이트를 4글자로 인코딩하므로 길이의 3/4이 원본 바이트 수다. 끝의 `=` 패딩 한 글자마다
 * 인코딩되지 않은 바이트가 하나씩 있다는 뜻이라 그만큼 뺀다.
 */
export function estimateBase64ByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.match(/=+$/)?.[0].length ?? 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
