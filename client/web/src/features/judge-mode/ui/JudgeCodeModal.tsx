'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { env } from '@shared/config/env';
import judgeModeIcon from '@shared/lib/images/home-judge-mode-icon.png';
import { isJudgeCodeComplete, JUDGE_CODE_LENGTH, normalizeJudgeCode, verifyJudgeCode } from '../model/judgeCode';

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
export function JudgeCodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [hasFailed, setHasFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // 실패 상태에서는 버튼을 비활성화한다(요구사항). 입력을 고치면 다시 시도할 수 있어야 하므로
  // 여기서 실패를 지운다 — 지우지 않으면 한 번 틀린 뒤 영원히 잠긴다.
  function handleChange(raw: string) {
    setCode(normalizeJudgeCode(raw));
    setHasFailed(false);
  }

  // 대조는 "입장하기"를 눌렀을 때 한 번만 한다 — 입력 중에 판정하면 맞는 순간 화면이 튄다.
  function handleSubmit() {
    if (verifyJudgeCode(code, env.NEXT_PUBLIC_JUDGE_MODE_CODE)) {
      onSuccess();
      return;
    }
    setHasFailed(true);
  }

  const canSubmit = isJudgeCodeComplete(code) && !hasFailed;

  return (
    // 오버레이는 #000000 70%다(모달이 떠 있는 시안 home_3의 `Rectangle 5351`). px-6은 360 화면에서
    // 카드 312가 가운데 설 때의 좌우 여백 24와 같다
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="심사위원 모드 진입"
        className={`bg-cool-neutral-white flex w-full flex-col items-center gap-6 transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        style={{ maxWidth: 312, borderRadius: 24, padding: '32px 24px 24px', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.149)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Frame 514 — 안내 묶음과 입력 묶음 사이 rowGap 20 */}
        <div className="flex w-full flex-col items-center gap-5">
          {/* Message_Block — 열쇠와 문구 사이 rowGap 8 */}
          <div className="flex flex-col items-center gap-2">
            {/* 단축 버튼과 같은 미디어(Penpot fillImage 01a08634-0594-…)라 에셋을 공유한다 */}
            <Image src={judgeModeIcon} alt="" aria-hidden="true" width={84} height={84} className="h-21 w-21 object-contain" />

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
          className={`text-label-lg text-cool-neutral-white w-full rounded-full font-bold transition-colors ${canSubmit ? 'bg-primary-900' : 'bg-cool-neutral-400'}`}
          style={{ height: 52 }}
        >
          입장하기
        </button>
      </div>
    </div>
  );
}
