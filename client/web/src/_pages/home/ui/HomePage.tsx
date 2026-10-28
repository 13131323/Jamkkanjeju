'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MISSION_ROUTE_BY_TYPE, type GeneratedApi, type HomeMissionCard, type MissionRoute } from '@packages/shared';
import { useAddressDisplay, useDisplayLocation, useJudgeModeAppSync, useJudgeModeStore, useLocationBridge, type AddressDisplay } from '@entities/location';
import { useStepCount } from '@features/app-bridge';
import { JudgeCodeModal, JudgeModeShortcut } from '@features/judge-mode';
// [보류] 위치 직접 입력(AddressModal)과 함께 잠시 꺼 둔다 — 아래 AddressModal 주석 참고
// import { useSearchPlaces, type SearchResultPlace } from '@features/map-search';
import { sendToApp } from '@shared/lib/bridge/utils';
import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';
import { Toast } from '@shared/ui/Toast';
import { getJejuDaylightServerSnapshot, getJejuDaylightSnapshot, subscribeJejuDaylight } from '../model/jejuDaylight';
import { useHomeData } from '../model/useHomeData';
import homeBackImage from '@shared/lib/images/home-back-image.png';
import homeBackImageNight from '@shared/lib/images/home-back-image3.png';
import homeTravelNoteIcon from '@shared/lib/images/home-travelnote-icon.png';
import aiCardIcon from '@shared/lib/images/aiCard.png';
import homeLogoLocationIcon from '@shared/lib/images/home_logo_location_icon.png';
import homeMyLocationIcon from '@shared/lib/images/home_my_location_icon.png';
import missionBannerCulture from '@shared/lib/images/mission-banner-culture.png';
import missionBannerCoop from '@shared/lib/images/mission-banner-coop.png';
import missionBannerTreasure from '@shared/lib/images/mission-banner-treasure.png';
import { NavMenuButton, NavMenuModal } from '@widgets/nav-menu';

// 배너 굵은 한 줄(Frame 619의 아래 텍스트)은 서버가 주지 않는 디자인 카피라 미션 종류로 매핑한다.
// 문구는 "탐라로그 V2 / 배너" 세 variant에서 그대로 가져왔다
// (RecommendedMission이 주는 문자열은 missionTitle 하나뿐이고, 그건 위쪽 컬러 한 줄로 들어간다).
const MISSION_BANNER_HEADLINE: Record<MissionRoute, string> = {
  culture: '제주는 아는 만큼 재밌어요',
  coop: '같이 귤나무를 키워봐요',
  treasure: '근처에 보물이 숨어 있어요',
};

// 제주지도 이미지(home-map-image.png, 1536x1024) 좌상단 기준 좌표 매칭표.
// { 아래로 픽셀, 오른쪽으로 픽셀, 위도, 경도 } — 사람이 눈대중으로 찍은 표라 오차가 있어,
// 최소자승법으로 (lat, lng) → (x%, y%) 아핀 변환을 적합시켜 오차를 평균화했다.
// 원본 매칭표:
// [600,200,33.3160,126.1748] [400,1400,33.4330,126.9198] [250,800,33.5071,126.5312]
// [700,800,33.2486,126.5312] [750,350,33.2174,126.2719] [600,1150,33.3047,126.7577]
// [200,1200,33.5505,126.7901] [350,450,33.4623,126.3222]
const MAP_PROJECTION = {
  x: { lng: 1.0502500437, lat: 0.014543792376, c: -132.86457724 },
  y: { lng: -0.0048906804725, lat: -1.6320825694, c: 55.567659074 },
};

// 위/경도 → 지도 이미지 안에서의 위치(%). 이미지 크기와 무관하게 항상 이미지 박스 기준 비율로 계산된다.
function projectCoordsToMapImage(coords: { lat: number; lng: number }) {
  const { x, y } = MAP_PROJECTION;
  const xFraction = x.lng * coords.lng + x.lat * coords.lat + x.c;
  const yFraction = y.lng * coords.lng + y.lat * coords.lat + y.c;

  return {
    xPercent: Math.min(100, Math.max(0, xFraction * 100)),
    yPercent: Math.min(100, Math.max(0, yFraction * 100)),
  };
}

const mock = {
  // **확정된 실패**에만 쓴다 — 권한 거부/차단, 좌표→주소 변환 실패, 앱 밖 실행.
  // 아직 모르는 구간(권한 응답 전·측위 전·변환 중)은 자리표시로 둔다(AddressLabel).
  addressFallback: '위치를 확인할 수 없어요',
  missionStatusLabel: '진행중인 미션',
  exploreMapLabel: '지도에서 보기',
  // [보류] 위치 직접 입력 모달의 문구. AddressModal과 함께 잠시 꺼 둔다
  // addressModal: {
  //   title: '위치 선택해주세요',
  //   searchPlaceholder: '지역, 장소 검색',
  //   mapSelectLabel: '🗺 지도에서 직접 선택',
  //   cancelLabel: '취소',
  //   confirmLabel: '확인',
  // },
};

