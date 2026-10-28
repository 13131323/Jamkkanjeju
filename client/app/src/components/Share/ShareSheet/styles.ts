import { StyleSheet } from 'react-native';

/**
 * 공유 시트의 치수·색.
 *
 * 원래는 협동 미션 초대 전용(`Coop/InviteShareSheet/styles.ts`)이었다. AI 엽서도 같은 시트를 쓰게
 * 되면서 컴포넌트와 함께 여기로 옮겼고, **값은 하나도 바꾸지 않았다** — 초대 시트가 기기에서 보이던
 * 모습이 그대로여야 한다. 아래 근거가 전부 "협동 미션 초대 시안"을 가리키는 것은 그래서다.
 *
 * **시안 기준 — `app/assets/images/ShareBottomSheetContainer.png`.**
 * 시안은 폭 360dp 카드로 그려져 있어 1dp = 1px로 읽을 수 있다. 아래 값은 그 PNG를 실제로 재서 옮겼다
 * (카드 왼쪽 x=24, 위 y=34 기준):
 * 좌우 여백 20(내용 폭 320) / 잡이 36x4 #e2deda / 제목 #0e0d0b 20 / 닫기 아이콘 20x20 #463f36 /
 * 링크 카드 320x46 #f9f9f9 + 1px #e2deda radius 8 / 원 지름 52, 중심 간격 82.7 / 라벨 #463f36 12 /
 * CTA 320x52 #333333 radius 26 + 흰 라벨 16.
 *
 * 시안에서 읽을 수 없는 값(스크림 농도, 시트 상단 radius)만 같은 흐름의 PhotoGuideSheet
 * (`photo-example-bottomsheet`)에서 그대로 가져왔다 — 같은 화면에서 올라오는 시트 둘이 다른 값을
 * 쓰면 다른 물건처럼 보인다. 그 밖의 값은 전부 시안 실측이고, 근거가 다른 것만 아래에 따로 적었다.
 */

/** 시안: 원 지름 52 (y 204~255). radius는 그 절반 */
const ICON_CIRCLE_SIZE = 52;

/**
 * 아이콘 한 칸의 폭.
 *
 * 시안의 원 중심은 카드 왼쪽에서 56 / 139 / 221 / 304 에 있다(간격 82.7). 내용 폭 320 안에서
 * `space-between` + 좌우 4 여백 + 칸 폭 64면 중심이 56과 304에 떨어져 시안과 맞는다.
 * 칸을 원(52)보다 넓게 잡는 건 시안 간격을 맞추기 위해서다. 라벨은 가장 긴 "더보기"도 Pretendard
 * 12px에서 40dp가 안 돼 이 폭 안에서 말줄임되지 않는다.
 */
const ICON_ITEM_WIDTH = 64;
const ICON_ROW_PADDING_HORIZONTAL = 4;

/**
 * 시안: CTA 320x52, radius 26 = **알약**.
 *
 * 앞서 적혀 있던 20은 눈대중이었고 틀렸다. 시안 PNG의 CTA 화소를 다시 재서 고친 값이다:
 * - 어두운(#333333) 영역은 x 44~363(=320), y 302~353(=52). 기록해 둔 폭·높이는 그대로 맞는다.
 * - 모서리를 서브픽셀로 뽑았다. 각 행의 왼쪽 경계를 "덮인 넓이"로 재면(안티에일리어싱 농도를
 *   그대로 쓰면 화소 격자보다 잘게 읽힌다) 위 25행의 경계가 나오는데, 여기에 중심 (44+r, 302+r)
 *   원을 최소제곱으로 맞추면 **r = 26.00, 잔차 RMS 0.04px**로 떨어진다. r=20은 잔차 1.93px,
 *   r=24는 0.63px로 확연히 나쁘다. 즉 곡률이 끊기는 지점이 없다 — 직선 구간이 아예 없는 알약이다.
 * - 26은 높이의 정확히 절반(52/2)이라는 점에서도 알약이 맞다.
 *
 * 그래서 이 값은 borderRadius 999와 **화면상 완전히 같게 그려진다**(높이가 52로 고정이라).
 * 999가 아니라 26을 적는 건 시안에서 잰 값을 그대로 남겨 두기 위해서다 — 높이가 바뀌면
 * 알약이 아니게 되므로, 다음 사람이 높이를 건드릴 때 이 값도 같이 보게 된다.
 */
