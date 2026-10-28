/**
 * 완료 화면에서 기기 높이에 따라 조절되는 값들.
 *
 * 이 화면은 세로 여백이 거의 없다 — 디자인(보드 800)이 iOS 상태바 44 + 홈 인디케이터 31 기준이라
 * 안드로이드 네비게이션바까지 더하면 짧은 기기에서 스크롤이 생긴다. 그래서 예전에 축하 이미지를
 * 디자인 값 164에서 150으로, 장소 썸네일을 83에서 73으로 줄여 두었다.
 *
 * 높이만 보고 비율로 줄이면 안 되는 이유: 콘텐츠 높이가 기기 높이만으로 정해지지 않는다.
 * ResultCard의 보상 행이 0~3개로 달라지고(서버가 이번에 지급한 항목만 내려준다) 그 폭이 175다.
 * 그래서 "남는 높이를 조절 가능한 두 값에 나눠 준다"는 방식으로 계산한다.
 *
 * 조절 대상과 정하는 순서:
 *   1. "다음 여행지를 추천드려요" 위 간격(12~44) — **기기 높이만** 보고 먼저 정한다.
 *   2. 축하 이미지(120~178) — 남는 높이를 받는다. 보상 행 수가 만드는 차이를 여기서 흡수한다.
 *   3. 자리가 빠듯하면 1번이 **필요한 만큼만** 하한(12)까지 되돌아가 2번에 넘긴다(사용자 지시:
 *      "여백 최소 12px, 나머지는 기기에 맞춰서, 스크롤 안 되게").
 *
 * 간격이 행 수를 보지 않는 이유: 같은 기기인데 중단으로 온 화면(0행)은 문구 위가 트여 있고
 * 정상 완료(3행)는 붙어 보였다(사용자 지시). 행 수는 화면 높이와 무관한 값이라 여백이 거기에
 * 흔들릴 이유가 없다. 다만 그 규칙을 끝까지 밀면 이미지가 하한에 걸린 뒤에도 여백이 넓은 값을
 * 쥐고 있어 그만큼이 스크롤이 됐다 — 그래서 3번을 둔다. 예산이 132(120+12) 이상이면 스크롤이
 * 생기지 않고, 그보다 좁은 기기만 ScrollView가 받는다.
 *
 * 그래도 큰 기기에서 남는 공간은 있다. 이 화면은 위에서부터 쌓이고 CTA가 하단에 고정된
 * 구조라, 다 나눠 주고 남은 몫은 scrollContent의 flexGrow가 CTA 위쪽에 모아 둔다.
 */

/**
 * 축하 이미지 **표준** 크기(정사각). 배율 1이 이 크기다.
 *
 * 문화 완료 보드의 디자인 값(164)이 그대로 표준이다. 예전에는 150이었는데, 그건 짧은 기기의
 * 스크롤을 막으려고 디자인 값에서 미리 깎아 둔 값이었다 — 이제 그 조절은 아래 상하한이 맡는다.
 */
export const CELEBRATION_BASE_SIZE = 164;

/**
 * 여유가 있는 기기에서 커질 수 있는 최대치.
 *
 * Penpot 보물찾기 완료 보드의 축하 이미지가 178이다(문화 164 / 협동 171x176). 세 화면을
 * 미션별로 가르지 않고, **164를 표준으로 두고 화면이 허락하면 178까지 키우는** 하나의 범위로 통일한다.
 */
const CELEBRATION_MAX_SIZE = 178;

/**
 * 더 줄일 수 있는 최소치.
 *
 * **"164~178"이라는 지시의 하한은 120 그대로 둔 것이다.** 하한까지 164로 올리면 짧은 기기에서
 * 콘텐츠가 넘쳐 스크롤이 생긴다 — 이 파일이 애초에 피하려던 상태다(아래 "빈 공간이 캐릭터보다
 * 먼저 양보해야 한다" 참고). 그래서 164는 "여유가 있을 때 도달하는 표준값", 178은 상한으로 읽는다.
 * 짧은 기기에서도 164를 지켜야 한다면 이 상수만 164로 올리면 된다(대신 스크롤이 생긴다).
 *
 * 이보다 작아지면 캐릭터가 무엇인지 알아보기 어려워진다. 여기까지 줄여도 넘치는 기기는
 * ScrollView가 처리하게 둔다 — 알아볼 수 없는 축하 이미지보다 스크롤이 낫다.
 */