export function HomePage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // [보류] 위치 직접 입력 모달 — 아래 AddressModal 주석 참고
  // const [isAddressOpen, setIsAddressOpen] = useState(false);

  // 같은 문구를 연달아 띄울 수 있어야 해서 id를 함께 들고, 그 id를 key로 Toast를 다시 마운트한다
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const isJudgeMode = useJudgeModeStore((s) => s.enabled);
  const enableJudgeMode = useJudgeModeStore((s) => s.enable);
  const disableJudgeMode = useJudgeModeStore((s) => s.disable);
  const [isJudgeCodeOpen, setIsJudgeCodeOpen] = useState(false);
  // 심사위원 모드 전환 연출이 언제 끝나야 하는지 판단할 근거 — 같은 쿼리라 캐시를 공유한다
  const { isPending: isHomePending } = useHomeData();
  // Toast의 타이머가 HomePage 리렌더마다 처음부터 다시 돌지 않도록 참조를 고정한다
  const handleToastDone = useCallback(() => setToast(null), []);

  // 배경을 일출~일몰이면 낮, 아니면 밤(노을)로 바꾼다. 화면을 켜둔 채 경계 시각을 넘는 경우도
  // 스토어가 1분마다 확인해 따라온다(jejuDaylight.ts).
  //
  // 렌더 중에 시각을 읽지 않는 이유가 핵심이다 — 홈은 force-dynamic(app/page.tsx)이라 서버가
  // 요청마다 실제 시각으로 다시 그리지만, `useState(() => ...new Date())`로 두면 서버와 기기가
  // 각자 렌더링되는 시각에 부르게 돼 값이 어긋날 수 있다. 외부 스토어로 서버·기기 스냅샷을
  // 각각 한 번씩 고정해 hydration 불일치를 막는다.
  const isDaytime = useSyncExternalStore(subscribeJejuDaylight, getJejuDaylightSnapshot, getJejuDaylightServerSnapshot);

  // 모드변경 코드칸에 "night"/"day"를 입력하면 임시로 배경을 바꿔 보는 개발용 우회로 —
  // 컴포넌트 state라 다른 페이지로 이동하면(언마운트) 자동으로 초기화된다.
  const [backgroundPreview, setBackgroundPreview] = useState<'day' | 'night' | null>(null);
  const effectiveIsDaytime = backgroundPreview === null ? isDaytime : backgroundPreview === 'day';
  const backgroundImage = effectiveIsDaytime ? homeBackImage : homeBackImageNight;
  const isNight = !effectiveIsDaytime;

  // Home 진입 시 앱에 위치 권한을 요청하고, 이후 들어오는 권한/좌표 갱신을 스토어에 반영한다.
  // WebView 밖(일반 브라우저)에서는 sendToApp/listenFromApp 모두 no-op이라 그대로 마운트해도 안전하다.
  useLocationBridge();

  // 모드를 앱에 알리는 것은 홈만 한다(useJudgeModeAppSync 주석 — 모든 라우트에서 보내면 WebView 6개가 다 받는다)
  useJudgeModeAppSync();

  // 코드가 맞았을 때만 심사위원용 모드가 켜진다. 켜져 있는 동안 현재 위치는 제주시청으로
  // 고정되므로 제주 밖에서도 추천 미션·지도 마커가 뜨고, API는 심사위원 토큰으로 나간다.
  //
  // 예전에는 하단 마스코트를 3초 꾹 누르면 토글됐다. 코드 없이 켜지는 제스처라 실수로 밟을 수
  // 있었고 심사위원 토큰을 받을 통로도 없어서, 열쇠 아이콘 + 코드 모달로 옮겼다.
  // 켜져 있으면 누르는 것만으로 기본 모드로 돌아간다 — 끄는 데 코드를 요구할 이유가 없다.
  // 다시 켤 때는 꺼진 상태이므로 아래 모달을 거쳐 코드를 입력하게 된다.
  function handleJudgeModePress() {
    if (isJudgeMode) {
      disableJudgeMode();
      setToast({ id: Date.now(), message: JUDGE_MODE_OFF_MESSAGE });
      return;
    }
    setIsJudgeCodeOpen(true);
  }

  /**
   * 코드가 맞았다. **모달은 여기서 닫지 않는다** — 모드를 켜는 순간 홈이 새 계정으로 다시 조회하는데,
   * 모달이 바로 사라지면 그 과정이 그대로 노출된다(사용자 지적: 빈 화면이 채워지는 느낌).
   * 모달이 "입장 중"으로 남아 있다가 조회가 끝나면 스스로 onClose를 부른다(judgeTransition.ts).
   */
  function handleJudgeCodeSuccess() {
    enableJudgeMode();
    setToast({ id: Date.now(), message: JUDGE_MODE_ON_MESSAGE });
  }

  return (
    <>
      <div className="bg-cool-neutral-white relative h-dvh w-full overflow-hidden">
        <svg className="absolute h-0 w-0" aria-hidden="true">
          <defs>
            <filter id="ocean-ripple" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves={2} seed={7} result="noise">
                <animate
                  attributeName="baseFrequency"
                  values="0.0043 0.0075;0.0075 0.012;0.0043 0.0075"
                  keyTimes="0;0.5;1"
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                  dur="16s"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={16} xChannelSelector="R" yChannelSelector="G">
                <animate attributeName="scale" values="12;25;12" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" dur="4s" repeatCount="indefinite" />
              </feDisplacementMap>
            </filter>
          </defs>
        </svg>

        <div className="absolute inset-0">
          {/* 배경 레이어 — 뷰포트 전체 폭을 채움(모바일 프레임에 가두지 않음) */}
          <div className="absolute inset-0 overflow-hidden">
            {/* 정적 배경(하늘 포함 전체) — 일출~일몰이면 낮, 아니면 밤(노을) 이미지.
                Ken Burns 확대/이동(animate-ken-burns)은 잠시 꺼 둔다 — scale이 가로까지 키워
                좌우가 잘리는 문제가 있었다. 키프레임(globals.css)은 그대로 둬서 className에
                다시 붙이기만 하면 되살아난다. objectPosition은 중앙(50%)에서 46px만큼 위로
                당겨서, 화면 중앙에 오던 배경 중심을 그만큼 위로 옮긴다. */}
            <Image src={backgroundImage} alt="" aria-hidden="true" fill priority sizes="100vw" className="object-cover" style={{ objectPosition: 'center calc(50% - 46px)' }} />

            {/* 파도 레이어 — 동일 이미지를 겹쳐 상단 75%부터(수평선 아래)만 노출, 하늘은 정적 유지.
                출렁임(filter-[url(#ocean-ripple)])도 같은 이유로 잠시 꺼 둔다 — SVG 필터 정의(위 defs)는
                그대로 둬서 className에 다시 붙이기만 하면 되살아난다. 위 레이어와 같은 objectPosition을
                써야 두 레이어가 어긋나지 않고 겹친다. */}
            <div className="absolute inset-0" style={{ clipPath: 'inset(30% 0 0 0)' }}>
              <Image src={backgroundImage} alt="" aria-hidden="true" fill priority sizes="100vw" className="object-cover" style={{ objectPosition: 'center calc(50% - 46px)' }} />
            </div>
          </div>

          {/* 지도가 이제 배경 이미지에 섬 그림으로 포함돼 있어(home-back-image.png/3.png), 별도
              지도 이미지는 안 그린다. 이 박스는 화면엔 안 보이는 "좌표 기준 틀"로만 쓰인다 —
              배경 속 섬이 이미지 정중앙에 있어 object-cover로 잘려도 항상 화면 정중앙에 오는 걸
              이용해, 예전 지도 이미지와 같은 중앙 정렬 방식을 그대로 재사용한다. w-[74%]와
              aspect 비율은 섬을 눈대중으로 잰 추정치라 실기기에서 마커가 섬과 어긋나면 조정할 것.
              이 박스 자체는 옮기지 않는다 — "지도에서 보기" 버튼이 이 박스 바닥(top-full) 기준이라
              박스를 옮기면 버튼까지 같이 움직인다(사용자가 원치 않음). 배경만 위로 46px 옮겼으니
              마커에만 같은 보정치를 넘겨 그만큼 따로 올린다(래핑 div로 감싸면 그 div가 새 위치
              기준점이 되어 %기반 left/top이 깨지므로, 마커 자신의 transform에 얹는 방식을 쓴다). */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-[1536/1024] w-[74%]">
              <UserLocationMarker extraOffsetY={46} />

              <button
                type="button"
                onClick={() => router.push('/map')}
                className={`bg-cool-neutral-white/20 border-cool-neutral-white/40 text-label-sm absolute top-full left-1/2 -mt-4 flex -translate-x-1/2 items-center gap-2 rounded-full border px-2.5 py-2 font-medium whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md ${isNight ? 'text-cool-neutral-white' : 'text-warm-neutral-900'}`}
              >
                <span>{mock.exploreMapLabel}</span>
                <ChevronRightIcon className={isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'} />
              </button>
            </div>
          </div>

          {/* 전경 UI 프레임 — 안드로이드 기기 실제 너비(약 360~430px)가 그대로 뷰포트 폭이 되므로, 캡 없이 화면 폭에 맞춰 늘어난다.
              투명한 영역까지 전부 클릭을 가로채 아래 지도 레이어("지도에서 보기" 버튼 등)를 못 누르게 되므로,
              프레임 자체는 pointer-events-none으로 뚫어두고 실제 UI가 있는 자식들만 pointer-events-auto로 되살린다. */}
          <div className="pointer-events-none relative h-full w-full">
            <TopBar isNight={isNight} />

            <MissionProgressCard isNight={isNight} />

            {/* 모드변경은 방명록·할 일과 같은 줄이지만 화면 **가장 왼쪽**에 선다(디자인 home_3 > Frame 628: boardX 18, boardY 157).
                top 106은 디자인 그대로가 아니라, 미션 카드(바닥 82) ↔ 방명록·AI엽서 원(top 102) 간격을 20px로 맞추면서
                형제(원 47)와의 4px 간격(아이콘 슬롯 40 vs 원 47, 중심을 맞추기 위한 오프셋)을 그대로 유지한 값이다. */}
            <div className="pointer-events-auto absolute" style={{ left: 18, top: `calc(var(--safe-area-top) + 106px)` }}>
              <JudgeModeShortcut onClick={handleJudgeModePress} isNight={isNight} />
            </div>

            {/* 미션 카드 바닥(82)에서 20px 떨어지도록 top을 112→102로 조정했다(사용자 요청).
                할 일 숏컷은 원격 커밋(qa: 홈 할 일 숏컷 AI엽서 교체)에서 AI엽서 바로가기로 교체됨 —
                병합 시 밤모드 흰 글자 지원만 이어서 추가했다. */}
            <div className="pointer-events-auto absolute flex gap-4" style={{ right: 16, top: `calc(var(--safe-area-top) + 102px)` }}>
              <TravelNoteShortcut isNight={isNight} />
              <AiPostcardShortcut isNight={isNight} />
            </div>

            {/* 화면 끝에서 떠 있는 하단 UI라 디자인 여백(24px)에 안전영역을 더한다.
                --safe-area-bottom은 앱 WebView에서 항상 0이다(하단 inset은 앱 루트 레이아웃이 네이티브에서 처리).
                브라우저·iOS 단독 실행에서 홈 인디케이터가 있을 때만 값이 들어온다 */}
            <div className="pointer-events-auto absolute right-4 left-4" style={{ bottom: `calc(24px + var(--safe-area-bottom))` }}>
              {/* pin — top -92: 버튼(h-16=64) 아래쪽과 추천 미션 배너 사이 간격을 28px로 맞춘 값(-92+64=-28) */}
              <NavMenuButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(true)} className="absolute" style={{ left: 10, top: -92 }} />

              <MissionCarousel />
            </div>
          </div>
        </div>
      </div>

      {isMenuOpen && <NavMenuModal onClose={() => setIsMenuOpen(false)} />}

      {/* isReady: 모드를 켠 뒤 홈 재조회가 끝났는지. 모달이 직접 useHomeData를 부르면
          features가 _pages를 import하게 되어 FSD가 깨지므로 여기서 내려준다 */}
      {isJudgeCodeOpen && <JudgeCodeModal onClose={() => setIsJudgeCodeOpen(false)} onSuccess={handleJudgeCodeSuccess} isReady={!isHomePending} onBackgroundPreview={setBackgroundPreview} />}

      {/* [보류] 상단 주소 텍스트 탭 시 하단에서 올라오는 home_ModalBg 모달 — home_1/2/3 세 초안에 동일하게 등장함(각자 파일에 동일 내용으로 중복 구현). 최종 초안 확정 후 공용 컴포넌트로 추출 고려 대상 */}
      {/* {isAddressOpen && <AddressModal onClose={() => setIsAddressOpen(false)} />} */}

      {toast && <Toast key={toast.id} message={toast.message} onDone={handleToastDone} />}
    </>
  );
}

