'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { buildCoopInviteAppLink } from './coopInviteAppLink';
import { buildOneStoreUrl } from './oneStoreUrl';

/**
 * 초대 링크 착지 페이지 — **머무는 화면이 아니라 통로다.**
 *
 * ## 여기까지 왔다는 것은 App Link가 안 먹혔다는 뜻이다
 *
 * 앱이 깔려 있고 App Link 검증이 끝난 안드로이드 기기는 이 페이지를 거치지 않고 곧장 앱을 연다
 * (`app/app.json`의 `intentFilters` + 이 사이트의 `/.well-known/assetlinks.json`).
 * 그러니 이 페이지가 보이는 경우는 대체로 셋 중 하나다.
 *
 * 1. 앱이 없다 → 원스토어로 보내야 한다.
 * 2. 앱은 있는데 App Link가 동작하지 않았다(검증 대기, 인앱 브라우저, 데스크톱, iOS).
 * 3. 사용자가 일부러 브라우저로 열었다.
 *
 * ## 왜 스토어로 자동 이동하지 않는가
 *
 * 브라우저는 **앱 설치 여부를 알려주지 않는다.** 흔한 수법은 커스텀 스킴을 던지고 몇 초 뒤에도
 * 페이지가 살아 있으면 "앱이 없다"고 보고 스토어로 보내는 것인데, 이 추측은 위 2·3번을
 * 그대로 오판한다 — 앱이 멀쩡히 깔린 사람을 스토어로 쫓아내고, 앱 전환이 느린 기기에서는
 * 앱과 스토어가 동시에 뜬다. 그래서 갈림길을 사용자에게 넘긴다: 버튼 두 개.
 *
 * 자동으로 한 번 시도하는 것은 **앱 열기뿐이다.** 실패해도 사용자는 이 페이지에 그대로 남고,
 * 두 버튼이 눈앞에 있다.
 */
export function InviteRedirect() {
  const searchParams = useSearchParams();
  const appLink = useMemo(() => buildCoopInviteAppLink(searchParams.get('token')), [searchParams]);
  // 설치 주소는 토큰과 무관하다. 링크가 깨져 토큰이 없는 사람에게도 설치 경로는 보여 준다.
  const storeUrl = useMemo(() => buildOneStoreUrl(), []);

  const openApp = useCallback(() => {
    if (appLink === null) return;
    // `location.href`로 연다. `window.open`은 팝업 차단에 걸리고, `<a>` 클릭 흉내는
    // 인앱 브라우저에서 새 탭을 만들어 빈 화면을 남긴다.
    window.location.href = appLink;
  }, [appLink]);

  // 자동 시도는 한 번만. StrictMode의 이중 실행까지 포함해 두 번 나가면
  // 일부 브라우저가 두 번째 이동을 "리다이렉트 루프"로 보고 경고를 띄운다.
  const hasTriedRef = useRef(false);
  useEffect(() => {
    if (hasTriedRef.current) return;
    hasTriedRef.current = true;
    openApp();
  }, [openApp]);

  if (appLink === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">초대 링크가 올바르지 않아요</h1>
        <p className="text-sm text-gray-500">초대한 분에게 링크를 다시 받아주세요.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold text-gray-900">함께 귤나무를 키워요!</h1>
      <p className="text-sm text-gray-500">잠깐제주 앱에서 초대를 열고 있어요.</p>
      <button type="button" onClick={openApp} className="mt-2 rounded-full bg-[#ff8f18] px-6 py-3 text-sm font-semibold text-white">
        앱에서 열기
      </button>
      {/*
        설치 버튼은 `<a>`다. 자바스크립트 없이도 눌리고, 사용자가 새 탭으로 열 수도 있다.
        설치를 마친 뒤에는 **이 링크를 다시 누르면 된다** — 주소에 토큰이 그대로 있으므로
        그때는 App Link가 앱을 직접 열어 초대 화면까지 간다. 설치 정보를 따로 넘겨 두는
        장치(deferred deep link)는 필요 없다.
      */}
      <a href={storeUrl} className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700">
        원스토어에서 설치
      </a>
      {/*
        "바로 초대 화면으로 들어간다"고 단정하지 않는다. 앱을 처음 설치한 사람은 참여자를 식별할
        사용자 정보가 없어 시작하기(온보딩)를 먼저 마쳐야 하고, 그 뒤 링크를 한 번 더 눌러야 한다
        (앱의 `src/utils/coopInvite.ts`가 토큰을 저장해 두지 않는 이유를 적어 뒀다).
        여기서 못 지킬 약속을 하면 온보딩 화면이 "링크가 고장 났다"로 읽힌다.
      */}
      <p className="text-xs text-gray-400">앱이 열리지 않으면 위 버튼을, 앱이 없으면 아래 버튼을 눌러주세요.</p>
      <p className="text-xs text-gray-400">설치를 마친 뒤 이 링크를 다시 눌러주세요.</p>
    </main>
  );
}
