import { StyleSheet } from 'react-native';
import { BUTTON_MD_HEIGHT } from '@/components/Button/styles';
import { CTA_BOTTOM_GAP } from '@/styles/safeArea';

/**
 * 토스트 스타일.
 *
 * `dark`(기본): Penpot에 전용 프레임을 찾지 못해 디자인 시스템 토큰(cool-neutral 계열,
 * radius-lg, label-md 16/24)으로 구성했다. 디자인이 확정되면 수치만 맞춘다.
 *
 * `guide`: Penpot TreasureHunt_step0의 "BottomArea"를 그대로 옮겼다 —
 * 흰 반투명(0.72) 배경 / radius 30 / 패딩 12·16 / 텍스트 14·1.57 #0e0d0b.
 * 디자인의 34x34 아이콘(Labels/Rectangle 1)은 HIDDEN이라 그리지 않는다.
 */
/** 토스트와 그 아래 요소 사이의 간격 */
export const TOAST_GAP = 16;

/**
 * 하단 CTA 버튼을 비켜 가기 위한 여유.
 *
 * 토스트를 쓰는 화면(협동 미션 step1~3, 보물찾기 step0)은 모두 하단에 md 버튼 CTA가
 * 고정돼 있다. 화면 아래에서 TOAST_GAP만 띄우면 토스트가 그 버튼을 덮으므로, 버튼 높이만큼
 * 더 올려 **CTA 버튼 위로 같은 간격**이 남게 한다.
 *
 * 숫자를 다시 적지 않고 버튼 스타일에서 가져온다 — 버튼 높이가 바뀌면 함께 따라가야 한다.
 */
export const TOAST_CTA_CLEARANCE = BUTTON_MD_HEIGHT;

/**
 * 협동 미션 화면(초대·재료 찾기)의 CTA를 비켜 가기 위한 여유.
 *
 * `TOAST_CTA_CLEARANCE`(버튼 높이만)를 그대로 쓰면 이 화면들에서 버튼과 4px 겹친다 —
 * CoopStepLayout·CoopStepSkeleton의 CTA는 버튼 높이(52) **위에** `ctaBottomPadding`이
 * 추가로 `CTA_BOTTOM_GAP`(20)만큼 여백을 얹기 때문이다(safeArea.ts). 기본값을 바꾸면 그 값을
 * 쓰는 다른 화면(보물찾기 등)까지 밀리므로, 여기서 버튼 높이 + CTA_BOTTOM_GAP을 따로 더해
 * 협동 미션 호출부가 옵션으로 넘긴다.
 */
export const TOAST_COOP_CTA_CLEARANCE = BUTTON_MD_HEIGHT + CTA_BOTTOM_GAP;

/**
 * WebView 화면(도감 카드 상세)의 CTA를 비켜 가기 위한 여유.
 *
 * 도감 카드의 저장 결과 토스트는 **앱이** 띄우는데, 그때 화면 아래에 깔린 "함께 사진 찍기"는
 * **web이** 그린다. 앱은 그 높이를 알 수 없으므로 web의 값을 여기 적어 둔다(사용자 지시로
 * 토스트를 그 CTA 위에 띄운다).
 *
 *   56 = 버튼 자체(py-4 상하 16 + label-lg line-height 24)
 *   20 = 그 아래 여백(`max(20px, var(--safe-area-bottom))`, 앱 WebView에서 safe-area-bottom은 0)
 *
 * **web/src/_pages/ar-character/ui/ArCharacterPage.tsx의 CTA와 짝이다 — 한쪽을 바꾸면 함께 바꾼다.**
 */
export const TOAST_WEBVIEW_CTA_CLEARANCE = 76;

export const toastStyles = StyleSheet.create({
  // 화면 위에 절대 배치. pointerEvents는 컴포넌트에서 'none'으로 둬서
  // 토스트가 떠 있는 동안에도 아래 화면을 계속 조작할 수 있게 한다.
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    maxWidth: 328,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    // 어두운 반투명 — 어떤 배경 위에서도 대비가 확보된다
    backgroundColor: 'rgba(42, 38, 33, 0.92)',
  },
  text: {
    color: '#ffffff',
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  // guide — 흰 반투명 카드. 지도(step0) 위에 떠서 안내 문구를 보여준다.
  // Penpot BottomArea: 312 폭 / r=30 / pad 12·16 / #ffffff@0.72 / shadow 0 4 8 #000000@0.14
  //
  // 한때 패딩을 10·14, 글자를 13으로 줄였다가 디자인 값(12·16 / 14)으로 되돌렸다.
  // 줄인 이유였던 "안내 문구가 두 줄로 감긴다"가 실제로는 일어나지 않는다 —
  // 문구 "500m 안에서 카메라를 켤 수 있어요"는 Pretendard Regular 14px에서 199.47dp이고,
  // 가장 좁은 320dp 기기에서도 글자가 쓸 수 있는 폭이 320 − 32(layer) − 32(이 패딩) = 256dp라
  // 한 줄에 들어간다. 아래 장소 소개 카드와의 간격은 이 패딩이 아니라
  // useTreasureDistanceToast의 SUMMARY_CARD_EXTRA_GAP이 담당한다.
  //
  // 그림자(shadow*/elevation)는 걸지 않는다 — Android는 elevation을 뷰 뒤에 그리고 배경이
  // 반투명(0.72)이라 그게 통과해 비친다. 가장자리만 진해지고 가운데가 옅어져 띠가 생겼다.
  guideToast: {
    // 폭을 장소 소개 카드와 **같게** 맞춘다. layer의 좌우 패딩 16이 카드의 left/right 16과
    // 같으므로, stretch로 늘리면 두 요소의 좌우 끝이 정확히 일치한다. 내용 크기로 줄어들게 두면
    // 문구 길이마다 폭이 달라져 바로 아래 카드와 어긋나 보였다.
    alignSelf: 'stretch',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  guideText: {
    color: '#0e0d0b',
    fontFamily: 'Pretendard-Regular',
    // Penpot BottomArea의 14 / 1.57 그대로다(1.57 × 14 = 21.98 → 22)
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