const CTA_HEIGHT = 52;
const CTA_RADIUS = CTA_HEIGHT / 2;

/**
 * 복사 안내와 CTA 사이 간격.
 *
 * 화면 토스트가 하단 요소 위에 두는 간격(`components/Toast/styles.ts`의 TOAST_GAP)과 같은 값이다 —
 * 같은 말풍선이 화면마다 다른 높이에 떠 있으면 그게 곧 어긋나 보인다.
 */
const NOTICE_GAP = 16;

export const shareSheetStyles = StyleSheet.create({
  // 시안에 없음 — PhotoGuideSheet의 Dark_Overlay(#000 55%)를 그대로 쓴다
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayPress: { flex: 1 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    // 시안에 없음(시안은 네 모서리가 다 둥근 카드로 그려져 있다) — 아래 두 모서리는 화면 밖이라
    // 위쪽만 살리고, 값은 PhotoGuideSheet와 같은 32를 쓴다
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // 시안: 내용 왼쪽 44, 오른쪽 363 → 360 카드에서 좌우 20
    paddingHorizontal: 20,
    // 시안: 제목행 → 링크 카드 24, 링크 카드 → 아이콘 행 25, 아이콘 행 → CTA 21
    gap: 24,
  },

  /** 끌어내려 닫을 수 있는 영역(잡이 + 제목행). 시안: 잡이 위 20 */
  dragArea: { paddingTop: 20, gap: 22 },

  // 시안: 잡이 36x4 #e2deda, 카드 위에서 20
  handleRow: { alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 999, backgroundColor: '#e2deda' },

  /** 제목과 닫기 버튼이 같은 줄에 있고 세로 중심이 맞는다(시안: 둘 다 중심 y=95.5) */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    // 시안 실측색. 디자인 시스템의 제목색(#2a2621)보다 한 톤 어둡다
    color: '#0e0d0b',
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 30,
  },

  // 시안: 링크 카드 320x46, 채움 #f9f9f9, 테두리 1px #e2deda, radius 8, 좌우 안쪽 여백 16
  linkCard: {
    height: 46,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e2deda',
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // 시안: 링크 아이콘 오른쪽 끝 76 → 주소 시작 90
    gap: 12,
  },
  // 눌린 순간의 표시(pressed)는 없다 — NativeWind JSX 런타임이 Pressable의 함수형 style을 흘려서
  // `({ pressed }) => …`를 쓰면 이 아래 카드·아이콘·CTA 스타일이 통째로 사라진다. 근거는 ShareSheet.tsx 설명.
  /**
   * 링크는 한 줄로 자른다. flex 1이 있어야 남는 폭을 다 쓰고 그 폭 기준으로 말줄임이 걸린다.
   * 시안도 꼬리 말줄임이다(`.../invite/ab...`) — 주소를 눈으로 다 읽을 필요가 없다.
   */
  linkText: {
    flex: 1,
    color: '#463f36',
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 20,
  },

  /** 원형 아이콘 4개 가로 배열 */
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: ICON_ROW_PADDING_HORIZONTAL,
  },
  /** 시안: 원 아래 라벨까지 8 */
  iconItem: { width: ICON_ITEM_WIDTH, alignItems: 'center', gap: 8 },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: ICON_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    color: '#463f36',
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  /**
   * 링크 복사 CTA.
   *
   * 공용 `Button`(color="cool-neutral", size="md")은 배경 #333333·높이 52·라벨 흰 16/24까지 시안과
   * 같다. radius도 시안을 다시 재 보니 알약(26 = 높이의 절반)이라 공용 버튼의 999와 결과가 같다 —
   * 즉 "시안 radius가 20이라 공용 버튼을 못 쓴다"던 원래 이유는 없어졌다.
   *
   * 그래도 여기서 직접 그리는 건 남은 이유가 하나 있어서다: 이 시트의 `Pressable`은 style을 반드시
   * 객체로 줘야 하는데(NativeWind JSX 런타임이 함수형 style을 흘린다 — ShareSheet.tsx 설명),
   * 공용 `Button`이 내부에서 무엇을 쓰는지에 이 시트의 레이아웃을 걸어 두고 싶지 않다. 실제로 그
   * 문제로 CTA가 화면에서 사라진 적이 있다. 공용 버튼으로 되돌리는 건 기기에서 높이 52가 그대로
   * 나오는 걸 확인한 다음에 할 일이다. 연타 방지는 지금도 공용 버튼과 같은 `useSinglePress`를 쓴다.
   */
  cta: {
    height: CTA_HEIGHT,
    borderRadius: CTA_RADIUS,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * CTA와 그 위 안내를 함께 담는 칸. **높이가 정확히 CTA 하나**(패딩·여백 없음)다.
   *
   * 안내를 시트에 직접 절대배치하지 않는 이유: 시트는 아래 패딩(홈 인디케이터 몫)을 갖는데,
   * 절대배치의 `bottom`이 그 패딩 안쪽에서 재는지 바깥쪽에서 재는지에 따라 안내가 CTA 위로 뜨기도
   * 하고 버튼을 덮기도 한다. 패딩이 없는 이 칸을 기준으로 삼으면 두 해석이 같은 자리를 가리킨다.
   */
  ctaBlock: { position: 'relative' },
  /**
   * 복사 안내가 뜨는 자리. **CTA 위로 {@link NOTICE_GAP}만큼 띄운다**(사용자 지시).
   *
   * 시트 흐름에 넣지 않는 이유: 안내가 나타났다 사라질 때마다 시트 높이가 바뀌고,
   * 그러면 `onLayout`으로 잰 높이가 흔들려 닫기 애니메이션 거리까지 함께 튄다.
   */
  noticeLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: CTA_HEIGHT + NOTICE_GAP,
    alignItems: 'center',
  },
  ctaLabel: {
    color: '#ffffff',
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 24,
  },
});