const JUDGE_MODE_ON_MESSAGE = '심사위원용 모드입니다';
const JUDGE_MODE_OFF_MESSAGE = '기본 모드로 돌아왔습니다';

function TopBar({ isNight }: { isNight: boolean }) {
  const router = useRouter();
  // 앱이 STEP_COUNT_UPDATE를 보내기 전에는 직전에 저장해 둔 값, 그것도 없으면 0이다.
  // 예전에는 목업 문구("8,432걸음")로 폴백했는데, 실제와 무관한 숫자가 진짜처럼 보였다(useStepCount).
  const steps = useStepCount();
  const stepsLabel = `${steps.toLocaleString('ko-KR')}걸음`;

  // 카카오맵 Geocoder로 현재 좌표를 주소 문자열로 역변환한다. 좌표·권한·변환 결과를
  // "아직 모름 / 찾을 수 없음 / 찾음" 세 갈래로 접는 규칙은 entities/location의 addressDisplay에 있다 —
  // 예전에는 주소 문자열이 없으면 무조건 실패 문구였고, 그래서 홈이 뜰 때마다 정상 경로에서도
  // "위치를 확인할 수 없어요"가 먼저 떴다가 주소로 바뀌었다(사용자 지적).
  const addressDisplay = useAddressDisplay();

  // 디자인의 top 44는 상태바(44) 바로 아래라는 뜻이라, 실제 inset이 그 44를 대체한다
  return (
    <div className="pointer-events-auto absolute flex w-full items-center justify-between px-4" style={{ left: 0, top: `var(--safe-area-top)`, height: 34 }}>
      {/* 주소는 표시 전용이다. 예전에는 여기를 3초 꾹 눌러 위치 직접 입력 모달을 열었는데,
          그 모달은 기획 논의가 끝나지 않아 보류되고 제스처는 하단 메뉴 아이콘으로 옮겼다. */}
      <div className="flex items-center gap-1">
        <Image src={homeLogoLocationIcon} alt="" aria-hidden="true" className="h-7.5 w-7 object-contain" />
        <AddressLabel display={addressDisplay} isNight={isNight} />
      </div>

      <button
        type="button"
        onClick={() => router.push('/mypage')}
        className={`bg-cool-neutral-white/20 border-cool-neutral-white/40 text-label-sm flex h-7.5 items-center rounded-full border px-3 py-1 font-medium shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md ${isNight ? 'text-cool-neutral-white' : 'text-primary-900'}`}
      >
        {stepsLabel}
      </button>
    </div>
  );
}

