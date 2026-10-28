import { Redirect, useLocalSearchParams } from 'expo-router';
import { MissionCompleteLayout } from '@/components/Mission/MissionCompleteLayout/MissionCompleteLayout';
import { MISSION_COMPLETE_CONFIG, MISSION_COMPLETE_NO_REWARD_SUBTITLE, resolveMissionType } from '@/constants/mission';
import { toMissionCompleteContent } from '@/constants/missionComplete';
import { useCurrentCoordsOnce } from '@/hooks/useCurrentCoordsOnce';
import { useHomeResetStore } from '@/store/homeReset';
import { useMissionCompleteStore } from '@/store/missionComplete';
import { navigate } from '@/utils/navigate';

export default function MissionCompleteScreen() {
  const { mission } = useLocalSearchParams<{ mission?: string }>();
  const missionType = resolveMissionType(mission);
  const missionConfig = MISSION_COMPLETE_CONFIG[missionType];

  // 미션 화면이 이동 직전에 넣어 둔 완료 응답(store/missionComplete.ts).
  // 종류가 다르면 직전에 끝낸 다른 미션의 값이라 무시하고 디자인 폴백을 쓴다.
  const savedResult = useMissionCompleteStore((state) => (state.mission === missionType ? state.result : null));

  // 방명록에 붙일 장소 id. 미션 진행 화면이 완료로 넘어오면서 함께 담아 둔 값이다.
  const completedLocationId = savedResult?.completedLocationId ?? null;

  // 방명록에 넘길 좌표. 장소 id가 없는 미션에서는 이 좌표가 곧 방명록의 위치가 된다.
  // 방명록 CTA가 있는 미션(보물찾기·협동)만 읽는다 — 문화는 CTA가 하나뿐이다.
  const guestbookCoords = useCurrentCoordsOnce(missionType !== 'culture');

  /**
   * "홈으로 이동하기" — /home으로 보내면서 **web도 첫 화면으로 되돌린다**(사용자 지시).
   *
   * 리셋을 함께 요청하지 않으면 라우트만 /home이 되고 WebView는 직전에 보던 web 페이지를
   * 그대로 들고 있다(store/homeReset.ts). 이동보다 먼저 요청해야 한 박자 늦지 않는다.
   */
  const requestHomeReset = useHomeResetStore((state) => state.request);
  const goHome = () => {
    requestHomeReset();
    navigate.replace('/home');
  };

  // 설정이 없는 미션 타입으로 들어오면(잘못된 딥링크) 홈으로 되돌린다.
  if (!missionConfig) {
    return <Redirect href="/home" />;
  }

  const { ctas, resultRows, placeDescription, distanceBadgeText, ...config } = missionConfig;

  // 서버가 준 보상·다음 장소가 디자인 값을 덮는다(intro.tsx가 serverContent를 얹는 것과 같은 구조)
  const { placeId, ...content } = toMissionCompleteContent(savedResult, { resultRows, placeDescription, distanceBadgeText });
  const layoutProps = {
    ...config,
    ...content,
    // 지급된 보상이 하나도 없으면 부제까지 바꿔야 한다 — config 문구는 보상을 받았다고 말한다
    subtitle: content.resultRows.length > 0 ? config.subtitle : MISSION_COMPLETE_NO_REWARD_SUBTITLE,
    // 장소 상세는 web에 있어서 앱은 /place가 WebView로 띄운다(app/place.tsx).
    // 다음 장소를 못 받았으면 열 곳이 없으므로 핸들러를 넘기지 않아 카드가 비활성이 된다.
    onPlacePress: placeId === null ? undefined : () => navigate.push({ pathname: '/place', params: { placeId: String(placeId) } }),
  };

  // CTA가 두 개인 미션(보물찾기·협동)은 "방명록 남기기 + 홈으로 이동하기"다.
  // 미션 타입으로 갈랐더니 협동이 늘 때 조건을 또 넓혀야 했으므로 개수로 판단한다.
  if (ctas.length === 2) {
    const [guestbookCta, homeCta] = ctas;
    return (
      <MissionCompleteLayout
        {...layoutProps}
        ctas={[
          {
            ...guestbookCta,
            // web의 방명록 작성 화면(`/travel-note/write`)을 WebView로 띄운다(app/guestbook.tsx).
            //
            // placeId는 미션을 진행한 화면이 스토어에 담아 둔 값이다(completedLocationId).
            // 여기서 layoutProps의 placeId를 쓰면 안 된다 — 그건 **다음** 추천 장소라
            // 가 보지도 않은 곳에 방명록이 붙는다.
            //
            // 없이 열리는 경우도 정상이다: 장소가 없는 미션(문화)과 현재 장소 id를 주지 않는
            // 미션(협동)은 null이라, web이 좌표만 받아 사용자가 장소명을 직접 적는 형태로 연다.
            onPress: () =>
              navigate.push({
                pathname: '/guestbook',
                params: {
                  missionType,
                  placeId: completedLocationId === null ? '' : String(completedLocationId),
                  lat: guestbookCoords ? String(guestbookCoords.lat) : '',
                  lng: guestbookCoords ? String(guestbookCoords.lng) : '',
                },
              }),
          },
          {
            ...homeCta,
            onPress: goHome,
          },
        ]}
      />
    );
  }

  const [homeCta] = ctas;
  return (
    <MissionCompleteLayout
      {...layoutProps}
      ctas={[
        {
          ...homeCta,
          onPress: goHome,
        },
      ]}
    />
  );
}
