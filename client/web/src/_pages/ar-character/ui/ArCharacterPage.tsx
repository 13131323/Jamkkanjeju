'use client';

import { use, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { useArCharacterDetail, type ArCharacterColorFamily, type ArCharacterDetail } from '@entities/ar-character';
import { sendToApp } from '@shared/lib/bridge/utils';

type ArCharacterPageProps = {
  params: Promise<{ characterId: string }>;
};

/**
 * 캐릭터 색상 계열별 페이지 배경·카드 톤·칩 스타일.
 *
 * Tailwind는 동적으로 조립한 클래스명을 인식하지 못하므로 HomePage의 MISSION_BANNER_STYLE과
 * 동일하게 **완성된 클래스 문자열**을 매핑해 둔다.
 *
 * 카드 바탕도, **페이지 전체 배경도** 각 계열의 `50`이다(사용자 지시) — globals.css의
 * `--color-primary-50: #ecf9fd` / `--color-tertiary-50: #f1f9e8` / `--color-sunny-yellow-50: #fef9e1`.
 * 배경은 그라데이션이 아니라 단색이다 — 시안(Mypage_CharScreen2.1)도 위아래가 같은 톤이다.
 *
 * 그림자는 검정이 아니라 **그 색이 짙어지는 느낌**이어야 한다(사용자 지시). 검정 그림자는 파스텔
 * 배경 위에서 때가 낀 것처럼 탁해진다. 계열의 600을 옅게 깔아 같은 색이 가라앉은 것처럼 보이게 한다.
 * y 오프셋을 두지 않는 이유: 그림자가 **맨 바깥 선의 상하좌우**로 고르게 번져야 한다(사용자 지시).
 * 아래로만 떨어뜨리면 카드가 떠 있는 게 아니라 얹혀 있는 것처럼 보인다.
 *
 * 모눈은 계열을 타지 않는다 — 흰 선 하나로 세 계열 모두에서 같게 보인다(GridBackdrop 주석).
 */
const COLOR_THEME: Record<
  ArCharacterColorFamily,
  { pageBackground: string; cardTint: string; cardBorder: string; cardShadow: string; pill: string; pillText: string; badge: string; chipBorder: string; sparkle: string }
> = {
  primary: {
    pageBackground: 'bg-primary-50',
    cardTint: 'bg-primary-50',
    cardBorder: 'border-primary-300',
    // primary-600 #0da8dc
    cardShadow: 'shadow-[0_0_88px_28px_rgba(13,168,220,0.32)]',
    pill: 'bg-primary-100',
    pillText: 'text-primary-700',
    badge: 'bg-primary-500',
    chipBorder: 'border-primary-300',
    sparkle: 'fill-primary-100',
  },
  tertiary: {
    pageBackground: 'bg-tertiary-50',
    cardTint: 'bg-tertiary-50',
    cardBorder: 'border-tertiary-300',
    // tertiary-600 #77be36
    cardShadow: 'shadow-[0_0_88px_28px_rgba(119,190,54,0.32)]',
    pill: 'bg-tertiary-100',
    pillText: 'text-tertiary-700',
    badge: 'bg-tertiary-600',
    chipBorder: 'border-tertiary-300',
    sparkle: 'fill-tertiary-100',
  },
  sunnyYellow: {
    pageBackground: 'bg-sunny-yellow-50',
    cardTint: 'bg-sunny-yellow-50',
    cardBorder: 'border-sunny-yellow-300',
    // sunny-yellow-600 #b19210
    cardShadow: 'shadow-[0_0_88px_28px_rgba(177,146,16,0.32)]',
    pill: 'bg-sunny-yellow-100',
    pillText: 'text-sunny-yellow-800',
    badge: 'bg-sunny-yellow-500',
    chipBorder: 'border-sunny-yellow-400',
    sparkle: 'fill-sunny-yellow-100',
  },
};

export function ArCharacterPage({ params }: ArCharacterPageProps) {
  const { characterId } = use(params);
  const router = useRouter();
  const { data: character, isLoading, isError } = useArCharacterDetail(characterId);

  if (isLoading) {
    return <CenteredMessage onBack={() => router.back()} text="불러오는 중..." />;
  }
  if (isError || !character) {
    return <CenteredMessage onBack={() => router.back()} text="캐릭터 정보를 찾을 수 없어요" />;
  }

  return <ArCharacterCardScreen character={character} onBack={() => router.back()} />;
}

function CenteredMessage({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="bg-warm-neutral-50 relative flex h-dvh w-full items-center justify-center px-5 text-center">
      <button
        type="button"
        aria-label="뒤로가기"
        onClick={onBack}
        className="bg-cool-neutral-white absolute left-5 flex h-8 w-8 items-center justify-center rounded-full"
        style={{ top: `calc(var(--safe-area-top) + 12px)` }}
      >
        <ChevronLeftIcon />
      </button>
      <p className="text-label-md text-warm-neutral-600">{text}</p>
    </div>
  );
}

/**
 * "함께 사진 찍기" — 앱에 촬영 화면을 열어 달라고 부탁한다.
 *
 * 카메라는 네이티브만 열 수 있어서 web은 무엇을 찍을지만 넘긴다. 앱 WebView 밖(일반 브라우저)에서는
 * `sendToApp`이 조용히 넘어간다 — 이 버튼은 앱 전용 기능이라 그 편이 맞다.
 *
 * `imageUrl`은 마이페이지 API가 이미 절대 URL로 내려주므로 그대로 전달한다(번들 정적 자산이 아니다).
 * 브릿지 계약의 `characterId`는 문자열이라 숫자 id를 문자열로 바꿔 보낸다.
 */
function requestCharacterPhoto(character: ArCharacterDetail): void {
  sendToApp({ type: 'CHARACTER_PHOTO', payload: { characterId: String(character.id), name: character.name, imageUrl: character.imageUrl } });
}

/**
 * 지금 보이는 카드 면을 PNG로 떠서 앱에 저장을 부탁한다.
 *
 * 갤러리 쓰기는 네이티브만 할 수 있고, 카드는 web이 그리므로 **그림을 만들 수 있는 건 web뿐**이다.
 * 그래서 여기서 DOM을 그대로 이미지로 뜬 뒤 브릿지로 넘긴다(`SAVE_IMAGE`).
 *
 * 뒤집힌 상태에서는 카드가 `rotateY(180deg)`라 그대로 뜨면 좌우가 뒤집힌 그림이 나온다.
 * 그래서 **면 하나(앞 또는 뒤)의 노드만** 넘겨받아 뜬다 — 회전은 부모에 걸려 있으므로 면 자체는 반듯하다.
 *
 * `pixelRatio: 2`인 이유: 카드가 300dp 남짓이라 1배로 뜨면 갤러리에서 흐릿하다.
 * 더 키우면 base64 문자열이 그만큼 커져 브릿지로 넘기는 비용이 커진다.
 */
async function captureCardPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image');
  const rect = node.getBoundingClientRect();

  return toPng(node, {
    pixelRatio: 2,
    // 뒷면 노드에는 `rotateY(180deg)`·`backface-visibility: hidden`·`position: absolute`가 걸려 있다.
    // 그대로 뜨면 좌우가 뒤집히거나 아예 빈 그림이 나오므로 **복제본에서만** 걷어낸다.
    // 크기는 원본에서 재서 넘긴다 — absolute를 풀면 스스로 크기를 잃는다.
    width: rect.width,
    height: rect.height,
    style: { transform: 'none', backfaceVisibility: 'visible' },
  });
}

