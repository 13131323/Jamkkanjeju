import { unwrapHeading } from './headingRotation';

// MapMainScreen.tsx의 PlaceMarker 스타일 그대로 — 미션 없는 로컬장소 마커에 사용 (usePlaceMarkers.ts 참고).
// 방명록 클러스터링은 더 이상 없어져서(방명록은 항상 개별 마커) 여기엔 안 쓰인다.
export function createPlaceMarkerElement(name: string, count: number, imageSrc?: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex w-[75px] cursor-pointer flex-col items-center gap-1.5';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'relative h-[52px] w-[49px] drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]';

  const photoBox = document.createElement('div');
  photoBox.className = 'absolute top-1 left-0 h-12 w-12 overflow-hidden rounded-lg border-2 border-cool-neutral-white bg-warm-neutral-200 shadow-[0_4px_10px_rgba(0,0,0,0.5)]';
  if (imageSrc) {
    const img = document.createElement('img');
    img.alt = '';
    img.className = 'h-full w-full object-cover';
    // 원격 이미지 실패 시 배경색만 남은 빈 박스로 자연스럽게 되돌아간다(createContentPinElement와 동일한 처리).
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
    img.src = imageSrc;
    photoBox.appendChild(img);
  }
  iconWrap.appendChild(photoBox);

  const countBadge = document.createElement('span');
  countBadge.className = 'absolute top-0 left-[31px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cool-neutral-white px-1.5 text-label-sm text-warm-neutral-900';
  countBadge.textContent = String(count);
  iconWrap.appendChild(countBadge);

  wrapper.appendChild(iconWrap);

  const NAME_LABEL_MAX_CHARS = 12;

  const nameLabel = document.createElement('span');
  nameLabel.className = 'block h-5 w-fit overflow-hidden whitespace-nowrap rounded-full bg-cool-neutral-950 px-2.5 text-center text-label-sm leading-5 text-cool-neutral-white';
  nameLabel.textContent = name.length > NAME_LABEL_MAX_CHARS ? name.slice(0, NAME_LABEL_MAX_CHARS) : name;
  wrapper.appendChild(nameLabel);

  return wrapper;
}

// MapMainScreen.tsx의 ContentPinMarker 스타일 그대로(size로 배율만 조정).
// 보물찾기/협동미션 로컬장소(미션별 아이콘), 미션 없는 로컬장소(imageSrc 없이 빈 자리)는 사각 아이콘 자리(원본 그대로),
// 방명록 개별 마커(방명록 사진, size 2배)는 내부 이미지를 원형으로 표시 (17지도phase2추가수정.md)
// overflow-hidden을 이중으로 둬서 이미지가 원형 밖으로 삐져나오지 않도록 한다.
export function createContentPinElement(imageSrc?: string, size = 36, circularImage = false): HTMLElement {
  const padding = Math.round(size / 9);

  const wrapper = document.createElement('div');
  wrapper.className = 'cursor-pointer overflow-hidden rounded-full bg-warm-neutral-200';
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  wrapper.style.padding = `${padding}px`;

  const inner = document.createElement('div');
  inner.className = `flex h-full w-full items-center justify-center overflow-hidden bg-cool-neutral-950 ${circularImage ? 'rounded-full' : 'rounded-lg'}`;

  if (imageSrc) {
    const img = document.createElement('img');
    img.alt = '';
    // 미션 아이콘(투명 배경 일러스트, icon-mission-*.png 112x120)은 잘리면 안 되니 contain,
    // 사진(방명록·쿠폰 사용처의 원격 대표 이미지)은 원형 자리를 채워야 해서 cover다.
    // 사진에 contain을 쓰면 원 안에 검은 여백(bg-cool-neutral-950)이 위아래로 남아 깨진 것처럼 보인다.
    img.className = `h-full w-full ${circularImage ? 'object-cover' : 'object-contain'}`;
    // 원격 이미지는 404·차단·만료로 실패할 수 있고, 그때 브라우저는 마커 한가운데에 깨진 이미지
    // 아이콘을 그린다. 실패하면 <img>를 숨겨 안쪽 원만 남긴다 — 엘리먼트는 지우지 않는다
    // (createTreasurePinElement가 이 <img>를 되찾아 src를 갈아 끼운다).
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
    img.addEventListener('load', () => {
      img.style.display = '';
    });
    img.src = imageSrc;
    inner.appendChild(img);
  }

  wrapper.appendChild(inner);
  return wrapper;
}