/**
 * 상단 주소 라벨.
 *
 * **아직 모르는 구간에 실패 문구를 쓰지 않는다**(entities/location의 addressDisplay 주석).
 * 자리표시는 캐러셀 스켈레톤과 같은 기법(`animate-pulse`)을 쓰되, 하늘 그림 위라 보이도록
 * 흰색 계열로 둔다. 폭을 행정동 이름 길이(약 5~8자)에 맞춰 고정해 주소가 도착할 때 옆의
 * 셰브론이 크게 밀리지 않게 한다 — 실패 문구(12자)로 채우던 예전이 더 크게 밀었다.
 */
function AddressLabel({ display, isNight }: { display: AddressDisplay; isNight: boolean }) {
  if (display.state === 'loading') {
    return (
      <span role="status" aria-label="위치를 확인하는 중">
        <Skeleton tone="onDark" className="my-1 h-3.5 w-20" />
      </span>
    );
  }

  const label = display.state === 'resolved' ? display.label : mock.addressFallback;
  return <span className={`text-label-md font-medium ${isNight ? 'text-cool-neutral-white' : 'text-warm-neutral-900'}`}>{label}</span>;
}

// 진행중인 미션이 여러 개일 때 자동으로 다음 카드로 넘어가는 간격.
// 4초는 미션 제목을 다 읽기 전에 넘어간다는 지적이 있어 7초로 늘렸다 —
// 더 늘리면 카드가 여러 장이라는 사실 자체를 눈치채기 어려워진다(아래 인디케이터도 지웠으므로).
const MISSION_PROGRESS_AUTO_ADVANCE_MS = 7000;

function MissionProgressCard({ isNight }: { isNight: boolean }) {
  const { progressMissions, isPending } = useHomeData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  // 자동 넘김 — 카드가 2장 이상일 때만. 매 tick마다 현재 스크롤 위치를 기준으로 다음 칸을 계산해서,
  // 사용자가 직접 민 위치에서도 자연스럽게 이어서 순환한다.
  useEffect(() => {
    if (progressMissions.length <= 1) return;

    const timer = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const currentIndex = Math.round(el.scrollLeft / el.clientWidth);
      const nextIndex = (currentIndex + 1) % progressMissions.length;
      el.scrollTo({ left: nextIndex * el.clientWidth, behavior: 'smooth' });
    }, MISSION_PROGRESS_AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [progressMissions.length]);

  // 데스크톱 브라우저 테스트용 마우스 드래그 스와이프 — 터치는 overflow-x-auto가 기본으로 처리하므로 mouse만 개입 (MissionCarousel과 동일한 패턴)
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || e.pointerType !== 'mouse') return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
    el.style.scrollBehavior = 'auto';
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag || e.pointerId !== drag.pointerId) return;
    el.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // 잡아 둔 포인터는 반드시 놓는다 — 남겨 두면 같은 포인터를 쓰는 다른 곳(개발 오버레이 등)이 어긋난다
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.scrollBehavior = '';
  }

  // 응답 전에는 자리(고정 높이 37)만 잡고 내용은 스켈레톤으로 — 바로 위 배너(MissionCarousel)와
  // 처리를 맞춘다. 이전에는 return null이라 데이터가 오는 순간 카드가 뿅 하고 나타났다.
  if (isPending) return <MissionProgressSkeleton />;

  // 진행중인 미션이 없으면 "0/0 | 여행을 시작해보세요." 안내 카드를 대신 보여준다.
  if (progressMissions.length === 0) return <MissionProgressPlaceholder isNight={isNight} />;

  // 디자인 top 89 = 상태바 44 + 45. inset이 44를 대체하고 45만 더한다.
  //
  // 카드 아래 점 인디케이터는 사용자 요청으로 지웠다. 절대 배치(top 85)라 자리를 차지하지 않았으므로
  // 아래 요소들의 간격은 그대로다. 점은 pointer-events-none 장식이고 aria도 없어서
  // 스크린 리더에 알려 주던 정보가 없다 — aria-*로 대체할 것이 없다.
  return (
    <div
      ref={scrollRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragStart={(e) => e.preventDefault()}
      className="pointer-events-auto absolute right-4 left-4 flex snap-x snap-mandatory scrollbar-none overflow-x-auto scroll-smooth select-none [&::-webkit-scrollbar]:hidden"
      style={{ top: `calc(var(--safe-area-top) + 45px)`, height: 37 }}
    >
      {/* missionId는 유형별 테이블의 id라 유형이 다르면 값이 겹친다 — 추천 카드와 같은 복합 키를 쓴다
            (packages/shared의 missionCard.ts에 같은 주석·같은 규칙이 있다) */}
      {progressMissions.map((mission) => (
        <div key={`${mission.missionType}-${mission.missionId}`} className="w-full shrink-0 snap-center">
          <MissionProgressButton mission={mission} isNight={isNight} />
        </div>
      ))}
    </div>
  );
}

