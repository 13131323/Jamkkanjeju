import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { CloseCircleIcon } from '@/components/CloseCircleIcon/CloseCircleIcon';
import { CLOSE_ICON_COLOR, CLOSE_ICON_SIZE, LINK_GLYPH_COLOR, LINK_GLYPH_SIZE, LINK_GLYPH_STROKE } from './styles';

/**
 * 공유 시트가 쓰는 글리프.
 *
 * 전부 SVG로 직접 그린다. 이모지를 쓰면 Pretendard에 글리프가 없어 시스템 글꼴로 떨어지고,
 * 그 모양이 OS/기기마다 달라 시안과 같은 인상을 보장할 수 없다. RoleVerify의 `CamIcon`과 같은 방식이다.
 *
 * **로고를 베끼지는 않되, 어느 앱인지는 알아볼 수 있게 그린다.** 공유 대상 앱을 고르는 버튼에 그 앱의
 * 마크를 쓰는 것 자체는 정상적인 용법이고, 시안도 그렇게 하고 있다(첫 원은 카카오톡 말풍선, 셋째 원은
 * 인스타그램 카메라였다). 다만 **워드마크(글자)는 그리지 않는다** — 18~24px에서는 뭉개져 읽히지도 않고,
 * 형태만 빌리는 것과 달리 상표를 그대로 복제하는 셈이 된다. 그래서 각 자리는 형태만 가져온다.
 *
 * **배포 전에 확인할 것**: 라인 마크는 아래에서 형태만 근사해 직접 그린 것이다. 실제 배포 전에는
 * LINE 공식 브랜드 에셋과 사용 가이드라인(로고 색·여백·최소 크기·사용 허가 범위)을 확인해
 * 공식 에셋으로 교체할 것.
 *
 * 원 안 글리프는 모두 24x24 viewBox로 그린다. 연한 배경 위에 얹히는 셋(문자·메일·더보기)은
 * strokeWidth 2 아웃라인으로 통일했다 — 시안의 해당 글리프가 전부 그 규격(21~22px 크기, 2px 선)이라
 * 한 규격으로 그려야 같은 무게로 보인다. **라인만 채움(fill)이다**: 그 자리는 원 전체가 브랜드색으로
 * 차서(시안의 첫 원도 그랬다) 선 글리프를 얹으면 오히려 가늘어 보인다. 자세한 근거는 `LineGlyph` 설명.
 */

interface GlyphProps {
  color: string;
}

const GLYPH_SIZE = 24;
const GLYPH_STROKE = 2;

/**
 * 라인 자리: 라인 특유의 **둥근 사각형 말풍선을 채워서** 그린다.
 *
 * 앞서는 브랜드를 피하려고 밋밋한 타원 말풍선을 뒀는데, 그러면 어느 앱으로 가는 버튼인지 알아볼 수가
 * 없어서 다시 그렸다. 라인을 라인으로 읽히게 하는 건 두 가지다 — **브랜드 그린 바탕**과 **흰 말풍선**.
 * 바탕은 원이 맡는다(`SHARE_ICON_COLORS.line`이 원을 `#06c755`로 채운다). 여기서는 그 위에
 * 올라갈 흰 말풍선만 그린다. 그래서 이 글리프만 선이 아니라 **채움(fill)**이다 — 시안의 첫 원(카카오톡)도
 * 꽉 찬 브랜드색 위에 채운 말풍선이었으므로 무게가 그대로 맞는다.
 *
 * **워드마크("LINE" 글자)는 넣지 않는다.** 52dp 원 안의 24dp 글리프에서 네 글자는 뭉개져 읽히지 않고,
 * 형태를 빌리는 것과 달리 상표를 그대로 복제하는 일이 된다. 가져온 건 형태뿐이다:
 * 세로보다 가로가 긴 둥근 사각형 몸통 + 왼쪽 아래로 빠지는 짧은 꼬리.
 *
 * 몸통과 꼬리를 따로 둔 두 도형으로 그린다. 채움이라 겹쳐도 경계선이 생기지 않아서, 문자 글리프처럼
 * 닫힌 path 하나로 묶을 필요가 없다.
 *
 * 옆의 문자 원과는 색과 무게로 갈린다(꽉 찬 초록 + 흰 채움 ↔ 연한 분홍 + 분홍 2px 선).
 *
 * **배포 전 LINE 공식 브랜드 에셋·가이드라인을 확인해 교체할 것** — 이건 형태를 근사한 그림이지
 * 공식 로고가 아니다.
 */
export function LineGlyph({ color }: GlyphProps) {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={13.4} rx={5.6} fill={color} />
      <Path d="M8.4 14.6 4.9 20.9 13.6 15.6Z" fill={color} />
    </Svg>
  );
}

/**
 * 문자 자리: 말풍선(선). 특정 앱이 아니라 OS 문자 앱으로 가는 자리라 어느 브랜드로도 읽히면 안 되므로
 * 일반적인 둥근 사각형 + 왼쪽 아래 꼬리로 그린다. 꼬리까지 한 줄(닫힌 path)로 그려야 몸통 아래 선이
 * 꼬리를 가로지르지 않는다.
 *
 * 라인 원도 말풍선이지만 둘은 무게로 갈린다 — 라인은 꽉 찬 초록 원 위의 **흰 채움** 말풍선,
 * 문자는 연한 분홍 원 위의 **분홍 2px 선** 말풍선이다(색 근거는 styles.ts의
 * `SHARE_ICON_COLORS.sms`).
 */