/**
 * 원마다 다른 배경·글리프 색.
 *
 * **시안 네 원을 화소로 다시 읽은 결과(각 원 안에서 가장 많이 쓰인 색 = 배경, 가장 어두운 색 = 글리프):**
 * | 자리 | 앱        | 배경      | 글리프    | 규칙                       |
 * | ---- | --------- | --------- | --------- | -------------------------- |
 * | 1    | 카카오톡  | `#fee500` | `#3c1e1e` | **브랜드색 꽉 채움 + 채운 글리프** |
 * | 2    | 메일      | `#ebf9fd` | `#0d9488` | 연한 배경 + 선 글리프      |
 * | 3    | 인스타그램| `#ffe5ec` | `#db2777` | 연한 배경 + 선 글리프      |
 * | 4    | 더보기    | `#f3f4f6` | `#463f36` | 연한 배경 + 채운 점        |
 *
 * 그러니까 시안은 "전부 연한 배경 + 진한 글리프"가 아니다. **첫 칸만 브랜드색을 원 전체에 깔고**
 * 나머지 세 칸이 연한 배경을 쓴다. 이 구분이 아래 라인 색의 근거다.
 *
 * 목록이 시안과 달라진 경위: 카카오톡은 임의 텍스트를 보내는 공개 URL scheme이 없고
 * (`kakaolink://`는 Kakao SDK와 앱키 등록이 필요한데 이 저장소엔 없다), 인스타그램도 텍스트를
 * 실어 보내는 공개 경로가 없어 둘 다 빠졌다. 그 자리를 라인·문자가 채웠다.
 */