function MissionProgressSkeleton() {
  return (
    <SkeletonGroup
      className="bg-cool-neutral-white/20 border-cool-neutral-white/40 absolute right-4 left-4 flex h-full items-center gap-4 rounded-md border px-3 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md"
      style={{ top: `calc(var(--safe-area-top) + 45px)`, height: 37 }}
    >
      <Skeleton tone="onDark" className="h-3.5 w-24" />
      <Skeleton tone="onDark" className="h-3.5 flex-1" />
    </SkeletonGroup>
  );
}

function MissionProgressPlaceholder({ isNight }: { isNight: boolean }) {
  return (
    <div
      className="bg-cool-neutral-white/20 border-cool-neutral-white/40 absolute right-4 left-4 flex h-full items-center justify-between rounded-md border px-3 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md"
      style={{ top: `calc(var(--safe-area-top) + 45px)`, height: 37 }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span aria-hidden="true" className={`text-label-sm ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'}`}>
            🚩
          </span>
          <span className={`text-label-sm ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'}`}>{mock.missionStatusLabel}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isNight ? 'bg-cool-neutral-600 text-cool-neutral-white' : 'bg-primary-50 text-cool-neutral-800'}`}>0/0</span>
        </div>
        <span className="bg-cool-neutral-500 h-[8.5px] w-px" aria-hidden="true" />
        <span className={`text-body-sm ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-700'}`}>여행을 시작해보세요.</span>
      </div>
      <ChevronRightIcon className={isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'} />
    </div>
  );
}

function MissionProgressButton({ mission, isNight }: { mission: GeneratedApi.ProgressMission; isNight: boolean }) {
  // 배너의 "시작하기"와 같은 NAVIGATE를 쓰지만 resume을 붙인다 — 이미 시작한 미션이라
  // 앱이 인트로("미션 시작하기")를 건너뛰고 진행 화면으로 보낸다. 단계는 그 화면이 스스로 찾는다.
  function handleResume() {
    sendToApp({
      type: 'NAVIGATE',
      payload: { route: toNavigateRoute(MISSION_ROUTE_BY_TYPE[mission.missionType]), missionId: mission.missionId, resume: true },
    });
  }

  return (
    <button
      type="button"
      onClick={handleResume}
      className="bg-cool-neutral-white/20 border-cool-neutral-white/40 flex h-full w-full items-center justify-between rounded-md border px-3 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span aria-hidden="true" className={`text-label-sm ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'}`}>
            🚩
          </span>
          <span className={`text-label-sm ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'}`}>{mock.missionStatusLabel}</span>
          {/* 서버 값을 그대로 찍는다. 두 숫자의 의미가 미션 유형마다 다르지만(문화=퀴즈 번호,
              보물찾기=진행도, 협동=단계) 어느 쪽이든 앱의 해당 미션 화면이 쓰는 카운터와 같은 값이라
              화면끼리 어긋나지 않는다. 진행중일 수 없는 조합은 이 카드에 오기 전에 걸러진다
              (model/progressMissions.ts) */}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isNight ? 'bg-cool-neutral-600 text-cool-neutral-white' : 'bg-primary-50 text-cool-neutral-800'}`}>
            {mission.currentStep}/{mission.totalStep}
          </span>
        </div>
        <span className="bg-cool-neutral-500 h-[8.5px] w-px" aria-hidden="true" />
        <span className={`text-body-sm ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-700'}`}>{mission.missionTitle}</span>
      </div>
      <ChevronRightIcon className={isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-900'} />
    </button>
  );
}

function AiPostcardShortcut({ isNight }: { isNight: boolean }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push('/mypage/travel-ending')} className="flex flex-col items-center" style={{ width: 49 }}>
      <span className="bg-cool-neutral-white/20 border-cool-neutral-white/40 relative flex h-11.75 w-11.75 items-center justify-center rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md">
        {/* 엽서 그림에 여백이 있어 다른 숏컷 아이콘보다 작아 보인다 — 원(47)은 그대로 두고 아이콘만 1.5배 */}
        <Image src={aiCardIcon} alt="" aria-hidden="true" className="h-11.25 w-11.25 object-contain" />
      </span>
      <span className={`text-label-sm mt-1.25 font-medium ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-950'}`}>AI엽서</span>
    </button>
  );
}
function TravelNoteShortcut({ isNight }: { isNight: boolean }) {
  const router = useRouter();
  // 마지막 확인 이후 새 방명록 개수를 표시하며 100개 이상은 99+로 통일한다.
  const { guestbookCount } = useHomeData();
  return (
    <button type="button" onClick={() => router.push('/travel-note')} className="flex flex-col items-center" style={{ width: 49 }}>
      <span className="bg-cool-neutral-white/20 border-cool-neutral-white/40 relative flex h-11.75 w-11.75 items-center justify-center rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-md">
        <Image src={homeTravelNoteIcon} alt="" aria-hidden="true" className="h-7.5 w-7.5 object-contain" />
        <span className="text-cool-neutral-white absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3030] px-1 text-[10px] font-medium">{guestbookCount >= 100 ? '99+' : guestbookCount}</span>
      </span>
      <span className={`text-label-sm mt-1.25 font-medium ${isNight ? 'text-cool-neutral-white' : 'text-cool-neutral-950'}`}>방명록</span>
    </button>
  );
}