// 대분류 원마커 색상 종류 — wide 티어(8~9)는 항상 primary, wideSplit 티어(6~7)는 보물찾기=tertiary/협동미션=sunny-yellow (19지도phase3 이후 요청사항)
export type ClusterColorScheme = 'primary' | 'tertiary' | 'sunny-yellow';

const CLUSTER_OUTER_CLASS: Record<ClusterColorScheme, string> = {
  primary: 'bg-warm-neutral-600/70',
  tertiary: 'bg-tertiary-200/70',
  'sunny-yellow': 'bg-sunny-yellow-200/70',
};

const CLUSTER_INNER_GRADIENT: Record<ClusterColorScheme, string> = {
  primary: 'radial-gradient(circle, var(--color-warm-neutral-900), var(--color-warm-neutral-700))',
  tertiary: 'radial-gradient(circle, var(--color-tertiary-600), var(--color-tertiary-300))',
  'sunny-yellow': 'radial-gradient(circle, var(--color-sunny-yellow-600), var(--color-sunny-yellow-300))',
};

// MapMainScreen.tsx의 ClusterMarker 레이아웃 기반 — 대분류 원마커. 외부 원은 반투명 단색, 내부 원은 중심→바깥 그라데이션.
export function createClusterElement(count: number, label: string | undefined, size: number, colorScheme: ClusterColorScheme): HTMLElement {
  const innerSize = size - 23;

  const wrapper = document.createElement('div');
  wrapper.className = `flex cursor-pointer items-center justify-center rounded-full ${CLUSTER_OUTER_CLASS[colorScheme]}`;
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;

  const textColorClass = colorScheme === 'primary' ? 'text-cool-neutral-white' : 'text-warm-neutral-900';

  const inner = document.createElement('span');
  inner.className = `flex flex-col items-center justify-center rounded-full text-heading-h3 font-bold ${textColorClass}`;
  inner.style.width = `${innerSize}px`;
  inner.style.height = `${innerSize}px`;
  inner.style.background = CLUSTER_INNER_GRADIENT[colorScheme];

  const countEl = document.createElement('span');
  countEl.textContent = String(count);
  inner.appendChild(countEl);

  if (label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'text-label-sm font-medium';
    labelEl.textContent = label;
    inner.appendChild(labelEl);
  }

  wrapper.appendChild(inner);
  return wrapper;
}

// 보물찾기(TreasureHunt) step0 지도의 현재 위치 마커 — Penpot TreasureHunt_step0 "Group 130 / Group 134".
//
// 구조(101x101 기준, 디자인 좌표 그대로):
//   Ellipse 36  0,0   92x92  #ff6557 opacity 0.2   (테두리는 stroke opacity 0 → 그리지 않는다)
//   Ellipse 37  14,14 66x66  #ff6557 opacity 0.3   (같음)
//   Union       31,31 39x39  #f1f9e8 링 + 흰 2 외곽선 + shadow 0 4 14 #63584b@0.4
//     Rectangle 22 5,5 29x29 프로필 이미지(원형)
//   Polygon 5   15x13 #ff2828 + 흰 2 외곽선 — 중심에서 반경 36에 떠서 heading 방향을 가리킨다
//
// z-index는 기존 사용자 위치 마커(USER_LOCATION_MARKER_Z_INDEX=20)보다도 위에 둔다 — 두 마커가
// 같은 지도에서 동시에 쓰이는 경우는 없지만(mode=treasure에서는 이 마커만 렌더), 우선순위를 명시해둔다.
export const TREASURE_LOCATION_MARKER_Z_INDEX = 25;