function ArCharacterCardScreen({ character, onBack }: { character: ArCharacterDetail; onBack: () => void }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const theme = COLOR_THEME[character.colorFamily];

  /** 저장 버튼 — 지금 보고 있는 면을 저장한다. 뒤집어 둔 채 누르면 뒷면이 저장돼야 자연스럽다 */
  async function saveCard() {
    const node = isFlipped ? backRef.current : frontRef.current;
    if (node === null || isSaving) return;

    setIsSaving(true);
    try {
      const dataUrl = await captureCardPng(node);
      // 파일 이름에 캐릭터 id를 넣어 여러 장을 저장해도 갤러리에서 구분된다.
      // 계약이 `[\w-]+`만 받는데(브릿지 스키마), id가 항상 숫자라 별도 정제 없이도 만족한다.
      sendToApp({ type: 'SAVE_IMAGE', payload: { dataUrl, fileName: `tamnalog-${character.id}` } });
    } catch (error) {
      // 저장 결과는 앱이 토스트로 알리지만, **뜨는 데 실패하면 앱은 아무것도 못 받는다** —
      // 조용히 끝나면 "눌러도 아무 일이 없다"가 되므로 원인을 남긴다.
      Sentry.captureException(error instanceof Error ? error : new Error(`card capture failed: ${String(error)}`));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={`relative flex h-dvh w-full flex-col overflow-hidden ${theme.pageBackground}`}>
      <GridBackdrop />

      {/* 시안(Mypage_CharScreen2.1): 뒤로가기·저장 **둘 다 흰 원**이다.
          그림자는 없다 — 이 화면에서 그림자를 갖는 건 **가운데 카드 하나뿐**이다(사용자 지시).

          z-20인 이유: 카드의 넓은 글로우는 **DOM 순서상 뒤에 오는 형제**가 그리는데, 같은 z-10이면
          나중에 그려진 쪽이 위에 얹힌다. 그래서 헤더의 흰 원 위로 초록 글로우가 덮여 원이 반투명하게
          보였다(기기 픽셀로 확인: 원이 흰색 대신 배경 톤이었다). 한 단계 올려 글로우 위로 뺀다.
          "카드 뒤집기"가 멀쩡했던 건 그게 카드보다 뒤에 있어서 이미 글로우 위였기 때문이다. */}
      <div className="relative z-20 flex items-center justify-between px-5" style={{ paddingTop: `calc(var(--safe-area-top) + 12px)` }}>
        <button type="button" aria-label="뒤로가기" onClick={onBack} className="bg-cool-neutral-white flex h-9 w-9 items-center justify-center rounded-full">
          <ChevronLeftIcon />
        </button>
        <button type="button" aria-label="카드 이미지 저장" onClick={saveCard} disabled={isSaving} className="bg-cool-neutral-white flex h-9 w-9 items-center justify-center rounded-full">
          <DownloadIcon />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-6 pt-3">
        <div className="min-h-0 w-full max-w-[300px] flex-1" style={{ perspective: 1200 }}>
          {/*
            앞뒤를 **같은 grid 칸에 겹쳐** 놓는다. 예전에는 뒷면만 `absolute inset-0`이라 칸 높이가
            앞면으로만 정해졌고, 뒷면 글이 그보다 길면 카드 밖으로 넘쳐 아래 "카드 뒤집기"를
            덮어 버렸다(기기에서 확인). grid는 두 면 중 **큰 쪽**을 칸 높이로 잡아 준다.
          */}
          {/* 행/열 트랙을 `minmax(0,1fr)`로 못박는다. grid의 기본 트랙은 `auto`라서 **내용이 더 크면
              칸이 그만큼 늘어나고**, 늘어난 카드가 칸 밖으로 삐져나와 아래 "카드 뒤집기"의 윗여백을
              그대로 먹어 버렸다(기기 픽셀로 확인: 카드 밑변과 알약 윗변이 딱 붙어 있었다).
              1fr로 고정하면 카드가 칸 높이에 맞춰지고, 넘치는 내용은 카드 안쪽에서 스크롤된다. */}
          <div
            className="grid h-full [grid-template-columns:minmax(0,1fr)] [grid-template-rows:minmax(0,1fr)] transition-transform duration-500"
            style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            <div ref={frontRef} className="h-full [grid-area:1/1]" style={{ backfaceVisibility: 'hidden' }}>
              <CardFrame
                edgeClassName="bg-cool-neutral-white"
                bandClassName={theme.cardTint}
                borderClassName="border-cool-neutral-white"
                shadowClassName={theme.cardShadow}
                sparkleClassName={theme.sparkle}
              >
                <CardFront character={character} theme={theme} />
              </CardFrame>
            </div>
            {/* 뒷면: 앞면과 색을 맞바꾼다 — 1·3·4 카드 색 / 2 흰색. 3겹에만 진한 선이 남는다 */}
            <div ref={backRef} className="h-full [grid-area:1/1]" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <CardFrame edgeClassName={theme.cardTint} bandClassName="bg-cool-neutral-white" borderClassName={theme.cardBorder} shadowClassName={theme.cardShadow} sparkleClassName={theme.sparkle}>
                <CardBack character={character} theme={theme} />
              </CardFrame>
            </div>
          </div>
        </div>
      </div>

      {/* 시안: 카드 바로 아래 붙는 작은 흰 알약. 카드보다 가벼워야 "보조 동작"으로 읽힌다.
          CTA 칸에 두지 않는다 — 아래 칸은 "함께 사진 찍기" 하나만 갖는다(사용자 지시).

          카드 칸 **밖에** 둔다. 안에 두면 뒷면처럼 내용이 긴 카드에서 알약이 칸 끝으로 밀려
          잘려 보인다(기기에서 확인) — 카드만 늘어나고 이 버튼은 늘 카드와 CTA 사이에 남아야 한다.

          위아래 padding이 같아야 **카드와 CTA의 정가운데**에 선다(사용자 지시).
          그래서 위 칸은 pt만 갖고 아래를 비워 뒀다 — 한쪽에만 여백이 있으면 알약이 위로 붙는다. */}
      <div className="relative z-10 flex shrink-0 justify-center py-4">
        <button
          type="button"
          onClick={() => setIsFlipped((prev) => !prev)}
          className="bg-cool-neutral-white text-label-md flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-gray-900"
        >
          <FlipIcon />
          카드 뒤집기
        </button>
      </div>

      <div className="relative z-10 px-5" style={{ paddingBottom: `max(20px, var(--safe-area-bottom))` }}>
        <button type="button" onClick={() => requestCharacterPhoto(character)} className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white w-full rounded-full py-4 font-bold">
          함께 사진 찍기
        </button>
      </div>
    </div>
  );
}

/**
 * 배경의 옅은 모눈. 선은 계열과 무관하게 **흰색**이다(사용자 지시).
 *
 * 배경이 계열의 `50`이라 흰 선은 배경보다 밝은 쪽으로 살짝 뜬다 — 눈에 띄지 않으면서
 * 바탕이 비어 보이지 않게 하는 게 이 모눈의 역할이다.
 */
function GridBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.7)_0px,rgba(255,255,255,0.7)_1px,transparent_1px,transparent_44px),repeating-linear-gradient(90deg,rgba(255,255,255,0.7)_0px,rgba(255,255,255,0.7)_1px,transparent_1px,transparent_44px)]"
    />
  );
}