// extraOffsetY: 배경 objectPosition을 위로 옮긴 만큼(px) 마커도 같이 보정하기 위한 값.
// className의 -translate-x-1/2 -translate-y-full과 같이 못 쓰고(인라인 style이 transform 전체를
// 덮어써버림) transform 문자열에 셋 다 합쳐서 쓴다.
function UserLocationMarker({ extraOffsetY = 0 }: { extraOffsetY?: number }) {
  const { coords } = useDisplayLocation();
  const { characterImgUrl } = useHomeData();
  if (!coords) return null;

  const { xPercent, yPercent } = projectCoordsToMapImage(coords);

  return (
    <div className="absolute" style={{ left: `${xPercent}%`, top: `${yPercent}%`, transform: `translate(-50%, calc(-100% - ${extraOffsetY}px))` }}>
      {/* 마커 하단이 뾰족한 지도 핀 형태 — 원 아래에 45도 회전한 정사각형을 겹쳐 뾰족한 꼬리를 만든다(MascotTooltip 말풍선 꼬리와 동일 기법) */}
      <button type="button" className="bg-cool-neutral-white relative flex h-12 w-12 items-center justify-center rounded-full">
        {characterImgUrl ? (
          // 사용자에게 배정된 AR 캐릭터 이미지 — next.config.ts images에 등록되지 않은 원격 URL이라 next/image 최적화 대상이 아니다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={characterImgUrl} alt="" aria-hidden="true" className="relative z-10 h-10 w-10 rounded-full object-cover" />
        ) : (
          <Image src={homeMyLocationIcon} alt="" aria-hidden="true" className="relative z-10 h-10 w-10 object-contain" />
        )}
        <span className="bg-cool-neutral-white absolute -bottom-1 left-1/2 z-0 h-4 w-4 -translate-x-1/2 rotate-45" aria-hidden="true" />
      </button>
    </div>
  );
}

// 배너 흰 판 — "탐라로그 V2 / 배너" > Rectangle 5341: 흰 배경, radius 20, drop-shadow 0 4 14 rgba(0,0,0,0.14).
// radius 20은 --radius-* 토큰(4/8/14/16/999)에 없는 값이라 리터럴로 둔다.
const BANNER_SURFACE_CLASS = 'bg-cool-neutral-white rounded-[20px] shadow-[0_4px_14px_rgba(0,0,0,0.14)]';

/**
 * 배너 아래 인디케이터 줄이 차지하는 높이(gap 12 + 점 5)만 잡아 두는 빈 줄.
 *
 * 캐러셀은 **아래를 기준으로 배치된다**(`bottom: 24px + safe-area-bottom`). 그래서 응답 전
 * 인디케이터가 없으면 블록이 17px 짧아지고, 데이터가 도착해 점이 생기는 순간 배너와 그 위의
 * 메뉴 버튼이 통째로 17px 위로 올라간다 — 사용자가 본 "레이아웃이 살짝 움직였다 나온다"의 한 몫이다.
 * 점의 개수는 응답 전에는 알 수 없으므로 높이만 미리 잡는다.
 */
function IndicatorRowSpacer() {
  return <div className="mt-3 h-1.25" aria-hidden="true" />;
}

function MissionCarousel() {
  const { missionCards, isPending, isError, refetch } = useHomeData();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  // 데스크톱 브라우저 테스트용 마우스 드래그 스와이프 — 터치는 overflow-x-auto가 기본으로 처리하므로 mouse만 개입
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || e.pointerType !== 'mouse') return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
    el.style.scrollBehavior = 'auto';
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag || e.pointerId !== drag.pointerId) return;
    el.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // 잡아 둔 포인터는 반드시 놓는다 — 남겨 두면 같은 포인터를 쓰는 다른 곳(개발 오버레이 등)이 어긋난다
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.scrollBehavior = '';
  }

  // 응답 전에는 배너 한 장 높이(98)의 빈 카드를 둔다 — 캐러셀이 사라졌다 나타나며 아래 내용이 밀리지 않게.
  if (isPending) {
    return (
      <SkeletonGroup>
        <div className={BANNER_SURFACE_CLASS}>
          <div className="flex h-24.5 w-full items-center gap-4 pr-5.5 pl-4.5">
            <Skeleton className="h-15.5 w-15.5 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4.5 w-2/5" />
            </div>
          </div>
        </div>
        <IndicatorRowSpacer />
      </SkeletonGroup>
    );
  }

  /**
   * 조회 실패는 **"추천 없음"과 다르게** 보여준다.
   *
   * 예전에는 둘 다 자리를 비웠다(`missionCards.length === 0`). 실패를 mock으로 덮지 않겠다는 뜻이었지만,
   * 결과적으로 401이든 서버가 빈 배열을 준 것이든 화면이 똑같아 **원인을 구별할 수 없었다** —
   * useHomeData가 실패를 `?? []`로 뭉개고 isError는 아무도 읽지 않았다.
   * 심사위원용 모드에서 배너가 안 뜬다는 제보의 원인을 찾는 데 오래 걸린 이유가 이것이다.
   */
  if (isError) {
    return (
      <div>
        <div className={BANNER_SURFACE_CLASS}>
          <div className="flex h-24.5 w-full items-center justify-between gap-4 pr-5.5 pl-4.5">
            <p className="text-body-md text-warm-neutral-400">추천 미션을 불러오지 못했어요</p>
            <button type="button" onClick={() => refetch()} className="border-cool-neutral-200 text-label-sm text-warm-neutral-900 shrink-0 rounded-full border px-3 py-1.5 font-medium">
              다시 시도
            </button>
          </div>
        </div>
        <IndicatorRowSpacer />
      </div>
    );
  }

  // 여기까지 왔으면 조회는 성공했고 서버가 추천을 주지 않은 것이다 — 자리를 비운다
  if (missionCards.length === 0) {
    return null;
  }

  return (
    <div>
      {/* 카드(흰 판 포함)가 통째로 슬라이드된다. 스크롤러가 overflow를 자르므로
          - 좌우: -mx-4/px-4로 화면 끝까지 넓혀 카드가 화면 가장자리로 완전히 나가게 한다
          - 상하: 그림자(0 4px 14px)가 잘리지 않게 pt-3/pb-5를 주고 같은 값의 음수 마진으로 레이아웃은 그대로 둔다
          카드 사이 gap-8(32)은 양쪽 여백 16+16과 같아, 옆 카드가 화면 가장자리에 비쳐 보이지 않는다.
          그래서 한 장의 스크롤 간격이 스크롤러 폭(clientWidth)과 같다 — handleScroll의 계산이 그대로 맞는다 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragStart={(e) => e.preventDefault()}
        className="-mx-4 -mt-3 -mb-5 flex snap-x snap-mandatory gap-8 scrollbar-none overflow-x-auto scroll-smooth px-4 pt-3 pb-5 select-none [&::-webkit-scrollbar]:hidden"
      >
        {missionCards.map((card) => (
          <div key={card.key} className={`${BANNER_SURFACE_CLASS} w-full shrink-0 snap-center`}>
            <MissionBannerContent card={card} />
          </div>
        ))}
      </div>

      {/* 인디케이터 — home_3 > Frame 616(배너 아래 gap 12) > Frame 194.
          활성 15x5 흰 알약, 비활성 5x5 #888888(cool-neutral-500) 원, 사이 간격 3 */}
      <div className="mt-3 flex items-center justify-center gap-0.75">
        {missionCards.map((card, index) => (
          <span key={card.key} className={`h-1.25 rounded-full transition-all ${index === activeIndex ? 'bg-cool-neutral-white w-3.75' : 'bg-cool-neutral-500 w-1.25'}`} />
        ))}
      </div>
    </div>
  );
}

