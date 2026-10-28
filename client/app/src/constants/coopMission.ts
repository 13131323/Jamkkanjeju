import { ImageSourcePropType } from 'react-native';

/**
 * 협동 미션 단계 화면의 정적 값.
 *
 * 화면 골격(배경·시트·CTA)은 CoopStepLayout이 들고, 단계마다 다른 문구·역할 데이터만 여기 둔다.
 */

interface CoopStepCopy {
  /** 타이틀 존의 알약 배지. Penpot Frame 193/627 (#fbe884 / #8b6f0f 13/700) */
  badge: string;
  title: string;
  subtitle: string;
}

/**
 * 단계별 문구. 둘 다 Penpot 값 그대로다.
 *
 * 역할 배정(`roles`) 문구는 없앴다 — 역할을 사용자가 고르지 않고 **랜덤으로 배정**하게 되면서
 * 그 화면 자체가 사라졌다(사용자 지시). 초대 화면의 "다음"이 배정과 단계 이동을 함께 처리한다.
 */
export const COOP_STEP_COPY: Record<'invite' | 'materials', CoopStepCopy> = {
  invite: {
    badge: '일행 초대',
    title: '함께 귤나무 키울 일행을 초대해요',
    subtitle: '각자의 자리에서 미션을 클리어하면 귤나무가 자라나요!',
  },
  materials: {
    badge: '재료 찾기',
    title: '각자 맡은 재료를 찾아주세요.',
    subtitle: '재료를 지정된 장소에서 찾아와 인증해주세요!',
  },
};

/**
 * 방장이 바뀌었을 때의 안내.
 *
 * 세 자리에서 쓴다 — 초대 화면과 재료 찾기 화면에 머무는 동안 폴링이 승계를 알아챈 경우
 * (`becameHost`), 그리고 쉬었다 다시 시작해 승계를 이어하기 응답에서 처음 알게 된 경우
 * (`hostChangedWhilePaused`). 같은 사실이므로 문구도 하나여야 한다.
 * 화면마다 적어 두면 한쪽만 고쳐진다.
 */
export const COOP_HOST_CHANGED_MESSAGE = '방장이 퇴장하여 방장이 변경되었어요';

/**
 * 누군가 참여자 목록에서 사라졌을 때의 안내. **단계에 따라 뜻이 다르다.**
 *
 * 초대 단계(1)에서 목록이 줄어드는 것은 방장이 누른 거절이다 — 수락·거절 UI가 그 화면에만 있다.
 * 재료 찾기(2·3)에는 거절이 없으므로 같은 변화가 곧 그 사람의 "포기 할래요"다.
 * 문구를 하나로 합치면 어느 쪽에서는 반드시 틀린 말이 되므로 둘로 나눠 둔다.
 */
export const coopRejectedMessage = (name: string) => `${name}님의 참여를 거절했어요`;
export const coopLeftMessage = (name: string) => `${name}님이 미션에서 나갔어요`;

/**
 * 역할 일러스트.
 *
 * 서버의 `RoleCard`에는 이미지 필드가 없어 `roleName`으로 매칭한다. 서버가 이미지 URL을 주기
 * 시작하면 이 맵 대신 응답 값을 쓰고, 매칭 실패 시의 폴백으로만 남긴다.
 * 에셋은 Penpot RoleCard > Avatar의 배치 크기(38x38) 그대로 내보냈다.
 */
export const ROLE_IMAGES: Record<string, ImageSourcePropType> = {
  물지기: require('@assets/images/coop-role-water.png'),
  땅지기: require('@assets/images/coop-role-earth.png'),
  빛지기: require('@assets/images/coop-role-light.png'),
  바람지기: require('@assets/images/coop-role-wind.png'),
  이웃지기: require('@assets/images/coop-role-neighbor.png'),
  수확지기: require('@assets/images/coop-role-harvest.png'),
};

/** 역할 이미지. 알 수 없는 역할이면 물지기 이미지로 폴백한다(빈 원보다 낫다) */
export function roleImage(roleName: string): ImageSourcePropType {
  return ROLE_IMAGES[roleName] ?? ROLE_IMAGES['물지기'];
}

/**
 * 촬영 예시 시트(`photo-example-bottomsheet`)의 내용.
 *
 * 역할과 무관한 공통 안내라 시트가 직접 들고 있지 않고 여기 둔다 —
 * 서버의 `roleCards[].pictureGuide`가 역할별 문구를 주면 시트가 둘을 함께 보여준다.
 */
export const PHOTO_GUIDE = {
  title: '촬영 예시',
  bad: {
    label: '이런 사진은 안돼요',
    emoji: '❌',
    description: '너무 멀리서 찍거나 흐릿한 사진은 인증이 어려워요.',
    image: require('@assets/images/coop-photo-bad.png') as ImageSourcePropType,
  },
  good: {
    label: '이렇게 찍어주세요',
    emoji: '✅',
    description: '가까이에서 선명하게, 대상이 잘 보이도록 찍어주세요.',
    image: require('@assets/images/coop-photo-good.png') as ImageSourcePropType,
  },
  tipsTitle: '촬영 TIP',
  tips: ['대상이 화면의 중앙에 오도록 찍어주세요', '자연광이 있는 곳에서 촬영하면 더 좋아요', '손떨림 없이 또렷하게 찍어주세요'],
  cta: '확인했어요',
} as const;

/** 디자인의 예시 사진은 한 섹션에 같은 이미지 3장이다(104x104, 간격 4) */
export const PHOTO_GUIDE_SAMPLE_COUNT = 3;