export const SHARE_ICON_COLORS = {
  /**
   * 라인 — 원 전체를 라인 브랜드 그린 `#06c755`으로 채우고 글리프를 흰색으로 둔다.
   *
   * 근거: 이 자리는 시안에서 카카오톡이었고, 시안의 첫 칸은 **브랜드색을 원에 꽉 채우고 글리프를
   * 그 위에 얹는** 자리다(`#fee500` 배경 + `#3c1e1e` 채운 말풍선). 라인은 그 자리를 그대로
   * 물려받으므로 같은 대접을 한다 — 옅은 초록 배경 + 초록 글리프로 두면 오히려 시안의 첫 칸보다
   * 가벼워져서 네 원의 무게가 어긋난다.
   *
   * 덤으로 이게 네 원을 가장 잘 갈라 놓는다: 꽉 찬 초록 하나 + 연한 분홍·하늘·회색 셋.
   */
  line: { background: '#06c755', glyph: '#ffffff' },
  /**
   * 문자 — 시안 3번째 원(인스타그램)이 쓰던 분홍 짝 `#ffe5ec` / `#db2777`을 그대로 가져왔다.
   *
   * 원래 여기엔 blue-50/blue-600(`#eff6ff`/`#2563eb`)을 새로 만들어 넣었는데, 옆의 메일이
   * 청록(`#0d9488`)이라 둘이 붙어 보여 구분이 안 된다는 지적을 받았다. 라인이 초록으로 가면서
   * 파랑·청록·초록이 한쪽에 몰리기도 했다.
   *
   * 새 색을 또 지어내는 대신 **시안에 이미 있던 색**을 쓴다 — 인스타그램이 목록에서 빠지면서
   * 분홍 짝이 통째로 비었고, 이건 시안이 직접 고른 "연한 배경 + 진한 글리프" 조합이라 나머지
   * 두 연한 원과 채도·명도가 이미 맞는다. 초록·청록·회색 어디와도 겹치지 않는 계열이다.
   */
  sms: { background: '#ffe5ec', glyph: '#db2777' },
  // 시안 2번째 원(메일)의 색 그대로
  mail: { background: '#ebf9fd', glyph: '#0d9488' },
  // 시안 4번째 원 그대로
  more: { background: '#f3f4f6', glyph: '#463f36' },
} as const;

/**
 * 링크 카드 왼쪽 글리프(시안: 18x18 #7c6e5e).
 *
 * 앞서 16으로 적혀 있었으나 다시 재니 18이다. 시안에서 이 아이콘의 잉크는 x 60~78, y 148~166에
 * 걸쳐 있다(카드 안쪽 왼쪽 44 + 여백 16 = 60에서 시작해 18칸). 16이면 60~76이라 오른쪽 2칸이
 * 잘린다. 폭 18이 맞다는 건 본문 위치로도 확인된다 — 18 + `linkCard.gap` 12 = 90이고,
 * 시안에서 주소 첫 글자의 잉크가 실제로 x=91에서 시작한다(글자 좌측 여백 1px).
 *
 * 색은 다시 재도 `#7c6e5e` 그대로다(글리프 안에서 가장 진한 화소가 정확히 이 값, 불투명도 100%).
 */
export const LINK_GLYPH_SIZE = 18;
export const LINK_GLYPH_COLOR = '#7c6e5e';
/**
 * 사슬 글리프의 선 두께(24 viewBox 기준).
 *
 * 시안에서 잰 선은 약 1.8dp다. 이 글리프는 24 좌표계로 그려 18dp로 줄여 그리므로
 * 1.8 x (24 / 18) = 2.4가 되어야 하고, 실측에 맞춘 값이 2.36이다.
 * 원 안 글리프들(`GLYPH_STROKE` 2)과 달리 이 값만 따로인 건 크기가 24가 아니라 18이기 때문이다.
 */
export const LINK_GLYPH_STROKE = 2.36;

/** 닫기 아이콘(시안: 20x20 원 테두리 + X, #463f36) */
export const CLOSE_ICON_SIZE = 20;
export const CLOSE_ICON_COLOR = '#463f36';

/**
 * 닫기 버튼의 손가락 여유.
 *
 * 시안에 없음 — 근거: 아이콘이 20x20이라 그대로 두면 터치 목표 최소치(44x44)에 못 미친다.
 * 14를 사방에 더하면 48x48이 되고, 제목과는 200dp 넘게 떨어져 있어 서로 삼키지 않는다.
 */
export const CLOSE_HIT_SLOP = { top: 14, bottom: 14, left: 14, right: 14 } as const;
