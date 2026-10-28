import { Image, ImageSourcePropType } from 'react-native';

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
 * 심사위원용 모드의 **역할별** 가짜 인증 사진(`coopDevSimulation.ts`의 `itemPhotoByRole`).
 *
 * **서버 값이 있으면 쓰이지 않는다** — 심사위원 모드가 붙이는 가짜 팀원의 진행도에만 들어간다.
 *
 * 참여자 id가 아니라 **역할명**이 키다. 바로 옆의 "이런 장소를 찾아보세요" 칩이 역할 카드의
 * `locationToFind`에서 나오므로(RoleDetail.tsx), 사진도 역할을 따라가야 둘이 어긋나지 않는다.
 *
 * 사진은 셋뿐이라 여섯 역할을 성격으로 묶는다 — 물가(물지기·이웃지기: 계곡물, 다리·가로등이
 * 있어 마을 근처로 읽힌다) / 숲(바람지기·빛지기: 나무 사이로 하늘이 트인 숲) /
 * 흙(땅지기·수확지기: 밭 흙).
 *
 * `Image.resolveAssetSource`로 로컬 에셋을 URI 문자열로 바꾼다 — `RoleVerify`의 `photoUri`가
 * 서버가 주는 URL(string) 계약이라, 여기서 만드는 값도 같은 모양이어야 그대로 꽂힌다.
 */
const DEV_SIM_PHOTO_WATER = Image.resolveAssetSource(require('@assets/images/coop-water.jpg')).uri;
const DEV_SIM_PHOTO_WIND = Image.resolveAssetSource(require('@assets/images/coop_wind.jpg')).uri;
const DEV_SIM_PHOTO_GROUND = Image.resolveAssetSource(require('@assets/images/coop_ground.jpg')).uri;

export const DEV_SIM_ROLE_PHOTOS: Record<string, string> = {
  물지기: DEV_SIM_PHOTO_WATER,
  이웃지기: DEV_SIM_PHOTO_WATER,
  바람지기: DEV_SIM_PHOTO_WIND,
  빛지기: DEV_SIM_PHOTO_WIND,
  땅지기: DEV_SIM_PHOTO_GROUND,
  수확지기: DEV_SIM_PHOTO_GROUND,
};

/** 이미 프리페치했는지. 방을 드나들 때마다 같은 사진을 다시 받지 않게 한다 */
let hasPrefetchedDevSimPhotos = false;

/**
 * 심사위원용 사진을 미리 받아 캐시에 올려 둔다.
 *
 * step3에 닿는 순간 세 장을 한꺼번에 그리는데, 그때 처음 읽으면 사진 자리가 스켈레톤으로
 * 잠깐 남는다 — 심사 중에는 그 공백이 "사진이 없다"로 읽힌다. 방에 들어온 시점(1단계)에
 * 미리 받아 두면 3단계에서는 캐시에서 바로 뜬다.
 *
 * 개발 빌드에서 이 URI는 Metro가 서빙하는 http 주소라 실제 네트워크 왕복이 있고, 배포
 * 빌드에서는 번들 안 파일이라 prefetch가 사실상 즉시 끝난다 — 어느 쪽이든 손해가 없다.
 * 실패해도 삼킨다. 프리페치는 최적화라 실패했다고 화면을 막을 이유가 없고,
 * 그때는 `RoleVerify`가 평소처럼 직접 불러온다.
 */
export function prefetchDevSimRolePhotos(): void {
  if (hasPrefetchedDevSimPhotos) return;
  hasPrefetchedDevSimPhotos = true;

  // 역할 여섯이 사진 셋을 나눠 쓰므로 중복을 걷어내고 세 번만 받는다
  for (const uri of new Set(Object.values(DEV_SIM_ROLE_PHOTOS))) {
    Image.prefetch(uri).catch(() => {});
  }
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
