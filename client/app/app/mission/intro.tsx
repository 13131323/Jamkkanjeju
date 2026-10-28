import { useLocalSearchParams } from 'expo-router';
import { MissionAlreadyCompleteLayout } from '@/components/Mission/MissionAlreadyCompleteLayout/MissionAlreadyCompleteLayout';
import { MissionIntroLayout } from '@/components/Mission/MissionIntroLayout/MissionIntroLayout';
import { TreasureMapPrefetch } from '@/components/Treasure/TreasureMapPrefetch/TreasureMapPrefetch';
import { MISSION_INTRO_CONFIG, resolveMissionType } from '@/constants/mission';
import { MISSION_TYPE_INPUT, resolveMissionId, splitMissionTitle, toMissionRewards, toMissionSteps } from '@/constants/missionHome';
import { isRewardExhausted, toNearbyMissionSummaries, toRewardCoupons } from '@packages/shared';
import { useCurrentCoordsOnce } from '@/hooks/useCurrentCoordsOnce';
import { useEnterCoopRoom } from '@/hooks/useEnterCoopRoom';
import { useMissionLocationPermission } from '@/hooks/useMissionLocationPermission';
import { useGetMissionHomeApiV1MissionsMissionTypeMissionIdGet } from '@/services/api/mission/mission';
import { useTreasureCompletion } from '@/services/treasureCompletion';
import { navigate } from '@/utils/navigate';

/**
 * 완료 화면 상단 캐릭터의 폴백.
 *
 * 서버가 주는 arCharacterImageUrl이 우선이지만 시드 데이터의 이미지 호스트가 아직 살아 있지 않아
 * 지금은 그 URL이 전부 실패한다. 폴백이 없으면 캐릭터 자리가 통째로 비므로 번들 에셋을 넘긴다.
 */
const TREASURE_CHARACTER_FALLBACK = require('@assets/images/treasure-ar-character.png');

/**
 * 번들 보상 배지 이미지.
 *
 * 포인트·쿠폰은 종류가 하나뿐이라 그대로 쓴다. AR 캐릭터는 종류가 늘어나 서버가 준 imageUrl을
 * 쓰지만, 그 URL이 실패했을 때 그릴 그림이 필요하다 — 서버 연결 전 디자인이 쓰던 돌담이 에셋을
 * 폴백으로 넘긴다(교체 시점은 MissionIntroLayout의 RewardImage).
 */
const REWARD_IMAGES = {
  arCharacter: require('@assets/images/reward-dolmeong.png'),
  point: require('@assets/images/reward-point.png'),
  coupon: require('@assets/images/reward-coupon.png'),
};