/**
 * 카드 틀 — 가장자리부터 **네 겹**이다(사용자 설명 + 시안 픽셀).
 *
 *   1) 가장 바깥 얇은 테 → 2) 넓은 띠 → 3) 테두리가 있는 테 → 4) 내용이 놓이는 넓은 면
 *
 * 앞뒤가 색을 맞바꾼다. "도감 색"은 마이페이지 도감 타일의 배경색과 같은 계열이다:
 *   - 앞면: 1·3·4 = 흰색 / 2 = 도감 색
 *   - 뒷면: 1·3·4 = 도감 색 / 2 = 흰색, 그리고 3의 테두리는 도감 색보다 **진한 색**
 *
 * 3과 4는 색이 같아서 눈에는 "띠 다음에 테두리 선 하나"로 보인다 — 그 선이 3의 테두리다.
 *
 * 별 장식은 4의 네 모서리에 놓인다. 색을 테마에서 받는 이유: 흰 별은 흰 면 위에서 사라진다.
 *
 * `h-full`이 붙는 이유: 앞뒤를 같은 grid 칸에 겹쳐 두면 칸 높이는 **큰 쪽**으로 잡히는데,
 * 틀이 스스로 늘어나지 않으면 짧은 면만 작게 남아 **앞뒤 크기가 달라 보인다**(사용자 확인).
 */
