'use client';

import Image from 'next/image';
import judgeModeIcon from '@shared/lib/images/home-judge-mode-icon.png';

/**
 * 홈 단축 버튼 행의 "모드변경" — 방명록 왼쪽에 선다.
 *
 * Penpot home_3(360x800) > `Frame 628`(47x60, boardX 18 / boardY 157)이 기준이다.
 * 그 보드는 flex column-reverse · rowGap 4 · alignItems center이고 자식이 둘뿐이다:
 *   - `Rectangle 5352` 40x40 — 열쇠 아이콘. fillImage는 1254x1254 PNG, keepAspectRatio true라
 *     정사각 원본이 40x40에 그대로 들어간다(= object-contain과 같은 매핑). 그림자·테두리 없음.
 *   - 텍스트 "모드변경" 12px / lineHeight 1.3333(=16) / weight 500 / letterSpacing 0 / **#ffffff**
 * 40 + 4 + 16 = 60으로 보드 높이가 떨어진다.
 *
 * 같은 행의 방명록·할 일(`Frame 629` 안)과 달리 **유리 원 배경이 없다**(디자인에 없다).
 * 그래서 아이콘이 형제의 30x30보다 큰 40x40이다 — 원이 없는 만큼 아이콘 자체로 자리를 채운다.
 *
 * 탭 영역을 위해 아이콘 슬롯을 47x47로 부풀리던 코드가 있었는데, 버튼 자체가 이미 47x60이라
 * (라벨까지 버튼의 일부다) 그 47x47은 처음부터 불필요했고 라벨만 디자인보다 7px 밀어냈다.
 * 슬롯을 디자인대로 40x40으로 되돌려도 손가락이 닿는 면적은 47x60 그대로다.
 *
 * 라벨 색은 **형제(방명록·할 일)와 같은 `text-cool-neutral-950`을 쓴다**(사용자 지시).
 * Penpot에서는 이 셋의 라벨이 모두 같은 컬러 참조 #ffffff인데, 코드의 방명록·할 일은 예전부터
 * #111111이었다. 한 줄 안에서 색이 갈리는 것이 디자인과의 차이보다 눈에 띄므로 형제에 맞춘다.
 * (셋 다 흰색으로 가려면 이 파일이 아니라 HomePage의 두 형제까지 함께 바꿔야 한다.)
 *
 * 예전에는 이 자리 대신 하단 마스코트 버튼을 3초 꾹 눌러 모드를 토글했다. 코드 입력 없이
 * 켜지는 제스처라 실수로 밟을 수 있었고, 무엇보다 심사위원 토큰을 받을 통로가 없었다.
 */
export function JudgeModeShortcut({ onClick, isNight = false }: { onClick: () => void; isNight?: boolean }) {
  return (
    // aria-label은 화면 라벨과 글자까지 같아야 한다 — "모드 변경"처럼 띄어쓰면 음성 제어로
    // 화면에 보이는 대로 말했을 때 이 버튼이 잡히지 않는다(WCAG 2.5.3 Label in Name)
    <button type="button" onClick={onClick} aria-label="모드변경" className="flex flex-col items-center" style={{ width: 47 }}>
      <Image src={judgeModeIcon} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
      {/* rowGap 4 → mt-1. 12px 기준 "모드변경"은 47px에 1px 모자라 줄바꿈될 수 있어 nowrap으로 한 줄 고정 */}
      <span className={`text-label-sm mt-1 font-medium whitespace-nowrap ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-950'}`}>모드변경</span>
    </button>
  );
}
