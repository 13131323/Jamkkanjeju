/**
 * GET /api/v1/missions/{missionType}/{missionId} 응답 → MissionIntroLayout prop 변환.
 *
 * 서버는 제목·설명·단계·남은 보상만 내려준다. 색·장식 이미지·CTA는 디자인 값이라
 * MISSION_INTRO_CONFIG에 그대로 남고, 여기서 만드는 값이 그 위에 덮인다.
 */
import type { GeneratedApi } from '@packages/shared';
import type { ImageSourcePropType } from 'react-native';
import type { MissionReward, MissionStep } from '@/components/Mission/MissionIntroLayout/MissionIntroLayout';
import type { MissionType } from './mission';

/** 화면 미션 종류 → 서버 path enum */
export const MISSION_TYPE_INPUT: Record<MissionType, GeneratedApi.MissionTypeInput> = {
  culture: 'CULTURE',
  treasure: 'TREASURE',
  coop: 'COOPERATIVE',
};

/**
 * 폴백 missionId.
 *
 * 평소에는 web Home이 브릿지 NAVIGATE로 실제 id를 보낸다. 이 값은 그게 없을 때만 쓰인다 —
 * missionId를 싣지 않는 옛 web 빌드가 WebView에 남아 있거나, 앱 안에서 인트로로
 * 되돌아오는 경로(culture.tsx의 "그만두기" 등)로 들어온 경우다.
 */
export const FALLBACK_MISSION_ID: Record<MissionType, number> = {
  culture: 1,
  treasure: 1,
  coop: 1,
};

/**
 * 라우트 파라미터의 missionId를 숫자로 바꾼다.
 *
 * expo-router 파라미터는 항상 문자열이고, 링크로 아무 값이나 들어올 수 있다.
 * 유효한 양의 정수가 아니면 폴백을 쓴다 — 잘못된 값을 그대로 보내면 404가 난다.
 */
export function resolveMissionId(rawMissionId: string | undefined, missionType: MissionType): number {
  const parsed = Number(rawMissionId);

  if (!Number.isInteger(parsed) || parsed <= 0) return FALLBACK_MISSION_ID[missionType];
  return parsed;
}

export interface MissionTitleParts {
  leading: string;
  trailing: string;
}

/**
 * 서버의 missionTitle 한 문자열을 레이아웃의 두 조각으로 나눈다.
 *
 * 레이아웃은 leading과 trailing 사이(또는 위)에 장식 이미지를 얹는 구조라 두 조각이 필요하다.
 * 마지막 공백에서 자르면 "함께 키우는 귤나무", "보물 찾기"가 디자인과 같은 분리가 된다.
 */
export function splitMissionTitle(missionTitle: string): MissionTitleParts {
  const title = missionTitle.trim();
  const lastSpace = title.lastIndexOf(' ');

  // 공백이 없으면 강조 조각(trailing)에 넣는다 — leading에 넣으면 색이 다른 뒷조각이 비어
  // 제목이 통째로 사라진 것처럼 보인다.
  if (lastSpace === -1) return { leading: '', trailing: title };

  return { leading: title.slice(0, lastSpace), trailing: title.slice(lastSpace + 1) };
}

export function toMissionSteps(steps: GeneratedApi.MissionStepResponse[]): MissionStep[] {
  return steps.map((step) => ({
    number: step.step,
    title: step.stepTitle,
    description: step.description,
  }));
}

/**
 * 번들로 들고 있어야 하는 보상 이미지.
 *
 * 포인트·쿠폰은 종류가 하나뿐인 고정 에셋이다. AR 캐릭터는 종류가 늘어나므로 서버가
 * imageUrl로 내려주지만, 그 URL이 죽어 있을 때 대신 그릴 그림도 번들에 있어야 한다
 * (arCharacter — 아래 toMissionRewards의 fallbackImage 주석 참고).
 */
export interface MissionRewardImages {
  arCharacter: ImageSourcePropType;
  point: ImageSourcePropType;
  coupon: ImageSourcePropType;
}

/**
 * 남은 보상만 배지로 만든다.
 *
 * 서버 계약이 remainingReward를 "아직 한 번도 지급되지 않은 미션 보상"으로 정의하고
 * 지급된 항목을 null로 준다(openapi RemainingRewardResponse). 그래서 null을 걸러내는 건
 * 의도된 동작이고, 보상을 다 받은 미션에 다시 들어오면 빈 배열이 된다 —
 * 그 빈 상태는 레이아웃이 "모두 받았어요" 문구로 처리한다(MissionIntroLayout).
 */
export function toMissionRewards(remainingReward: GeneratedApi.RemainingRewardResponse, images: MissionRewardImages): MissionReward[] {
  const rewards: MissionReward[] = [];

  const { arCharacter, point, coupon } = remainingReward;

  if (arCharacter) {
    // 캐릭터 그림은 서버가 준 URL을 그대로 띄운다. 다만 현재 서버가 주는 호스트
    // (cdn.jamkkan-jeju.dev)는 DNS가 없어서(NXDOMAIN) 로드가 실패하고 원이 통째로 비어
    // 보상이 2개만 있는 것처럼 보인다. CDN이 살아나면 실제 그림이 그대로 나와야 하므로
    // URL은 그대로 두고, 실패했을 때만 갈아끼울 번들 그림을 함께 넘긴다.
    //
    // cache: 'force-cache'(iOS)는 서버 cache-control 헤더와 무관하게 한 번 받은 그림을 그대로
    // 재사용한다 — 헤더가 no-cache면 리렌더마다 다시 받아 깜빡이므로 우선순위를 명시한다.
    rewards.push({ image: { uri: arCharacter.imageUrl, cache: 'force-cache' }, fallbackImage: images.arCharacter, label: arCharacter.name });
  }
  // 0P도 서버가 내려주면 남은 보상이다 — null(지급 완료)과 구분해야 하므로 falsy 검사를 쓰지 않는다.
  if (point !== null && point !== undefined) {
    rewards.push({ image: images.point, label: `+${point}P` });
  }
  if (coupon) {
    rewards.push({
      image: images.coupon,
      label: `${coupon.couponPrice.toLocaleString('ko-KR')}원 쿠폰`,
    });
  }

  return rewards;
}