function CardFrame({
  edgeClassName,
  bandClassName,
  borderClassName,
  shadowClassName,
  sparkleClassName,
  children,
}: {
  /** 1·3·4겹의 배경색 */
  edgeClassName: string;
  /** 2겹(넓은 띠)의 배경색 */
  bandClassName: string;
  /** 3겹의 테두리색. 앞면은 흰색이라 선이 보이지 않고, 뒷면만 진한 선이 남는다 */
  borderClassName: string;
  /** 계열 색이 짙어지는 그림자(검정 아님) */
  shadowClassName: string;
  sparkleClassName: string;
  children: ReactNode;
}) {
  return (
    // 1겹: 가장 바깥 테(p-1 = 4px)
    <div className={`h-full rounded-[28px] p-1 ${edgeClassName} ${shadowClassName}`}>
      {/* 2겹: 넓은 띠 */}
      <div className={`h-full rounded-[24px] p-2.5 ${bandClassName}`}>
        {/* 3겹: 1겹과 **같은 두께**(p-1)의 테. 앞면에서는 테두리까지 흰색이라 선이 드러나지 않는다 */}
        <div className={`h-full rounded-[20px] border p-1 ${edgeClassName} ${borderClassName}`}>
          {/* 4겹: 내용이 놓이는 넓은 면 */}
          <div className={`flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-[16px] ${edgeClassName}`}>
            <div className="flex justify-between">
              <SparkleIcon className={sparkleClassName} />
              <SparkleIcon className={sparkleClassName} />
            </div>
            {children}
            <div className="flex justify-between">
              <SparkleIcon className={sparkleClassName} />
              <SparkleIcon className={sparkleClassName} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardFront({ character, theme }: { character: ArCharacterDetail; theme: (typeof COLOR_THEME)[ArCharacterColorFamily] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="relative h-44 w-44">
        {/* 원격 URL이라 next.config.ts images에 등록되지 않은 도메인 — next/image 최적화 대상이 아니다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={character.imageUrl} alt="" aria-hidden="true" className="h-full w-full object-contain" />
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <span className={`text-label-md rounded-full px-4 py-1.5 font-medium ${theme.pill} ${theme.pillText}`}>{character.acquiredAtLabel}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-heading-h3 text-cool-neutral-950 font-bold">{character.name}</span>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${theme.badge}`}>
            <CheckIcon />
          </span>
        </div>
        <span className="text-body-md text-warm-neutral-600">{character.acquiredPlaceLabel}</span>
      </div>
    </div>
  );
}

function CardBack({ character, theme }: { character: ArCharacterDetail; theme: (typeof COLOR_THEME)[ArCharacterColorFamily] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-2">
      <div className="m-auto flex w-full flex-col gap-5">
        <div className="flex flex-col gap-3">
          <p className="text-heading-h3 text-warm-neutral-900 font-semibold">{character.catchphrase}</p>
          <p className="text-body-sm text-cool-neutral-700">{character.description}</p>
          {/* 시안(Mypage_CharScreen2.2)의 해시태그는 **테두리만 있는 흰 칩**이다.
            채운 칩이면 바로 아래 "획득 조건"의 흰 줄들과 무게가 비슷해져 두 묶음이 붙어 보인다 */}
          <div className="flex flex-wrap gap-2">
            {character.hashtags.map((tag) => (
              <span key={tag} className={`bg-cool-neutral-white text-label-md rounded-full border px-2.5 py-1 font-medium ${theme.chipBorder} ${theme.pillText}`}>
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-label-lg text-cool-neutral-950 font-bold">획득 조건</p>
          <div className="flex flex-col gap-2">
            {character.acquiredMissions.map((mission) => (
              <div key={mission.id} className="bg-cool-neutral-white flex items-center gap-2.5 rounded-xl px-4 py-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${theme.badge}`}>
                  <CheckIcon />
                </span>
                <span className="text-body-md text-cool-neutral-900">{mission.missionTitle}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 카드 모서리 장식.
 *
 * 시안의 모양은 **마름모인데 네 변이 안쪽으로 둥글게 휜** 네 갈래 별이다(사용자 설명).
 * 각 변을 중심 쪽으로 당기는 베지어로 그린다 — 직선이면 그냥 마름모이고, 바깥으로 휘면 잎사귀가 된다.
 *
 * 세로 갈래가 가로보다 길어서 viewBox는 정사각으로 두고 **폭보다 높이를 크게** 준다
 * (preserveAspectRatio="none"이라 그만큼 늘어난다). 좌표를 비대칭으로 적는 것보다 크기만 바꿔 쓰기 쉽다.
 */
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg width="25" height="43" viewBox="0 0 24 24" fill="none" aria-hidden="true" preserveAspectRatio="none" className={className}>
      {/* 네 갈래 끝은 뾰족하지 않고 **살짝 둥글다**(사용자 지시). 끝점을 0.55만큼 깎아 두고
          원래 꼭짓점을 지나는 짧은 2차 곡선(Q)으로 이어 붙여 모서리를 굴린다.
          C의 제어점은 원래 값 그대로라 안쪽으로 휜 모양은 바뀌지 않는다. */}
      <path
        d="M11.45 0.9 Q12 0 12.55 0.9
           C13.1 7.5 16.5 10.9 23.1 11.45 Q24 12 23.1 12.55
           C16.5 13.1 13.1 16.5 12.55 23.1 Q12 24 11.45 23.1
           C10.9 16.5 7.5 13.1 0.9 12.55 Q0 12 0.9 11.45
           C7.5 10.9 10.9 7.5 11.45 0.9 Z"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

/** 시안: 아래로 향하는 두툼한 화살표 + 받침 트레이(위가 열린 상자) */
function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-warm-neutral-800">
      <path d="M12 3.5v8.4m0 0 3.5-3.5M12 11.9 8.5 8.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13.6v3.9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * "카드 뒤집기" 아이콘 — 두 갈래 원형 화살표.
 *
 * 예전 아이콘은 호 끝을 짧은 갈고리로 그려서 화살표로 읽히지 않았다. 시안은 **채운 삼각 촉**이라
 * 선(stroke)이 아니라 채움(fill) 한 덩어리로 그린다.
 */
function FlipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="text-warm-neutral-800">
      <path
        fill="currentColor"
        d="M12 6V9l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1.5 5.2l2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-cool-neutral-white" />
    </svg>
  );
}
