import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { CoopStepSkeleton } from '@/components/Coop/CoopStepSkeleton/CoopStepSkeleton';
import { useToast } from '@/components/Toast/Toast';
import { useJoinCoopMission } from '@/hooks/useCoopMission';
import { getCachedSession } from '@/services/sessionCache';
import { readInviteToken, resolveCoopInviteEntry } from '@/utils/coopInvite';
import { coopInviteFailureMessage } from '@/utils/coopFailure';
import { coopTrace } from '@/utils/coopTrace';
import { navigate } from '@/utils/navigate';

/** 토큰이 없어 참여 요청조차 보낼 수 없을 때의 안내 */
const INVALID_LINK_MESSAGE = '초대 링크가 올바르지 않아요.';
/** 온보딩을 마치지 않은 기기로 링크를 연 경우 */
const NEEDS_ONBOARDING_MESSAGE = '먼저 시작하기를 마친 뒤 초대 링크를 다시 눌러주세요.';

/**
 * 초대 딥링크 착지 화면 — **화면이 아니라 통로다.**
 *
 * ## 왜 라우트 파일이 아니라 컴포넌트인가
 *
 * 초대 링크는 **두 개의 서로 다른 경로로** 앱에 들어온다.
 *
 * | 진입                      | 앱이 받는 주소                                          | 매칭되는 라우트 파일                    |
 * | ------------------------- | ------------------------------------------------------- | --------------------------------------- |
 * | Android App Link (https)  | `https://{web}/cooperative-missions/invite?token=…`      | `app/cooperative-missions/invite.tsx`   |
 * | 커스텀 스킴(web 랜딩 폴백)| `tamnalog:///mission/invite?token=…`                     | `app/mission/invite.tsx`                |
 *
 * App Link는 커스텀 스킴과 달리 **https URL을 그대로** 앱에 전달한다. expo-router는 그 URL에서
 * origin만 떼어내고 경로를 그대로 라우트에 맞춘다
 * (`expo-router/build/fork/extractPathFromURL.js`의 `extractExactPathFromURL`:
 * `url.match(/^https?:\/\//)`이면 `href.replace(origin, '')`). 호스트 화이트리스트도,
 * 경로 재작성도 없다. 그래서 **https 경로와 파일 경로가 글자 그대로 같아야** 앱이 열린 뒤
 * 화면까지 도달한다 — 다르면 "앱은 뜨는데 초대 화면이 안 나온다"가 된다.
 *
 * 두 라우트 파일은 그래서 둘 다 필요하고, 하는 일은 완전히 같아야 한다. 로직을 두 벌 두면
 * 한쪽만 고친 날 진입 경로에 따라 동작이 갈린다. 그래서 실제 내용은 여기 하나뿐이고
 * 라우트 파일 둘은 이 컴포넌트를 부르기만 한다.
 *
 * (경로 매핑을 `+native-intent.tsx`의 `redirectSystemPath`로 처리하는 방법도 expo-router에
 * 실제로 있다 — `getLinkingConfig.js`가 `./+native-intent.[tj]sx?`를 찾아 초기 URL과
 * `subscribe` 양쪽에서 호출한다. 그러나 그 훅은 **모든** 딥링크를 가로채고 그 안에서 던진
 * 예외가 앱을 죽인다. 초대 링크 하나 때문에 앱의 모든 딥링크에 위험을 얹을 이유가 없어
 * 라우트 파일을 하나 더 두는 쪽을 골랐다.)
 *
 * ## 하는 일
 *
 * 토큰으로 참여 요청을 보내고 결과에 따라 화면을 넘긴다.
 * 참여자 목록·수락 대기는 초대 화면(`mission/together.tsx`)이 이미 그리므로 그대로 넘긴다 —
 * `PENDING`이든 `ACCEPTED`든 갈 곳이 같다. 방장의 수락은 그 화면의 폴링이 알려 준다.
 *
 * 미션 id를 실어 보내지 않는 것이 중요하다. 참여 요청 응답이 이미 `missionProgressId`를 주어
 * 스토어에 방이 채워져 있고(`enterRoom`), 그 상태에서 파라미터까지 붙이면 초대 화면이
 * "방을 다시 열어야 한다"고 판단해 방 생성 요청을 한 번 더 보낸다(store/coopParty.ts의
 * `shouldOpenCoopRoom`) — 게스트가 자기 방을 새로 만들어 버린다.
 */
export function CoopInviteEntry() {
  const { show } = useToast();
  const { token: rawToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const { join } = useJoinCoopMission();

  // 한 번만 보낸다. 토스트가 뜨면 이 화면이 다시 렌더되는데, 그때마다 참여 요청이 나가면
  // 같은 방에 요청이 쌓인다(서버는 200으로 멱등하게 받지만 화면 전환은 그만큼 반복된다).
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    const entry = resolveCoopInviteEntry(readInviteToken(rawToken), getCachedSession()?.user != null);
    coopTrace('초대링크:진입', { kind: entry.kind });

    if (entry.kind === 'invalid') {
      show(INVALID_LINK_MESSAGE);
      navigate.replaceProgrammatic('/home');
      return;
    }

    if (entry.kind === 'onboarding') {
      // 사용자가 없으면 참여 요청이 통하지 않는다. 온보딩부터 시킨다(coopInvite.ts 주석).
      show(NEEDS_ONBOARDING_MESSAGE);
      navigate.replaceProgrammatic('/onboarding/step1');
      return;
    }

    void (async () => {
      const result = await join(entry.token);

      if (!result.ok) {
        // 정원 초과·시작한 미션·만료된 링크는 모두 정상 흐름의 실패다(useCoopMission.ts).
        // 문구는 coopFailure.ts가 정하고 여기서는 띄우기만 한다.
        coopTrace('초대링크:참여 실패', { failure: result.failure });
        if (!result.apiErrorNotified) show(coopInviteFailureMessage(result.failure, result.detail));
        navigate.replaceProgrammatic('/home');
        return;
      }

      // `PENDING`(수락 대기)·`ACCEPTED` 모두 초대 화면으로 간다.
      coopTrace('초대링크:참여 성공', { participantStatus: result.participantStatus });
      navigate.replaceProgrammatic('/mission/together');
    })();
    // 딥링크 파라미터는 이 화면이 사는 동안 바뀌지 않는다. 위 ref가 실행을 한 번으로 묶는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 요청이 끝나면 곧바로 다른 화면으로 넘어간다. 그동안은 협동 미션 배경 위에 세 단계가 공유하는
  // 골격만 자리표시로 그린다 — 단계 배지나 문구를 넣으면 이 대기가 어느 단계로 읽힌다.
  // 모양·이유는 CoopStepSkeleton에 있고, together.tsx의 "방 여는 중" 갈래가 같은 것을 쓴다.
  return <CoopStepSkeleton />;
}