export default function MissionIntroScreen() {
  const { mission, missionId: rawMissionId } = useLocalSearchParams<{ mission?: string; missionId?: string }>();
  const missionType = resolveMissionType(mission);
  const config = MISSION_INTRO_CONFIG[missionType];
  const missionId = resolveMissionId(rawMissionId, missionType);

  // missionId는 web Home이 브릿지 NAVIGATE로 보낸다. 앱 안에서 되돌아온 경로처럼
  // 파라미터가 없으면 폴백 id를 쓴다(constants/missionHome.ts).
  const { data: missionHome, isPending: isMissionHomePending } = useGetMissionHomeApiV1MissionsMissionTypeMissionIdGet(MISSION_TYPE_INPUT[missionType], missionId);

  // 서버는 문구·단계·남은 보상만 준다. 색·장식·CTA는 디자인 값이라 config가 계속 들고 있다.
  const missionTitle = missionHome ? splitMissionTitle(missionHome.missionTitle) : null;
  const serverContent = missionHome
    ? {
        titleLeading: missionTitle?.leading ?? config.titleLeading,
        titleTrailing: missionTitle?.trailing ?? config.titleTrailing,
        subtitle: missionHome.description,
        steps: toMissionSteps(missionHome.steps),
        rewards: toMissionRewards(missionHome.remainingReward, REWARD_IMAGES),
      }
    : null;

  // 방 열기와 단계별 라우팅은 이어하기와 공유한다(hooks/useEnterCoopRoom.ts)
  const enterCoopRoom = useEnterCoopRoom();

  const isTreasure = missionType === 'treasure';
  // 이미 완료한 보물찾기에 다시 들어온 경우는 intro 대신 완료 화면을 보여준다(prompt §9).
  //
  // 판정을 로컬 스토어(treasureProgress.completedAt)에서 서버 응답으로 옮겼다 — 스토어 값은
  // 이 기기에서 완료한 것만 알아서 기기를 바꾸면 완료 화면이 사라졌다. 서버는 완료 여부를 직접
  // 주지 않으므로 "남은 보상이 세 종류 모두 없음"으로 읽는다(completion API 호출 트리거와 같은 조건).
  const showAlreadyComplete = isTreasure && isRewardExhausted(missionHome?.remainingReward);

  const ensureLocationGranted = useMissionLocationPermission(!showAlreadyComplete);

  // 추천 목록이 거리순이라 좌표가 필수 query다. 완료 화면일 때만 읽는다.
  const currentCoords = useCurrentCoordsOnce(showAlreadyComplete);
  const { data: completion } = useTreasureCompletion(missionId, currentCoords, { enabled: showAlreadyComplete });


  // 미션 종류와 무관하게 위치 권한을 먼저 받고, 허용된 경우에만 다음 화면으로 넘긴다.
  const handleCtaPress = () => {
    void (async () => {
      if (!(await ensureLocationGranted())) return;

      if (isTreasure) {
        // 보물찾기도 진행도를 만들 때 미션 id가 필요하다(POST .../{treasureMissionId}/progress)
        navigate.push({ pathname: '/mission/treasure', params: { missionId: String(missionId) } });
        return;
      }
      if (missionType === 'coop') {
        await enterCoopRoom(missionId, 'push');
        return;
      }
      // 문화 미션은 진행도를 만들 때 CULTURE_MISSION.id가 필요하다
      navigate.push({ pathname: '/mission/culture', params: { missionId: String(missionId) } });
    })();
  };

  // 완료로 판정됐지만 completion 응답을 아직 못 받았으면 intro 골격의 스켈레톤을 그대로 쓴다 —
  // 여기서 intro 내용을 보여주면 완료한 미션에 "미션 시작하기"가 한 번 스쳐 지나간다.
  if (showAlreadyComplete && !completion) {
    return <MissionIntroLayout {...config} loading onCtaPress={() => undefined} onBack={() => navigate.replace('/home')} />;
  }

  if (showAlreadyComplete && completion) {
    return (
      <MissionAlreadyCompleteLayout
        // 디자인 보드 배경 #e2f2d2 → #f1f9e8 / 장식 원 #e2f2d2 → #b0da8b
        backgroundColors={['#e2f2d2', '#f1f9e8']}
        circleColors={['#e2f2d2', '#b0da8b']}
        title="보물 찾기 완료"
        completedAt={completion.completedMission.completedAt}
        characterImageUrl={completion.completedMission.arCharacterImageUrl}
        characterFallback={TREASURE_CHARACTER_FALLBACK}
        nearbyMissions={toNearbyMissionSummaries(completion.nearbyTreasureMissions)}
        coupons={toRewardCoupons(completion.receivedCoupons)}
        // 추천 보물찾기를 누르면 그 미션의 보물찾기 미션 홈으로 간다. replace인 이유는 같은 화면
        // 재진입이라 push하면 뒤로가기가 이전 미션의 완료 화면들을 거슬러 올라가게 되기 때문이다.
        onNearbyMissionPress={(mission) => navigate.replace({ pathname: '/mission/intro', params: { mission: 'treasure', missionId: String(mission.missionId) } })}
        // "근처에서 할 수 있는 보물 찾기 > 더보기" — web 지도의 근처 미션 목록 시트로 보낸다.
        // 좌표는 이 화면이 추천 목록을 받으려고 이미 읽어 둔 것을 그대로 넘긴다. 새 WebView에는
        // web 위치 스토어를 채우는 브릿지가 없어서, 안 넘기면 "근처"가 제주 중심 기준이 된다.
        onNearbyMorePress={() =>
          navigate.push({
            pathname: '/mission/nearby',
            params: {
              missionType: 'treasure',
              lat: currentCoords ? String(currentCoords.lat) : '',
              lng: currentCoords ? String(currentCoords.lng) : '',
            },
          })
        }
        // "사용하러 가기"는 항상 지도(web `/map?coupon=1&...`)를 띄운다.
        //
        // 예전에는 갈 장소가 없는 쿠폰(사용처와 이름이 일치하는 LOCATION이 없어 locationId가 null)을
        // 여기서 걸러 아무것도 하지 않았는데, 사용자 눈에는 버튼이 죽은 것으로 보였다. 이제는
        // 지도를 열고 쿠폰 시트만 띄운다 — 지도를 특정 장소로 옮기는 것은 locationId가 있을 때뿐이고,
        // 그 판단은 파라미터를 받은 web이 한다.
        onCouponPress={(coupon) => {
          navigate.push({
            pathname: '/coupon',
            params: {
              couponLocation: coupon.storeName,
              couponPrice: String(coupon.couponPrice),
              locationId: coupon.locationId === null ? '' : String(coupon.locationId),
              locationAddress: coupon.locationAddress ?? '',
              locationImageUrl: coupon.locationImageUrl ?? '',
            },
          });
        }}
        ctas={[
          {
            text: '방명록 남기기',
            color: 'cool-neutral',
            type: 'outline',
            // web의 방명록 작성 화면(`/travel-note/write`)을 WebView로 띄운다(app/guestbook.tsx).
            //
            // 미션 id·종류와 미션 이름을 함께 넘긴다. 좌표도 넘기는 이유: completion 응답에는
            // 이 미션을 끝낸 **장소** id가 없어 placeId를 채울 수 없고, placeId가 없는 방명록은
            // web이 좌표로 위치를 잡는다(guestbookWebUrl.ts). 추천 목록용으로 이미 읽어 둔 값이라
            // 여기서 새로 측위하지 않는다.
            onPress: () =>
              navigate.push({
                pathname: '/guestbook',
                params: {
                  missionId: String(missionId),
                  missionType: 'treasure',
                  missionTitle: missionHome?.missionTitle ?? '',
                  lat: currentCoords ? String(currentCoords.lat) : '',
                  lng: currentCoords ? String(currentCoords.lng) : '',
                },
              }),
          },
          {
            text: '보물이랑 사진찍기',
            color: 'tertiary-strong',
            /**
             * **촬영 화면으로 바로 간다**(사용자 지시). 예전에는 진행도를 비우고(restartTreasure)
             * 지도부터 다시 시작했는데, 이 버튼은 보물을 다시 찾자는 것이 아니라 캐릭터와 사진 한 장을
             * 남기자는 것이다 — 이미 끝낸 미션을 되돌릴 이유가 없어 초기화도 하지 않는다.
             *
             * 위치 권한은 그대로 확인한다. 촬영 화면 자체는 좌표가 없어도 열리지만, 그 화면이 사는
             * 라우트가 진입하면서 진행도 생성(POST .../progress)을 부르고 거기에 좌표가 들어간다.
             */
            onPress: () => {
              void (async () => {
                if (await ensureLocationGranted()) navigate.push({ pathname: '/mission/treasure', params: { missionId: String(missionId), start: 'photo' } });
              })();
            },
          },
        ]}
        onBack={() => navigate.replace('/home')}
      />
    );
  }

  return (
    <>
      <MissionIntroLayout
        {...config}
        {...serverContent}
        loading={isMissionHomePending}
        onCtaPress={handleCtaPress}
        // intro의 뒤로가기는 항상 홈이다. 미션을 아직 시작하지 않았으므로 확인 모달도 띄우지 않는다.
        // web Home에서 브릿지로 바로 진입하면 돌아갈 스택이 없기도 하다.
        onBack={() => navigate.replace('/home')}
      />
      {/* 지도 페이지를 미리 받아 둬서 "미션 시작하기" 이후 흰 화면 시간을 줄인다(prompt §9) */}
      {isTreasure && <TreasureMapPrefetch />}
    </>
  );
}