/** 마커 전체 한 변(px). 디자인 Group 130 = 101x101 */
const LOCATION_MARKER_SIZE = 101;
/**
 * 마커 중심. CustomOverlay를 xAnchor/yAnchor 0.5로 붙이므로 이 지점이 실제 GPS 좌표에 온다.
 *
 * 디자인에서는 Ellipse 36/37의 중심(46,46 / 47,47)과 프로필 원의 중심(50.5,50.5)이 몇 px 어긋나 있다.
 * 손으로 배치한 목업의 오차로 보이고, 지도 마커는 중심이 곧 좌표라서 어긋나면 위치가 그만큼 틀린 것이 된다.
 * 그래서 모든 원을 프로필 원 중심에 맞춰 동심원으로 정렬한다.
 */
const LOCATION_MARKER_CENTER = LOCATION_MARKER_SIZE / 2;
/**
 * 방향 삼각형이 마커 중심에서 떨어진 거리(px).
 *
 * 디자인 Polygon 5의 중심 오프셋(28,-23)은 약 36인데, 실기기에서 보면 삼각형이 원에서 뜬 것처럼
 * 보여 방향 표시가 마커와 한 덩어리로 읽히지 않았다. 정확도 원 반지름(46)과 삼각형 크기를
 * 감안해 31로 붙인다 — 원 위에 살짝 얹힌 정도가 된다.
 */
const HEADING_ORBIT_RADIUS = 31;

/**
 * 방향 삼각형이 차지하는 정사각형 한 변(px).
 *
 * 19였는데 실기기에서 작아 방향을 알아보기 어려웠다. 24로 키우면서 회전 축이 어긋나지 않도록
 * 가로·세로를 같게 두고 중심을 orbit 위에 놓는다(직사각형이면 rotate 시 중심이 흔들린다).
 */
const HEADING_TRIANGLE_BOX = 24;

export interface TreasureLocationElement {
  el: HTMLElement;
  /** heading이 무효값(null)이면 방향 삼각형을 숨긴다 — 문서 §4 "heading 무효값 처리" */
  setHeading: (headingDeg: number | null) => void;
}

/**
 * 방향 삼각형이 새 각도까지 도는 시간(ms).
 *
 * 앱의 heading 전송 임계값(3도)에서 실기기 회전 속도를 감안한 값이다. 너무 길면 손을 돌린 뒤에도
 * 삼각형이 따라오지 않아 굼떠 보이고, 너무 짧으면 계단이 그대로 드러난다.
 * linear인 이유는 갱신이 연달아 올 때 매번 감속·가속하며 되레 끊겨 보이지 않게 하려는 것이다.
 */
const HEADING_ROTATION_TRANSITION_MS = 260;