const CELEBRATION_MIN_SIZE = 120;

/**
 * 협동 완료 화면의 축하 이미지 기준 크기.
 *
 * 협동만 정사각이 아니다 — 귤나무(162)와 귤 캐릭터(89)가 겹친 합성 PNG이고, Penpot 배치는
 * **171x176**이다. 그런데 이 값은 dp가 아니라 "표준 크기에 곱해질 배율(scale)이 적용될 상자"라,
 * 표준이 150 → 164로 올라가면 같은 171x176을 넣었을 때 협동만 약 9% 작아진다
 * (배율이 size/150에서 size/164로 바뀌기 때문). 디자인 값에 164/150을 곱해 **렌더 결과를
 * 예전 그대로 유지**한다: 171 × 164/150 = 187, 176 × 164/150 = 192.
 *
 * 비율(171:176)은 그대로라 합성 이미지가 눌리거나 늘어나지 않는다.
 */
export const COOP_CELEBRATION_SIZE: CelebrationSize = { width: 187, height: 192 };

/**
 * "다음 여행지를 추천드려요" 위 간격. 남는 높이에 따라 이 범위에서 움직인다.
 *
 * 하한은 12다(사용자 지시). 짧은 기기에서 **스크롤을 만들지 않는 것**이 문구 위 여백보다
 * 우선이라, 자리가 빠듯해지면 이 값까지 내려가며 그만큼을 축하 이미지에 넘긴다
 * (아래 resolveCompleteLayout의 두 번째 clamp).
 */
const SUGGESTION_GAP_MIN = 12;
const SUGGESTION_GAP_MAX = 44;

/**
 * 디자인 값. 지금은 **높이를 아직 못 잰 구간의 폴백**으로만 쓴다.
 *
 * 디자인 28에서 32로 한 단계(4) 올렸다 — 문구 위가 좁다는 지적에 따른 것이고, 상한도 40→44로
 * 같이 올려 여유가 있는 기기에서도 그만큼 트이게 했다.
 */
const SUGGESTION_GAP_DESIGN = 32;

/**
 * 조절 대상을 뺀 나머지 콘텐츠 높이.
 *
 * **styles.ts의 수치를 그대로 더한 값이다 — 그쪽을 바꾸면 여기도 같이 바꿔야 한다.**
 * (completeLayout.test.ts가 합계를 고정해 두었으니 어긋나면 테스트가 잡는다)
 */
const HEADER_HEIGHT = 56;
/** message: marginTop 8 + title lineHeight 36 + subtitle marginTop 8 + subtitle lineHeight 20 */
const MESSAGE_HEIGHT = 72;
/** resultCard: marginTop 27 + paddingVertical 8 상하 */
const RESULT_CARD_CHROME = 43;
/** resultRow 한 줄 */
const RESULT_ROW_HEIGHT = 52;
/** suggestion 텍스트 자체(lineHeight 24). 위 간격은 조절 대상이라 여기 포함하지 않는다 */
const SUGGESTION_TEXT_HEIGHT = 24;
/** placeCard: marginTop 8 + paddingTop 14 + thumb 73 + paddingBottom 17 */
const PLACE_CARD_HEIGHT = 112;
/** celebrationRow marginTop — 헤더와 겹치는 양이라 콘텐츠 높이에서 빠진다 */
const CELEBRATION_OVERLAP = 42;
/**
 * ctaWrapper: paddingTop 12 + 버튼 52.
 * paddingBottom은 `max(insets.bottom, CTA_BOTTOM_GAP)`이고 인셋 몫은 usableHeight에서 이미 빠졌다.
 * 시스템 바가 없는 기기에서 그 여백이 16에서 20으로 늘었는데(styles/safeArea.ts), 4px 차이는
 * 아래 SAFETY_MARGIN이 이미 흡수한다 — 이 값은 이미지 크기를 고르는 어림값이다.
 */
