'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { env } from '@shared/config/env';
import { listenFromApp, sendToApp } from '@shared/lib/bridge/utils';
import judgeModeIcon from '@shared/lib/images/home-judge-mode-icon.png';
import { isJudgeCodeComplete, JUDGE_CODE_LENGTH, normalizeJudgeCode, verifyJudgeCode } from '../model/judgeCode';
import { resolveJudgeEnterPhase } from '../model/judgeTransition';

/** 퇴장 페이드아웃 길이. 아래 transition duration과 같아야 한다 */
const EXIT_DURATION_MS = 200;

/** 카드와 화면 가장자리 사이 최소 여백. 카드가 화면보다 길 때 위아래로 남기는 값이다 */
const EDGE_GAP = 24;

/**
 * 키패드를 뺀 실제 보이는 높이와, 키패드 상태.
 *
 * **두 환경이 서로 다른 신호를 준다.**
 * - 앱 WebView: 앱이 키패드 높이만큼 뷰를 직접 줄인다(app/src/hooks/useKeyboardInset.ts —
 *   edge-to-edge라 adjustResize가 창을 줄여 주지 않아 앱이 대신한다). → `innerHeight`가 줄고
 *   `visualViewport`와의 차이는 0이다.
 * - 일반 브라우저: 창은 그대로고 `visualViewport`만 줄어든다. → 그 차이가 키패드 높이다.
 *
 * 둘을 한 곳에서 재서 한 값으로 내보낸다. 상태 갱신이 전부 `measure` 안에서만 일어나도록
 * 묶은 것이기도 하다 — effect 본문에서 setState를 직접 부르면 react-hooks 룰에 걸린다.
 */
function useKeyboardViewport(): { visibleHeight: number; isKeyboardOpen: boolean; hasKeyboardOpened: boolean } {
  const [state, setState] = useState({ visibleHeight: 0, isKeyboardOpen: false, hasKeyboardOpened: false });

  useEffect(() => {
    // 본 적 있는 가장 큰 높이가 "키패드 없는 상태"다 — 모달은 키패드가 내려간 홈에서 열린다
    let maxHeight = 0;
    let hasKeyboardOpened = false;

    const measure = () => {
      const viewport = window.visualViewport;
      const height = window.innerHeight;
      const inset = viewport ? Math.max(0, height - viewport.height - viewport.offsetTop) : 0;
      if (height > maxHeight) maxHeight = height;

      const isKeyboardOpen = inset > KEYBOARD_MIN_HEIGHT || maxHeight - height > KEYBOARD_MIN_HEIGHT;
      if (isKeyboardOpen) hasKeyboardOpened = true;

      setState({ visibleHeight: Math.max(0, height - inset), isKeyboardOpen, hasKeyboardOpened });
    };

    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);

    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, []);

  return state;
}

/** 이보다 작게 줄어든 것은 키보드가 아니라 브라우저 주소창 같은 잔움직임으로 본다 */
const KEYBOARD_MIN_HEIGHT = 80;

/**
 * 디자인의 에러 색 3종. globals.css의 토큰 표에 빨강 계열이 아예 없어 리터럴로 둔다.
 * (Penpot 라이브러리에도 스케일 없이 낱개 컬러로만 있다 — 토큰을 새로 만들면 이 모달 하나를 위해
 * 색 체계를 늘리는 셈이라, 쓰는 자리에서 근거와 함께 박아 둔다.)
 */
const ERROR_BORDER = '#ff4d4f';
const ERROR_BACKGROUND = '#fff1f0';