export function MessageGlyph({ color }: GlyphProps) {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 3h13A3.5 3.5 0 0 1 22 6.5v7a3.5 3.5 0 0 1-3.5 3.5h-5.6L8 21.2V17H5.5A3.5 3.5 0 0 1 2 13.5v-7A3.5 3.5 0 0 1 5.5 3Z"
        stroke={color}
        strokeWidth={GLYPH_STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 메일 자리: 봉투. 시안 두 번째 원의 형태 그대로다(21x18, 뚜껑 V가 중앙까지 내려온다) */
export function MailGlyph({ color }: GlyphProps) {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={4} width={20} height={16} rx={3} stroke={color} strokeWidth={GLYPH_STROKE} />
      <Path d="M2.8 5.4 12 14l9.2-8.6" stroke={color} strokeWidth={GLYPH_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 더보기 자리: 가로 점 3개. 시안 실측 — 지름 4, 중심 간격 7(전체 폭 16) */
export function MoreGlyph({ color }: GlyphProps) {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={12} r={2} fill={color} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Circle cx={19} cy={12} r={2} fill={color} />
    </Svg>
  );
}

/**
 * 링크 카드 왼쪽의 사슬 글리프. **시안(ShareBottomSheetContainer.png)을 화소로 재서 다시 그렸다.**
 *
 * 앞서는 고리 두 개가 각각 끊어진 호(弧)이고 그 사이를 잇는 형태로 그려 뒀는데, 시안은 그게 아니라
 * **닫힌 알약(stadium) 고리 두 개가 같은 대각선 위에서 겹쳐 물린** 모양이다. 형태 자체가 달라서 새로 그렸다.
 *
 * **시안에서 잰 값 → 이 path의 대응** (시안 1px = 1dp, 글리프 잉크는 x 60~78 / y 148~166.
 * 아래 좌표는 그 18x18을 24 viewBox로 옮긴 것이라 1 viewBox 단위 = 0.75dp):
 *
 * | 시안 실측                              | 여기 값                                   |
 * | -------------------------------------- | ----------------------------------------- |
 * | 고리 하나의 바깥 크기 10.7 x 7.4dp     | 14.3 x 9.9 (= 알약, 반지름 4.95 = 높이/2) |
 * | 선 두께 약 1.8dp                       | `strokeWidth` 2.36                        |
 * | 고리 장축 기울기 약 -45°               | 아래 좌표에 이미 45°로 돌려 넣었다        |
 * | 두 고리 중심 간 거리 8dp (대각선 방향) | 중심 (15.47, 8.53)과 (8.53, 15.47)        |
 * | 글리프 색                              | `#7c6e5e` (`LINK_GLYPH_COLOR`)            |
 *
 * 값을 눈대중으로 고르지 않았다. 이 파라미터들은 시안 화소의 잉크 농도를 목표로 두고 후보 도형을 실제로
 * 래스터화해 맞춘 것이고, 최종 path의 잔차는 화소당 RMS 0.14(잉크 0~1 기준)다 — 같은 모델로 얻을 수 있는
 * 최소값(0.142)과 사실상 같다.
 *
 * 두 고리를 그냥 겹쳐 그린다. 시안은 겹치는 자리에서 한쪽 선을 살짝 끊어 물린 것처럼 보이게 했지만,
 * 그 끊김까지 재현해도 잔차가 0.134로 거의 나아지지 않는다(18dp에서 끊김 폭이 0.5dp라 보이지 않는다).
 * `Mask`를 쓸 값어치가 없어 넣지 않았다.
 *
 * 두 path는 (12,12)를 중심으로 서로 180° 돌린 같은 도형이다. 한쪽을 고치면 다른 쪽도 같이 고쳐야 한다.
 */
export function LinkGlyph() {
  return (
    <Svg width={LINK_GLYPH_SIZE} height={LINK_GLYPH_SIZE} viewBox="0 0 24 24" fill="none">
      <Path d="M10.41 6.61 13.5 3.48a4.95 4.95 0 0 1 7.04 6.97l-3.1 3.13a4.95 4.95 0 0 1-7.03-6.97Z" stroke={LINK_GLYPH_COLOR} strokeWidth={LINK_GLYPH_STROKE} strokeLinejoin="round" />
      <Path d="M3.46 13.55 6.56 10.42a4.95 4.95 0 0 1 7.03 6.97l-3.09 3.13a4.95 4.95 0 0 1-7.04-6.97Z" stroke={LINK_GLYPH_COLOR} strokeWidth={LINK_GLYPH_STROKE} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * 닫기: 원 테두리 + X.
 *
 * 구현은 공용 `CloseCircleIcon`으로 옮겼다 — 미션 중단 모달도 같은 아이콘을 쓰게 되면서
 * 두 곳이 각자 그리면 한쪽만 고쳐질 여지가 생긴다. 여기서는 이름만 이어 준다.
 */
export function CloseGlyph() {
  return <CloseCircleIcon size={CLOSE_ICON_SIZE} color={CLOSE_ICON_COLOR} />;
}