export function createTreasureLocationElement(initialHeadingDeg: number | null, avatarSrc: string): TreasureLocationElement {
  const el = document.createElement('div');
  el.className = 'relative';
  el.style.width = `${LOCATION_MARKER_SIZE}px`;
  el.style.height = `${LOCATION_MARKER_SIZE}px`;

  // 바깥 정확도 원 — 디자인은 흰 테두리가 stroke opacity 0으로 꺼져 있어 색 원만 남는다
  const outerCircle = document.createElement('div');
  outerCircle.className = 'absolute rounded-full';
  outerCircle.style.cssText = `left:${LOCATION_MARKER_CENTER - 46}px;top:${LOCATION_MARKER_CENTER - 46}px;width:92px;height:92px;background:#ff6557;opacity:0.2`;
  el.appendChild(outerCircle);

  const innerCircle = document.createElement('div');
  innerCircle.className = 'absolute rounded-full';
  innerCircle.style.cssText = `left:${LOCATION_MARKER_CENTER - 33}px;top:${LOCATION_MARKER_CENTER - 33}px;width:66px;height:66px;background:#ff6557;opacity:0.3`;
  el.appendChild(innerCircle);

  // 방향 삼각형은 마커 중심을 축으로 도는 래퍼 안에 둔다.
  // 래퍼를 rotate하면 삼각형이 원 주위를 돌면서 항상 바깥을 향한다.
  //
  // transition을 주는 이유: 앱은 heading이 3도(HEADING_SEND_THRESHOLD_DEG) 이상 바뀔 때만
  // 보낸다 — 브릿지·배터리 비용을 줄이려는 의도적 제한이다. 그래서 web이 받는 값은 3도 이상씩
  // 띄어 있는 계단이고 그대로 rotate에 넣으면 뚝뚝 끊겨 보인다. 도착 각도까지 CSS가 채우게
  // 두면 전송 빈도를 올리지 않고도 이어져 보인다.
  const headingWrap = document.createElement('div');
  headingWrap.className = 'absolute';
  headingWrap.style.cssText = [
    'left:0',
    'top:0',
    `width:${LOCATION_MARKER_SIZE}px`,
    `height:${LOCATION_MARKER_SIZE}px`,
    `transition:transform ${HEADING_ROTATION_TRANSITION_MS}ms linear`,
  ].join(';');

  // clip-path 삼각형에는 CSS border가 먹지 않아 흰 외곽선을 SVG stroke로 그린다.
  // viewBox 24x24는 stroke가 밖으로 나갈 자리를 포함한 크기다(HEADING_TRIANGLE_BOX와 같은 값).
  //
  // 모양은 정삼각형이 아니다:
  // - 모서리 세 곳이 **도형 자체로** 둥글다. stroke를 굵혀 둥글게 보이게 하면 흰 외곽선이 함께
  //   두꺼워지므로, 각 모서리에서 두 변을 따라 반경만큼 물러난 점을 Q 커브로 이어 깎았다
  //   (꼭짓점 2.8, 밑변 모서리 2.4). 외곽선 두께는 디자인 값 2 그대로다.
  // - 마커를 향한 밑변의 가운데가 안쪽(꼭짓점 쪽)으로 살짝 들어간다 — Q 커브의 제어점을 위로
  //   당겨 만든다. 원에 붙였을 때 밑변이 원의 곡률을 따라가는 것처럼 보여 한 덩어리로 읽힌다.
  const triangle = document.createElement('div');
  triangle.className = 'absolute';
  triangle.style.cssText = [
    `left:${LOCATION_MARKER_CENTER - HEADING_TRIANGLE_BOX / 2}px`,
    `top:${LOCATION_MARKER_CENTER - HEADING_ORBIT_RADIUS - HEADING_TRIANGLE_BOX / 2}px`,
    `width:${HEADING_TRIANGLE_BOX}px`,
    `height:${HEADING_TRIANGLE_BOX}px`,
    'filter:drop-shadow(0 4px 4px rgba(0,0,0,0.12))',
  ].join(';');
  triangle.innerHTML =
    `<svg width="${HEADING_TRIANGLE_BOX}" height="${HEADING_TRIANGLE_BOX}" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
    '<path d="M13.35 6.05 L19.64 17.5 Q20.8 19.6 18.62 18.61 Q12 15.6 5.38 18.61 Q3.2 19.6 4.36 17.5 L10.65 6.05 Q12 3.6 13.35 6.05 Z" fill="#ff2828" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />' +
    '</svg>';
  headingWrap.appendChild(triangle);
  el.appendChild(headingWrap);

  // 프로필 원 — #f1f9e8 링(5) + 흰 외곽선(2) + 그림자. 안에 기본 캐릭터/사용자 사진이 들어간다.
  const avatarRing = document.createElement('div');
  avatarRing.className = 'absolute flex items-center justify-center overflow-hidden rounded-full';
  avatarRing.style.cssText = [
    `left:${LOCATION_MARKER_CENTER - 19.5}px`,
    `top:${LOCATION_MARKER_CENTER - 19.5}px`,
    'width:39px',
    'height:39px',
    'background:#f1f9e8',
    'box-shadow:0 0 0 2px #ffffff, 0 4px 14px rgba(99,88,75,0.4)',
  ].join(';');

  const avatar = document.createElement('img');
  avatar.src = avatarSrc;
  avatar.alt = '';
  avatar.className = 'rounded-full object-cover';
  avatar.style.cssText = 'width:29px;height:29px';
  avatarRing.appendChild(avatar);
  el.appendChild(avatarRing);

  // rotate에 넣은 마지막 누적 각도. 0/360 경계에서 반대로 한 바퀴 도는 것을 막는다(headingRotation.ts)
  let unwrappedHeading: number | null = null;

  function setHeading(headingDeg: number | null) {
    if (headingDeg === null) {
      // 나침반은 순간적으로 무효값(-1)을 낸다. 그때마다 숨기면 삼각형이 깜빡인다.
      // 한 번이라도 유효한 방향을 받았으면 마지막 방향을 그대로 두고, 처음부터 없을 때만 숨긴다 —
      // 살짝 낡은 방향이 사라졌다 나타나는 것보다 읽기 쉽다.
      if (unwrappedHeading === null) headingWrap.style.display = 'none';
      return;
    }

    unwrappedHeading = unwrapHeading(unwrappedHeading, headingDeg);
    headingWrap.style.display = 'block';
    headingWrap.style.transform = `rotate(${unwrappedHeading}deg)`;
  }
  setHeading(initialHeadingDeg);

  return { el, setHeading };
}

// 보물찾기(TreasureHunt) 지도의 장소 대표 보물 마커 — Penpot TreasureHunt_step1 "Group 113"
// (step0의 Group 113과 좌표·크기·스타일이 완전히 같다).
// 90x90 원 안에 보물 에셋이 들어가고, 오른쪽 위에 개수 배지가 붙는다.
// 디자인의 원 테두리(2px)는 stroke opacity 0이라 그리지 않는다. 배지만 흰 4px 외곽선을 갖는다.
// 그룹 자체에 걸린 그림자(0 4 10 #000000 @0.14)는 원과 배지를 함께 덮으므로 래퍼에 filter로 준다.
export const TREASURE_MARKER_Z_INDEX = 24;

/** 마커 원 지름(px). 디자인은 90(Group 113)과 62(Group 114) 두 가지가 있는데, 지도 마커는
 *  거리에 따라 크기가 변하지 않아야 위치를 읽기 쉬워서 큰 쪽 하나로 고정한다.
 *  줌 레벨에 따라 바뀌는 것은 "마커를 묶는지 흩뿌리는지"이고, 원 크기는 clusterSize(level)처럼
 *  레벨을 따라가지 않는다 — 디자인에 그런 지시가 없다. */
const TREASURE_MARKER_SIZE = 90;

export interface TreasureMarkerElement {
  el: HTMLElement;
  /** 찾음 여부가 바뀌면 에셋만 갈아 끼운다 — 마커를 다시 만들지 않아 깜빡임이 없다 */
  setFound: (found: boolean) => void;
  /** 개수가 바뀌면 배지 문구만 갈아 끼운다. null이면 배지를 숨긴다(다 찾은 상태) */
  setBadgeLabel: (badgeLabel: string | null) => void;
}

export function createTreasureMarkerElement(options: {
  /**
   * 원에 표시할 숫자. prompt §9 "원에 있는 숫자는 3까지 보여짐" — 상한은 호출부가 적용해서 넘긴다.
   * null이면 배지를 그리지 않는다.
   */
  badgeLabel: string | null;
  closedImageSrc: string;
  openImageSrc: string;
  found: boolean;
}): TreasureMarkerElement {
  const { badgeLabel, closedImageSrc, openImageSrc, found } = options;

  const el = document.createElement('div');
  el.className = 'relative cursor-pointer drop-shadow-[0_4px_10px_rgba(0,0,0,0.14)]';
  el.style.width = `${TREASURE_MARKER_SIZE}px`;
  el.style.height = `${TREASURE_MARKER_SIZE}px`;

  const circle = document.createElement('div');
  circle.className = 'bg-cool-neutral-white flex h-full w-full items-center justify-center overflow-hidden rounded-full';

  const img = document.createElement('img');
  img.alt = '';
  img.src = found ? openImageSrc : closedImageSrc;
  // 디자인은 이미지를 cover로 원에 꽉 채우지만(Rectangle 27의 fill이 스프라이트 시트 전체를
  // xMidYMid slice로 깔고 있는, 목업에서 통째로 끌어다 놓은 상태다), 잘라낸 단일 보물상자
  // 에셋을 그렇게 채우면 원 밖으로 나간 상자 모서리가 clip되어 깨져 보인다.
  // 원 안에 온전히 들어가는 여백을 준다.
  img.className = 'h-full w-full object-contain p-3';
  circle.appendChild(img);
  el.appendChild(circle);

  // Frame 537: 25x25, 우측 상단에 딱 붙고(65,0 / 90x90 기준) 흰 4px 외곽선이 밖으로 자란다(stroke align outer).
  // 배지색 #77be36 = tertiary-600, 외곽선/글자 #ffffff = cool-neutral-white — 토큰으로 쓴다.
  const badge = document.createElement('span');
  badge.className = 'bg-tertiary-600 shadow-[0_0_0_4px_var(--color-cool-neutral-white)] absolute flex items-center justify-center rounded-full';
  badge.style.cssText = ['right:0', 'top:0', 'width:25px', 'height:25px'].join(';');

  const badgeText = document.createElement('span');
  badgeText.className = 'text-cool-neutral-white';
  badgeText.style.cssText = 'font-size:14px;line-height:20px;font-weight:600';
  badge.appendChild(badgeText);
  el.appendChild(badge);

  function setFound(nextFound: boolean) {
    img.src = nextFound ? openImageSrc : closedImageSrc;
  }

  function setBadgeLabel(nextBadgeLabel: string | null) {
    badge.style.display = nextBadgeLabel === null ? 'none' : 'flex';
    badgeText.textContent = nextBadgeLabel ?? '';
  }
  setBadgeLabel(badgeLabel);

  return { el, setFound, setBadgeLabel };
}

// 확대(detail 티어)에서 보물마다 그리는 개별 마커.
// 지도 화면이 보물찾기 장소에 쓰는 것과 같은 ContentPinMarker(기본 36px)를 그대로 쓴다 —
// 같은 미션을 같은 아이콘으로 읽히게 하려는 것이고, 크기·여백·색을 여기서 다시 정하지 않는다.
export interface TreasurePinElement {
  el: HTMLElement;
  setFound: (found: boolean) => void;
}

export function createTreasurePinElement(options: { closedImageSrc: string; openImageSrc: string; found: boolean }): TreasurePinElement {
  const { closedImageSrc, openImageSrc, found } = options;

  const el = createContentPinElement(found ? openImageSrc : closedImageSrc);
  // createContentPinElement를 감싸는 대신 안의 <img>를 되찾아 쓴다 — 지도 화면의 핀과
  // 마크업이 한 글자도 달라지지 않아야 해서 그 함수를 고치지 않았다.
  const img = el.querySelector('img');

  return {
    el,
    setFound: (nextFound: boolean) => {
      if (img) img.src = nextFound ? openImageSrc : closedImageSrc;
    },
  };
}