/**
 * 심사위원용 모드 진입 코드 입력 모달.
 *
 * Penpot `Celebration_Modal_Card` 두 벌이 기준이다 — 기본(312×428, id `…1998a3fe4390`)과
 * 에러(312×372, id `…fb9657d4d145`). 카드는 radius 24 / #ffffff / padding 32·24·24·24 /
 * rowGap 24 / alignItems center이고 그림자는 `0 8px 24px rgba(0,0,0,0.149)`다.
 *
 * 위에서 아래로: 열쇠 84×84 → (8) "심사위원 모드" 24/36/700 → (8) 안내 두 줄(16/24/500 #463f36,
 * 14/22/400 #888888, rowGap 4) → (20) "입장 코드" 14/20/600 → (2) 입력칸 264×42 →
 * (에러일 때만 2 + 안내) → (8) "*문제가…" 12/18/400 → (24) 버튼 264×52.
 *
 * 버튼 문구는 디자인의 "확인"이 아니라 **"입장하기"**다(사용자 지시). 규격·색은 디자인 그대로다.
 *
 * 디자인의 입력칸에 보이는 원 6개(`Frame 771`)는 **별도 UI가 아니라 password 마스킹 결과**다.
 * 그래서 평범한 `type="password"` 필드 하나이고, 비어 있을 때는 placeholder가 보인다.
 * 원의 크기·간격을 디자인 수치(10 / gap 5)로 강제하지 않는다 — 브라우저가 폰트에 맞춰 그리는 값이라
 * 억지로 맞추면 placeholder 문구의 자간까지 같이 벌어진다.
 *
 * 입력칸 radius는 **8**이다. 이 레포의 `rounded-lg`는 14px(`--radius-lg`)라 디자인과 다르므로
 * 8px인 `rounded-md`를 쓴다.
 *
 * 입력칸 배경은 상태마다 다르고, 세 벌의 시안이 각각을 정한다:
 * - 비었을 때(placeholder) `#efefef` — 모달이 떠 있는 시안 home_3(`…b96902ee9250`) 안의 카드.
 *   placeholder는 14/22/400 `#aaaaaa`라 입력 글자도 같은 14px을 쓴다
 * - 입력됐을 때 `#ffffff` — 기본 카드(`…1998a3fe4390`)
 * - 틀렸을 때 `#fff1f0` + 테두리 `#ff4d4f` — 에러 카드(`…fb9657d4d145`)
 * 테두리는 세 상태 모두 1px이고 에러가 아닐 때는 `#c6c6c6`(cool-neutral-300)이다.
 *
 * 디자인과 의도적으로 다른 한 곳: **에러 카드에는 버튼이 없다.** 그대로 옮기면 한 번 틀린 사용자가
 * 다시 시도할 수단이 사라지므로, 버튼은 남기고 비활성으로만 둔다.
 *
 * 오버레이·닫기 동작은 `NavMenuModal`과 같은 방식이다(배경 탭으로 닫고, 내용은 전파를 끊는다).
 */