// mission별 아이콘 타일 배경 / 상단 한 줄 색 — "탐라로그 V2 / 배너" variant 3종에서 그대로 뽑았다.
// treasure #c5edfa·#0a8ab5 = primary-100·primary-700, culture #e2f2d2·#77be36 = tertiary-100·tertiary-600.
// coop의 #ffe2c2·#e0780a는 globals.css @theme에도 Penpot 라이브러리에도 이름이 없는 색이라
// (라이브러리 색이 Figma에서 넘어와 전부 "No name") 토큰 대신 리터럴로 둔다.
const MISSION_BANNER_STYLE = {
  // 파랑(primary)과 초록(tertiary)을 문화·보물찾기 사이에서 서로 교체했다. 아이콘은 그대로 둔다
  culture: { image: missionBannerCulture, tileBg: 'bg-primary-100', titleColor: 'text-primary-700' },
  treasure: { image: missionBannerTreasure, tileBg: 'bg-tertiary-100', titleColor: 'text-tertiary-600' },
  coop: { image: missionBannerCoop, tileBg: 'bg-[#ffe2c2]', titleColor: 'text-[#e0780a]' },
} as const;

// 배너 아이콘 표시 크기는 Penpot(image 83 / JejuCelebrationImage) 그대로 62x62 — 클래스 h-15.5 w-15.5로 준다.
// next/image는 고정 width에 대해 1x/2x srcset만 만들므로, 표시 크기 62를 그대로 넘기면 후보가 64/128이 되고
// DPR 3 기기는 128px을 186 디바이스 픽셀에 늘려 써서 흐려진다. 그래서 요청 폭만 2배(124)로 올려
// 후보를 128(1x)/256(2x)로 만든다 — DPR 3에서 받는 256px이 필요한 186px보다 크니 업스케일이 없다.
// 원본 PNG는 Penpot 미디어 1254x1254를 리샘플 없이 넣었으므로 어느 후보든 다운샘플만 일어난다.
const BANNER_ICON_REQUEST_SIZE = 124;

// 앱 NAVIGATE 라우트는 'culture-mission'/'treasure-mission' 형태라 route에 '-mission' suffix를 붙여 매핑한다.
function toNavigateRoute(route: MissionRoute): 'culture-mission' | 'treasure-mission' | 'coop-mission' {
  return `${route}-mission`;
}

function MissionBannerContent({ card }: { card: HomeMissionCard }) {
  const style = MISSION_BANNER_STYLE[card.route];

  function handleStart() {
    // missionId를 함께 보내야 앱 인트로가 어떤 미션을 조회할지 알 수 있다.
    sendToApp({ type: 'NAVIGATE', payload: { route: toNavigateRoute(card.route), missionId: card.missionId } });
  }

  // 장소가 없는 미션(문화 미션)은 관련 필드가 전부 null이라 줄 자체를 숨긴다.
  // 디자인의 배너 높이(98)는 고정이라 이 줄이 빠져도 카드가 줄지 않고 텍스트 블록만 가운데로 모인다.
  const metaParts = [card.placeLabel, card.distanceLabel, card.durationMinutes === null ? null : `도보 ${card.durationMinutes}분`].filter((part): part is string => part !== null);

  // 치수는 "탐라로그 V2 / 배너"(328x98) 그대로: 좌측 여백 18(pl-4.5), 아이콘 62(h-15.5), 아이콘↔텍스트 gap 16,
  // 셰브론은 오른쪽에서 22(pr-5.5). 텍스트 블록은 디자인에선 144 고정이지만 실제 문구 길이가 제각각이라
  // flex-1 + truncate로 흘려 98 높이를 지킨다.
  return (
    <button type="button" onClick={handleStart} className="flex h-24.5 w-full items-center gap-4 pr-5.5 pl-4.5 text-left">
      <span className={`h-15.5 w-15.5 shrink-0 overflow-hidden rounded-lg ${style.tileBg}`}>
        <Image src={style.image} alt="" aria-hidden="true" width={BANNER_ICON_REQUEST_SIZE} height={BANNER_ICON_REQUEST_SIZE} className="h-15.5 w-15.5 object-cover" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Frame 619 — 위 두 줄은 gap 0으로 붙고, 메타 줄만 2 떨어진다(사용자 요청으로 4→2) */}
        <div className="flex flex-col">
          <p className={`text-label-sm truncate font-medium ${style.titleColor}`}>{card.title}</p>
          <p className="text-label-md text-cool-neutral-950 truncate font-semibold">{MISSION_BANNER_HEADLINE[card.route]}</p>
        </div>
        {metaParts.length > 0 && <p className="text-body-sm text-cool-neutral-800 truncate">{metaParts.join(' · ')}</p>}
      </div>

      <BannerChevronIcon />
    </button>
  );
}