const CTA_HEIGHT = 64;
/**
 * 예측하지 못한 증가분 여유.
 *
 * 부제나 장소 문구가 두 줄로 감기면(문구 길이는 서버가 정한다) 계산보다 높아진다.
 * 살짝 보수적으로 잡아 이미지를 조금 작게 고르는 편이, 넘쳐서 스크롤이 생기는 것보다 낫다.
 */
const SAFETY_MARGIN = 10;

export interface CompleteLayoutInput {
  /** 화면 높이에서 상단·하단 인셋을 뺀 실사용 높이. 인셋은 기기마다 다르다(안드로이드 네비게이션바 0~48) */
  usableHeight: number;
  /** ResultCard에 그려질 보상 행 수. 0이면 카드를 아예 그리지 않는다 */
  resultRowCount: number;
}

export interface CompleteLayoutMetrics {
  /** 축하 이미지 기준 크기에 곱할 배율 */
  celebrationScale: number;
  /** "다음 여행지를 추천드려요" 위 간격(marginTop) */
  suggestionGap: number;
}

export interface CelebrationSize {
  width: number;
  height: number;
}

/**
 * 조절 대상(축하 이미지·suggestion 간격)을 제외한 콘텐츠가 차지하는 높이.
 *
 * export한 이유는 테스트가 "두 값의 합이 남는 높이를 넘지 않는다"는 불변식을 확인할 때
 * 같은 상수를 다시 적지 않아도 되게 하려는 것이다(상수가 두 곳에 갈라지면 의미가 없다).
 */