export function JudgeCodeModal({
  onClose,
  onSuccess,
  isReady = true,
  onBackgroundPreview,
}: {
  onClose: () => void;
  onSuccess: () => void;
  isReady?: boolean;
  /** 개발 중 배경 미리보기용 임시 통로. 실제 심사위원 코드 검증과는 무관하고, "NIGHT"/"DAY"를
   * 입력하는 즉시(6자를 안 채워도) 홈 배경을 밤/낮으로 바꿔달라고 알린다. */
  onBackgroundPreview?: (mode: 'day' | 'night') => void;
}) {
  const [code, setCode] = useState('');
  const [hasFailed, setHasFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  /** 입장에 성공해 "입장 중"을 보여주는 중인지. 시작 시각을 담아 경과 시간을 잰다 */
  const [enteringSince, setEnteringSince] = useState<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const { visibleHeight, isKeyboardOpen, hasKeyboardOpened } = useKeyboardViewport();

  /**
   * 열쇠 아이콘은 **열릴 때부터 접혀 있다**(사용자 지시).
   *
   * 모달을 열면 곧바로 코드를 입력하는 흐름이라, 폈다가 키패드가 올라오며 다시 접으면 그 자체가
   * 깜빡임으로 보인다. 그래서 처음부터 접어 두고, 키패드를 한 번 올렸다 **내린 뒤에야** 편다.
   */
  const isIconVisible = hasKeyboardOpened && !isKeyboardOpen;

  /**
   * 카드 높이를 재서 **세로 위치를 직접 계산한다.**
   *
   * flex 중앙 정렬(items-center·my-auto)을 쓰지 않는 이유: 키보드로 뷰포트가 줄면 중앙이 한 프레임에
   * 다시 잡히는데, 정렬은 transition이 걸리는 속성이 아니라 무엇을 걸어도 부드러워지지 않는다.
   * `top`은 숫자라 transition이 그대로 먹는다.
   *
   * 스크롤 컨테이너(overflow-y-auto)를 오버레이에서 걷어낸 이유도 같다 — 입력에 포커스가 가면
   * 브라우저가 그 스크롤 부모를 **제멋대로 스크롤해** 카드를 끌어올린다. 그 움직임은 우리가
   * 통제할 수 없어 깜빡임으로 보인다. 넘칠 때는 카드 자신이 스크롤한다(maxHeight + overflow-y-auto).
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    setCardHeight(card.getBoundingClientRect().height);
    // 오류 문구가 붙고 빠질 때 높이가 바뀐다 — 그때도 가운데를 다시 잡아야 한다
    const observer = new ResizeObserver((entries) => setCardHeight(entries[0].contentRect.height));
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const cardTop = Math.max(EDGE_GAP, Math.round((visibleHeight - cardHeight) / 2));

  /**
   * 닫기는 **항상 페이드아웃을 거친다.**
   *
   * 등장은 200ms 연출인데 퇴장은 곧바로 언마운트라 한쪽만 뚝 끊겼다(사용자 지적).
   * 배경 탭·입장 성공 모두 이 경로를 쓴다.
   */
  const [isDismissing, setIsDismissing] = useState(false);
  useEffect(() => {
    if (!isDismissing) return;
    const timer = setTimeout(onClose, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isDismissing, onClose]);

  /**
   * 안드로이드 하드웨어 뒤로가기로 모달을 닫는다.
   *
   * 이 모달은 React state로만 뜬다(URL·히스토리가 바뀌지 않는다) — 앱은 그 존재를 모르므로
   * 열고 닫을 때마다 알려 준다. 앱은 모달이 열린 동안 뒤로가기를 자기가 소비해 앱 종료를 막고,
   * `HARDWARE_BACK_PRESSED`로 "닫아 달라"고 되돌려 준다(HomeWebView.tsx의 BackHandler).
   * 일반 브라우저에서는 `sendToApp`·`listenFromApp` 모두 조용히 no-op이다.
   */
  useEffect(() => {
    sendToApp({ type: 'JUDGE_CODE_MODAL_STATE', payload: { isOpen: true } });

    const stopListening = listenFromApp((message) => {
      if (message.type === 'HARDWARE_BACK_PRESSED') setIsDismissing(true);
    });

    return () => {
      stopListening();
      sendToApp({ type: 'JUDGE_CODE_MODAL_STATE', payload: { isOpen: false } });
    };
  }, []);

  // 보이는 상태는 파생값이다 — 퇴장 때 setIsVisible(false)를 effect에서 부르면 렌더가 한 번 더 돈다
  // cardHeight를 재기 전 한 프레임은 자리가 틀리다 — 그 프레임은 opacity 0으로 덮는다
  const isShown = isVisible && !isDismissing && cardHeight > 0;

  /**
   * "입장 중" 구간을 언제 끝낼지 폴링한다.
   *
   * 홈 재조회가 끝났는지(isReady)는 밖에서 내려준다 — 이 컴포넌트가 useHomeData를 직접 부르면
   * features가 _pages를 import하게 되어 FSD가 깨진다.
   */
  useEffect(() => {
    if (enteringSince === null) return;

    const tick = () => {
      if (resolveJudgeEnterPhase({ elapsedMs: Date.now() - enteringSince, isReady }) === 'exiting') setIsDismissing(true);
    };
    tick();
    const timer = setInterval(tick, 50);
    return () => clearInterval(timer);
  }, [enteringSince, isReady]);

  // 실패 상태에서는 버튼을 비활성화한다(요구사항). 입력을 고치면 다시 시도할 수 있어야 하므로
  // 여기서 실패를 지운다 — 지우지 않으면 한 번 틀린 뒤 영원히 잠긴다.
  function handleChange(raw: string) {
    const normalized = normalizeJudgeCode(raw);
    setCode(normalized);
    setHasFailed(false);

    if (normalized === 'NIGHT') onBackgroundPreview?.('night');
    else if (normalized === 'DAY') onBackgroundPreview?.('day');
  }

  // 대조는 "입장하기"를 눌렀을 때 한 번만 한다 — 입력 중에 판정하면 맞는 순간 화면이 튄다.
  function handleSubmit() {
    if (verifyJudgeCode(code, env.NEXT_PUBLIC_JUDGE_MODE_CODE)) {
      // 모드는 지금 켠다(그래야 홈이 새 계정으로 조회를 시작한다). 모달은 그 조회가 끝날 때까지 남는다
      onSuccess();
      setEnteringSince(Date.now());
      return;
    }
    setHasFailed(true);
  }

  const isEntering = enteringSince !== null;
  const canSubmit = isJudgeCodeComplete(code) && !hasFailed && !isEntering;

  return (
    // 오버레이는 #000000 70%다(모달이 떠 있는 시안 home_3의 `Rectangle 5351`).
    // 좌우 24는 360 화면에서 카드 312가 가운데 설 때의 여백과 같아 카드의 left/right로 옮겼다.
    // 스크롤도 정렬도 여기서 하지 않는다 — 카드 위치는 아래 cardTop이 전부 정한다.
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-black/70 transition-opacity duration-200 ${isShown ? 'opacity-100' : 'opacity-0'}`}
      // 입장 중에는 배경 탭으로 닫히지 않는다 — 모드는 이미 켜졌고 지금은 화면이 채워지는 중이다
      onClick={() => !isEntering && setIsDismissing(true)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="심사위원 모드 진입"
        ref={cardRef}
        /* transition-all을 쓰면 안 된다 — 등장/퇴장 두 속성과 자리 이동(top)만 건다.
           easing은 BottomToolSheet와 맞춘다(ease-out). 등장은 살짝 확대된 상태(scale 1.06)에서
           제자리 크기로 줄어든다 — 최종 크기(버튼 264×52 포함)는 그대로다 */
        className={`bg-cool-neutral-white absolute flex flex-col items-center gap-6 overflow-y-auto transition-[opacity,transform,top] duration-200 ease-out ${isShown ? 'scale-100 opacity-100' : 'scale-[1.06] opacity-0'}`}
        style={{
          left: EDGE_GAP,
          right: EDGE_GAP,
          top: cardTop,
          // left/right를 함께 준 절대 요소는 maxWidth로 좁아진 만큼 auto 마진이 가운데로 민다
          marginInline: 'auto',
          maxWidth: 312,
          // 화면보다 길면 카드 안에서 스크롤한다 — 오버레이를 스크롤 부모로 두면 포커스가 갈 때
          // 브라우저가 그 부모를 제멋대로 끌어올린다(위 cardRef 주석)
          maxHeight: Math.max(0, visibleHeight - EDGE_GAP * 2),
          borderRadius: 24,
          padding: '32px 24px 24px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.149)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Frame 514 — 안내 묶음과 입력 묶음 사이 rowGap 20 */}
        <div className="flex w-full flex-col items-center gap-5">
          {/* Message_Block — 열쇠와 문구 사이 rowGap 8 */}
          <div className="flex flex-col items-center gap-2">
            {/* 카드에서 줄일 수 있는 건 이 열쇠뿐이라(입력칸·버튼은 규격을 지켜야 한다) 접었다 편다.
                펴고 접는 조건은 위 isIconVisible 주석 참고. 줄어든 높이만큼은 cardTop이 다시 가운데를 잡는다.
                단축 버튼과 같은 미디어(Penpot fillImage 01a08634-0594-…)라 에셋을 공유한다 */}
            <div className="overflow-hidden transition-[height,opacity] duration-200 ease-out" style={{ height: isIconVisible ? 84 : 0, opacity: isIconVisible ? 1 : 0 }}>
              <Image src={judgeModeIcon} alt="" aria-hidden="true" width={84} height={84} className="h-21 w-21 object-contain" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <h2 className="text-heading-h2 text-cool-neutral-950 text-center font-bold">심사위원 모드</h2>
              <div className="flex flex-col items-center gap-1">
                <p className="text-body-lg text-warm-neutral-800 text-center font-medium">초대받은 심사위원만 입장할 수 있어요.</p>
                <p className="text-body-md text-cool-neutral-500 text-center">관리자에게 받은 코드를 입력해주세요.</p>
              </div>
            </div>
          </div>

          {/* Frame 766 — 입력 묶음과 하단 안내 사이 rowGap 8 */}
          <div className="flex w-full flex-col items-start gap-2">
            {/* Frame 767 / Frame 770 — 라벨·입력칸·에러 문구 사이가 모두 rowGap 2 */}
            <div className="flex w-full flex-col items-start gap-0.5">
              <label htmlFor="judge-code" className="text-label-md text-warm-neutral-800 font-semibold">
                입장 코드
              </label>

              {/* Points_Earned_Badge 264×42, radius 8, padding 4·14. 테두리 1px은 inner라 box-border 그대로 */}
              <input
                id="judge-code"
                type="password"
                value={code}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit();
                }}
                // maxLength만으로는 붙여넣기·IME 조합을 막지 못해 normalizeJudgeCode가 한 번 더 자른다
                maxLength={JUDGE_CODE_LENGTH}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                placeholder="코드를 입력해주세요"
                aria-invalid={hasFailed}
                aria-describedby={hasFailed ? 'judge-code-error' : undefined}
                className="text-body-md text-cool-neutral-900 placeholder:text-cool-neutral-400 w-full rounded-md border transition-colors outline-none"
                style={{
                  height: 42,
                  paddingLeft: 14,
                  paddingRight: 14,
                  borderColor: hasFailed ? ERROR_BORDER : 'var(--color-cool-neutral-300)',
                  backgroundColor: hasFailed ? ERROR_BACKGROUND : code.length === 0 ? 'var(--color-cool-neutral-100)' : 'var(--color-cool-neutral-white)',
                }}
              />

              {/* 에러일 때만 그린다. 자리를 미리 비워 두면 평상시 아래 안내가 디자인보다 20px 내려간다 —
                  디자인은 이 줄이 생기면서 카드가 그만큼 커지는 쪽이다(Frame 766: 90 → 110) */}
              {hasFailed && (
                <p id="judge-code-error" className="text-body-sm w-full text-left" style={{ color: ERROR_BORDER }}>
                  입장 코드를 다시 확인해주세요.
                </p>
              )}
            </div>

            <p className="text-body-sm text-cool-neutral-500 text-left">*문제가 있을 시 관리자에게 문의해주세요.</p>
          </div>
        </div>

        {/* Confirm_Button 264×52 radius 999. 디자인의 기본 카드가 #aaaaaa로 그려져 있는데 그것이
            빈 입력 = 비활성 상태다. 활성은 컴포넌트 원본 색인 primary-900(#063e51) */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          // 입장 중에는 비활성이지만 색은 활성 그대로 둔다 — 성공한 직후에 버튼이 회색으로 꺼지면
          // 실패한 것처럼 읽힌다
          className={`text-label-lg text-cool-neutral-white w-full rounded-full font-bold transition-colors ${canSubmit || isEntering ? 'bg-primary-900' : 'bg-cool-neutral-400'}`}
          style={{ height: 52 }}
        >
          {isEntering ? '입장 중...' : '입장하기'}
        </button>
      </div>
    </div>
  );
}