// [보류] 위치 직접 입력 모달.
//
// 상단 주소를 3초 꾹 누르면 열리던 모달이다. 기획 논의가 끝나지 않아 보류 상태다.
// 기획 논의가 끝나지 않아 지우지 않고 남겨 둔다 — 되살릴 때는 이 블록과 함께
// mock.addressModal / useSearchPlaces import / LocationListItem / SearchIcon도 함께 푼다.
// function AddressModal({ onClose }: { onClose: () => void }) {
//   const { addressModal } = mock;
//   const [isVisible, setIsVisible] = useState(false);
//   const [keyword, setKeyword] = useState('');
//   // 제주 안/밖 판정 없이 실제 좌표를 그대로 쓴다 — TopBar 상단 주소와 같은 이유(useCurrentCoords 주석 참고).
//   const coords = useCurrentCoords();
//   const { data, isLoading, isError } = useSearchPlaces(keyword, coords);
//
//   useEffect(() => {
//     const frame = requestAnimationFrame(() => setIsVisible(true));
//     return () => cancelAnimationFrame(frame);
//   }, []);
//
//   const trimmedKeyword = keyword.trim();
//   const results: SearchResultPlace[] = [...(data?.recommended ?? []), ...(data?.mission ?? [])];
//
//   return (
//     <div className={`fixed inset-0 z-50 flex w-full items-end justify-center bg-black/50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
//       <div
//         className={`bg-cool-neutral-white flex w-full flex-col gap-4 rounded-t-xl px-4 pt-4 transition-transform duration-300 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
//         style={{ paddingBottom: `max(32px, var(--safe-area-bottom))` }}
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="flex justify-center">
//           <div className="bg-cool-neutral-200 h-1 w-9 rounded-full" />
//         </div>
//
//         <p className="text-heading-h3 text-warm-neutral-900 font-bold">{addressModal.title}</p>
//
//         <div className="bg-cool-neutral-100 flex items-center gap-2.5 rounded-full px-5 py-3.5">
//           <SearchIcon />
//           <input
//             type="text"
//             value={keyword}
//             onChange={(e) => setKeyword(e.target.value)}
//             placeholder={addressModal.searchPlaceholder}
//             className="text-body-lg text-warm-neutral-900 placeholder:text-cool-neutral-400 min-w-0 flex-1 bg-transparent outline-none"
//           />
//         </div>
//
//         <div className="flex max-h-70 flex-col overflow-y-auto">
//           {trimmedKeyword === '' ? (
//             <p className="text-body-md text-warm-neutral-400 py-6 text-center">지역이나 장소를 검색해보세요</p>
//           ) : isLoading ? (
//             <p className="text-body-md text-warm-neutral-400 py-6 text-center">검색 중...</p>
//           ) : isError ? (
//             <p className="text-body-md text-warm-neutral-400 py-6 text-center">검색에 실패했어요. 다시 시도해주세요</p>
//           ) : results.length === 0 ? (
//             <p className="text-body-md text-warm-neutral-400 py-6 text-center">검색 결과가 없어요</p>
//           ) : (
//             results.map((place) => <LocationListItem key={place.id} place={place} />)
//           )}
//         </div>
//
//         <div className="flex gap-2.5">
//           <button type="button" onClick={onClose} className="border-cool-neutral-200 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex-1 rounded-full border py-3 font-medium">
//             {addressModal.cancelLabel}
//           </button>
//           <button type="button" className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white flex-1 rounded-full py-3 font-medium">
//             {/* TODO: 선택한 위치 저장 onClick 연결 */}
//             {addressModal.confirmLabel}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// [보류] 위치 직접 입력 모달(AddressModal)의 검색 결과 한 줄
// function LocationListItem({ place }: { place: SearchResultPlace }) {
//   return (
//     <button type="button" className="border-cool-neutral-100 flex items-center gap-3.5 border-b py-3.5 text-left first:border-t">
//       {/* TODO: 해당 위치 선택 onClick 연결 */}
//       <Image src={homeLogoLocationIcon} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
//       <div className="flex items-center gap-2">
//         <span className="text-label-lg text-warm-neutral-900 font-medium">{place.name}</span>
//         <span className="text-body-md text-warm-neutral-400">{place.distanceLabel}</span>
//       </div>
//     </button>
//   );
// }

function ChevronRightIcon({ width = 5, height = 9, className = 'text-cool-neutral-900' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 5 9" fill="none" aria-hidden="true">
      <path d="M1 1L4 4.5L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} />
    </svg>
  );
}

// "탐라로그 V2 / 배너" > ChevronRightOutlineIcon(16x16) 안의 Vector path를 보드 원점 기준으로 옮겨 적은 것.
// 홈의 다른 셰브론(ChevronRightIcon, 5x9 stroke)과 굵기·크기가 달라 별도 컴포넌트로 둔다.
// Penpot에서 이 아이콘은 path(벡터)라 PNG로 내리지 않고 인라인 SVG로 넣는다 — 어떤 DPR에서도 선명하다.
function BannerChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M5.787 11.091C5.535 11.344 5.535 11.756 5.787 12.01C6.041 12.264 6.453 12.264 6.707 12.01L10.18 8.537C10.477 8.24 10.477 7.76 10.18 7.463L6.707 3.99C6.453 3.736 6.041 3.736 5.787 3.99C5.535 4.244 5.535 4.655 5.787 4.909L8.879 8L5.787 11.091Z"
        fill="currentColor"
        fillRule="nonzero"
        className="text-cool-neutral-700"
      />
    </svg>
  );
}

// [보류] 위치 직접 입력 모달(AddressModal) 전용 아이콘
// function SearchIcon() {
//   return (
//     <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
//       <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" className="text-cool-neutral-400" />
//       <path d="M14 14l-3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-cool-neutral-400" />
//     </svg>
//   );
// }