export function fixedContentHeight(resultRowCount: number): number {
  // 행이 하나도 없으면 레이아웃이 카드를 통째로 빼므로 chrome도 함께 사라진다
  const resultCard = resultRowCount > 0 ? RESULT_CARD_CHROME + resultRowCount * RESULT_ROW_HEIGHT : 0;

  return HEADER_HEIGHT + MESSAGE_HEIGHT + resultCard + SUGGESTION_TEXT_HEIGHT + PLACE_CARD_HEIGHT - CELEBRATION_OVERLAP + CTA_HEIGHT + SAFETY_MARGIN;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 남는 높이를 축하 이미지와 suggestion 간격에 나눠 준다.
 *
 * 측정 전(0)이나 이상값이면 지금까지 쓰던 값(배율 1, 간격 28 = 디자인)을 돌려준다 —
 * 크기가 0이 되어 이미지가 사라지는 상태를 만들지 않는다.
 */
export function resolveCompleteLayout({ usableHeight, resultRowCount }: CompleteLayoutInput): CompleteLayoutMetrics {
  if (!Number.isFinite(usableHeight) || usableHeight <= 0) {
    return { celebrationScale: 1, suggestionGap: SUGGESTION_GAP_DESIGN };
  }

  /**
   * 간격은 **기기 높이만 보고** 정한다(사용자 지시).
   *
   * 예전에는 예산을 이미지와 간격이 나눠 써서, 같은 기기인데도 보상 행이 많으면 간격이 좁아졌다 —
   * 중단으로 온 완료 화면(0행)은 문구 위가 트여 있는데 정상 완료(3행)는 붙어 보였다.
   * 행 수는 화면 높이와 무관한 값이라 여백이 거기에 흔들릴 이유가 없다.
   *
   * 기준은 "행이 없을 때의 고정 콘텐츠와 이미지 상한을 세우고 남는 높이"다. 큰 기기면 상한(44)에
   * 닿고, 낮아질수록 좁아져 하한(12)에서 멈춘다.
   */
  const heightOnlyBudget = usableHeight - fixedContentHeight(0);
  const heightOnlyGap = clamp(heightOnlyBudget - CELEBRATION_MAX_SIZE, SUGGESTION_GAP_MIN, SUGGESTION_GAP_MAX);

  const budget = usableHeight - fixedContentHeight(Math.max(0, resultRowCount));

  /**
   * **자리가 빠듯하면 여백이 먼저 양보한다.**
   *
   * 예전에는 간격을 기기 높이만 보고 정한 뒤 이미지에서만 clamp했다. 그래서 짧은 기기 + 보상
   * 3행이면 이미지가 하한(120)에 걸려 있는 동안에도 간격은 넓은 값을 그대로 쥐고 있었고,
   * 넘친 만큼이 스크롤이 됐다. 이미지가 하한에 닿을 만큼 좁아지는 구간에서는 간격을 하한(12)까지
   * 되돌려 그 공간을 이미지에 넘긴다 — 여유가 있는 기기에서는 이 clamp가 아무것도 바꾸지 않는다.
   *
   * 결과: `budget >= CELEBRATION_MIN_SIZE + SUGGESTION_GAP_MIN`(=132)이면 스크롤이 생기지 않는다.
   * 그보다 좁으면 ScrollView가 받는다 — 알아볼 수 없는 축하 이미지보다 스크롤이 낫다는 판단은 그대로다.
   */
  const suggestionGap = clamp(budget - CELEBRATION_MIN_SIZE, SUGGESTION_GAP_MIN, heightOnlyGap);
  const celebrationSize = clamp(budget - suggestionGap, CELEBRATION_MIN_SIZE, CELEBRATION_MAX_SIZE);

  return { celebrationScale: celebrationSize / CELEBRATION_BASE_SIZE, suggestionGap };
}

/**
 * 기준 크기에 배율을 적용한다.
 *
 * 가로·세로에 같은 배율을 걸어 원본 비율을 유지한다 — 협동의 합성 PNG(171x176)처럼
 * 정사각형이 아닌 이미지도 늘어나거나 눌리지 않는다. 소수점은 반올림한다(원형 radius를
 * 크기의 절반으로 잡을 때 값이 딱 맞아야 한다).
 */
export function scaleCelebrationSize(base: CelebrationSize, scale: number): CelebrationSize {
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}

export interface CelebrationRenderInput {
  /** 미션이 지정한 기준 크기. 생략하면 정사각 기준(150) */
  celebrationSize?: CelebrationSize;
  /** 미션이 지정한 라운딩. 생략하면 정원 */
  celebrationRadius?: number;
  /** resolveCompleteLayout이 기기 높이로 정한 배율 */
  scale: number;
  /** 서버가 준 AR 캐릭터 URL을 그리는 중인지. false면 번들 에셋이다 */
  isRemote: boolean;
}

export interface CelebrationRender {
  size: CelebrationSize;
  resizeMode: 'cover' | 'contain';
  borderRadius: number;
}

/**
 * 축하 이미지의 상자·자르기·라운딩을 한자리에서 정한다.
 *
 * **상자 크기는 서버 그림과 번들 에셋이 반드시 같아야 한다.** 예전에는 서버 경로만 정사각
 * 기준(150)을 따로 계산해서, 같은 화면이 URL을 불러왔는지에 따라 다른 크기로 그려졌다 —
 * 협동은 171x176 ↔ 150x150으로 튀었다. 기기 높이 배율(scale)은 두 경로 모두 같은 상자에 걸린다.
 *
 * 자르기가 갈리는 건 그림의 성격이 다르기 때문이라 그대로 둔다.
 *   - 번들 에셋(크기 미지정)은 원형 틀에 맞춰 그려진 디자인 에셋이라 cover + 정원으로 채운다.
 *   - 협동처럼 크기를 지정한 합성 에셋은 여백까지 의미가 있어 contain이다.
 *   - 서버 그림은 비율도 여백도 알 수 없다. 자르면 캐릭터가 잘리므로 contain으로 두고,
 *     원형 틀도 씌우지 않는다(그 틀에 맞춰 그려진 그림이 아니다).
 */
export function resolveCelebrationRender({ celebrationSize, celebrationRadius, scale, isRemote }: CelebrationRenderInput): CelebrationRender {
  const base = celebrationSize ?? { width: CELEBRATION_BASE_SIZE, height: CELEBRATION_BASE_SIZE };
  const size = scaleCelebrationSize(base, scale);

  if (isRemote) {
    return { size, resizeMode: 'contain', borderRadius: 0 };
  }

  return {
    size,
    resizeMode: celebrationSize === undefined ? 'cover' : 'contain',
    borderRadius: celebrationRadius ?? size.width / 2,
  };
}
