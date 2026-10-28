import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-native';
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
import { useTreasureProgressStore } from '@/store/treasureProgress';
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

  // rewards만 따로 메모이즈한다 — memo 없이 매 렌더 새로 만들면 AR 캐릭터 배지의
  // `{ uri }` 소스 객체도 매번 새 참조가 되어, URL이 그대로여도 Image가 새 소스로 보고
  // 다시 그리며 깜빡인다(위치 권한 effect 등 이미지와 무관한 상태 변화로도 리렌더가 잦다).
  // missionHome은 react-query structural sharing으로 데이터가 안 바뀌면 참조도 유지된다.
  const rewards = useMemo(() => (missionHome ? toMissionRewards(missionHome.remainingReward, REWARD_IMAGES) : []), [missionHome]);

  const serverContent = missionHome
    ? {
        titleLeading: missionTitle?.leading ?? config.titleLeading,
        titleTrailing: missionTitle?.trailing ?? config.titleTrailing,
        subtitle: missionHome.description,
        steps: toMissionSteps(missionHome.steps),
        rewards,
      }
    : null;

  // AR 캐릭터 그림을 받는 즉시 프리페치해 둔다. RewardImage가 실제로 그릴 때는 이미
  // 네이티브 캐시에 있어 공백 없이 바로 뜬다 — 위 memo가 소스 참조를, 이 prefetch가
  // 네트워크 왕복을 각각 없애야 깜빡임이 둘 다 사라진다.
  const arCharacterImageUrl = missionHome?.remainingReward?.arCharacter?.imageUrl;
  useEffect(() => {
    if (arCharacterImageUrl) void Image.prefetch(arCharacterImageUrl);
  }, [arCharacterImageUrl]);

  // 방 열기와 단계별 라우팅은 이어하기와 공유한다(hooks/useEnterCoopRoom.ts)
  const enterCoopRoom = useEnterCoopRoom();

  const isTreasure = missionType === 'treasure';
  // 이미 완료한 보물찾기에 다시 들어온 경우는 intro 대신 완료 화면을 보여준다(prompt §9).
  //
  // 판정을 로컬 스토어(treasureProgress.completedAt)에서 서버 응답으로 옮겼다 — 스토어 값은
  // 이 기기에서 완료한 것만 알아서 기기를 바꾸면 완료 화면이 사라졌다. 서버는 완료 여부를 직접
  // 주지 않으므로 "남은 보상이 세 종류 모두 없음"으로 읽는다(completion API 호출 트리거와 같은 조건).
  const showAlreadyComplete = isTreasure && isRewardExhausted(missionHome?.remainingReward);

  // intro 갈래의 진입 1회 요청. 완료 화면에서는 끄고, 대신 아래 effect가 **같은 게이트**를 돌린다 —
  // 이 훅의 진입 요청은 조용히 상태만 받아 두는 것이라 거부해도 문구가 뜨지 않는데, 완료 화면에는
  // 그 문구를 띄울 CTA("미션 시작하기")가 없어서 그대로 두면 아무 안내 없이 빈 목록만 남는다.
  const ensureLocationGranted = useMissionLocationPermission(!showAlreadyComplete);

  /**
   * 완료 화면 진입 시 위치 권한 게이트 — **미션 홈의 "미션 시작하기"와 똑같은 것**을 돌린다
   * (hooks/useMissionLocationPermission.ts의 ensureGranted: 요청 → 거부면 MISSION_LOCATION_ALERT,
   * 영구 거부라 다시 물을 수 없으면 같은 안내에 "설정 열기"를 붙인다).
   * 사용자 지시: "이미 보물 찾고 나서 뜨는 완료 화면에서도 위치 권한 요청이 한 번 더 떠야 한다".
   *
   * 이 화면이 권한을 요구하는 이유는 아래 completion 조회가 좌표를 **필수 query**로 받기 때문이다.
   * 권한이 없으면 근처 미션·쿠폰이 영영 빈 채로 남는다(services/treasureCompletion.ts의 enabled).
   *
   * 이미 허용된 기기에서는 요청이 다이얼로그 없이 granted를 돌려주고 게이트도 통과라
   * **아무것도 뜨지 않는다.**
   *
   * ref로 1회만 돌게 못 박는 이유: ensureGranted는 내부 상태(permissionStatus)에 묶인 useCallback이라
   * 요청 결과가 들어오면 identity가 바뀐다. 그것을 의존성에 둔 채 가드가 없으면 거부한 직후
   * 같은 요청과 같은 Alert가 한 번 더 돈다.
   */
  const hasAskedOnCompleteRef = useRef(false);
  const [isLocationGranted, setIsLocationGranted] = useState(false);
  useEffect(() => {
    if (!showAlreadyComplete || hasAskedOnCompleteRef.current) return;
    hasAskedOnCompleteRef.current = true;

    let isMounted = true;
    void (async () => {
      const granted = await ensureLocationGranted();
      if (isMounted) setIsLocationGranted(granted);
    })();
    return () => {
      isMounted = false;
    };
  }, [showAlreadyComplete, ensureLocationGranted]);

  // 추천 목록이 거리순이라 좌표가 필수 query다. 완료 화면일 때만 읽는다.
  //
  // 권한을 받은 뒤에 켠다. 측위는 권한 없이도 시도할 수 있지만 한 번 실패하면 useCurrentCoordsOnce가
  // 다시 시도하지 않아(효과 의존성이 enabled뿐이다) 뒤늦게 허용해도 좌표가 끝내 null이었다.
  // false → true로 바뀌는 이 값이 곧 재시도 신호가 된다.
  // 심사위원 모드는 enabled와 무관하게 고정 좌표를 돌려주므로 영향을 받지 않는다.
  const currentCoords = useCurrentCoordsOnce(showAlreadyComplete && isLocationGranted);
  const { data: completion, isLoading: isCompletionLoading } = useTreasureCompletion(missionId, currentCoords, { enabled: showAlreadyComplete });

  /**
   * 완료 화면의 날짜 폴백. 서버 응답을 못 받았을 때만 쓴다.
   *
   * 완료 시각을 조회하는 API가 따로 없어서 이 기기에서 완료했을 때의 시각을 스토어가 들고 있다
   * (store/treasureProgress.ts의 completedAt). 값이 없으면 빈 문자열이고, 배지는 날짜를 파싱하지
   * 못하면 그 자리를 비운다(MissionAlreadyCompleteLayout/formatDate.ts) — 없는 날짜를 지어내지 않는다.
   */
  const localCompletedAt = useTreasureProgressStore((state) => state.completedAt);

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

  // 완료로 판정됐고 completion 요청이 **아직 오가는 중**이면 intro 골격의 스켈레톤을 쓴다 —
  // 여기서 intro 내용을 보여주면 완료한 미션에 "미션 시작하기"가 한 번 스쳐 지나간다.
  // 로딩 중 CTA는 눌러도 갈 곳이 없으므로 MissionIntroLayout이 비활성으로 그린다(loading).
  //
  // 기준이 `!completion`이 아니라 **요청이 진행 중인지**인 것이 중요하다. 예전에는 응답이 없는
  // 동안 계속 이 스켈레톤이었는데, 그 "동안"이 끝나지 않는 경로가 둘 있다.
  // - 완료 조회 엔드포인트가 아직 배포되지 않았다(services/treasureCompletion.ts 주석). 404가
  //   나면 throwOnError:false라 data가 영원히 undefined다.
  // - 좌표가 없으면 쿼리 자체가 enabled:false다. 예전에는 완료로 판정된 동안 위치 권한을 아예
  //   요청하지 않아서 권한을 준 적 없는 기기에서는 좌표가 끝내 null이었다. 지금은 진입할 때
  //   미션 홈과 같은 게이트를 돌리지만(위 effect), 사용자가 거부하면 여전히 좌표가 없다.
  // 둘 중 하나라도 걸리면 화면이 스켈레톤에 멈추고, 살아 있어 보이는 "미션 시작하기"가 눌러도
  // 아무 일도 하지 않았다 — 사용자에게는 **"시작하기 버튼이 안 눌린다"**로 보인다.
  if (showAlreadyComplete && isCompletionLoading) {
    return <MissionIntroLayout {...config} loading onCtaPress={() => undefined} onBack={() => navigate.dismissTo('/home')} />;
  }

  // 요청이 끝났으면 응답을 못 받았더라도 완료 화면을 그린다. 근처 미션·쿠폰은 그 응답에서만 오므로
  // 비어 있을 수 있지만, 이 화면의 뼈대(제목·완료 배지·방명록·사진찍기)는 응답 없이도 성립한다.
  if (showAlreadyComplete) {
    return (
      <MissionAlreadyCompleteLayout
        // 디자인 보드 배경 #e2f2d2 → #f1f9e8 / 장식 원 #e2f2d2 → #b0da8b
        backgroundColors={['#e2f2d2', '#f1f9e8']}
        circleColors={['#e2f2d2', '#b0da8b']}
        title="보물 찾기 완료"
        completedAt={completion?.completedMission.completedAt ?? localCompletedAt ?? ''}
        characterImageUrl={completion?.completedMission.arCharacterImageUrl}
        characterFallback={TREASURE_CHARACTER_FALLBACK}
        nearbyMissions={toNearbyMissionSummaries(completion?.nearbyTreasureMissions ?? [])}
        coupons={toRewardCoupons(completion?.receivedCoupons ?? [])}
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
        onBack={() => navigate.dismissTo('/home')}
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
        onBack={() => navigate.dismissTo('/home')}
      />
      {/* 지도 페이지를 미리 받아 둬서 "미션 시작하기" 이후 흰 화면 시간을 줄인다(prompt §9) */}
      {isTreasure && <TreasureMapPrefetch />}
    </>
  );
}
