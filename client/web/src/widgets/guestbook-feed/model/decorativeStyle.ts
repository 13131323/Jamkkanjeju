// API가 주지 않는 순수 장식용 스타일(카드 배치 흔들림, 손글씨 느낌의 포인트 컬러 등)을
// 레코드 key 기반 결정론적 해시로 생성한다 — 매 렌더마다 값이 바뀌지 않도록.

const NOTE_DOT_CLASSES = ['bg-tertiary-600', 'bg-primary-800', 'bg-warm-neutral-400'];
const NOTE_TEXT_CLASSES = ['text-tertiary-800', 'text-warm-neutral-900', 'text-warm-neutral-800'];
const AUDIO_BAR_COUNT = 7;

// 사진 카드 위쪽에 붙이는 마스킹테이프 장식 — 색은 카드마다 랜덤, 위치는 항상 중앙, 각도만 살짝 랜덤.
const TAPE_CLASSES = ['bg-tertiary-400', 'bg-primary-400', 'bg-sunny-yellow-300', 'bg-warm-neutral-300'];
const TAPE_ROTATE_RANGE_DEG: [number, number] = [-6, 6];

// 좌우 오프셋이 피드 컨테이너의 px-4(16px) 패딩을 넘어도, 상위(TravelNotePage)가 overflow-hidden이라
// 가로 스크롤 없이 그대로 잘려 보인다 — 그 여유로 회전/오프셋 범위를 넓게 잡는다.
const SCATTER_ROTATE_RANGE_DEG: [number, number] = [-16, 16];
const SCATTER_OFFSET_X_RANGE_PX: [number, number] = [-22, 22];
const SCATTER_OFFSET_Y_RANGE_PX: [number, number] = [-26, 28];
// 카드 사이 세로 간격(margin-bottom)도 고정값 대신 이 범위에서 랜덤하게 뽑아, 좁았다 넓었다 하는 느낌을 낸다.
const SCATTER_GAP_RANGE_PX: [number, number] = [2, 26];

function hashStringToInt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  // avalanche finalizer(murmur3 스타일) — 위 루프만으로는 "scatter-rotate-1"/"scatter-rotate-2"처럼
  // 비슷한(순차 id) seed가 거의 같은 hash를 내놓아 회전값이 한쪽 방향으로만 살짝씩 드리프트했다.
  // 비트를 한 번 더 섞어서 seed가 1만 달라져도 결과가 크게 벌어지게 한다.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return Math.abs(hash);
}

function hashToRange(seed: string, [min, max]: [number, number]): number {
  const ratio = (hashStringToInt(seed) % 1000) / 1000;
  return min + ratio * (max - min);
}

export function pickNoteColorClasses(key: string): { dotClass: string; textClass: string } {
  const index = hashStringToInt(`note-${key}`) % NOTE_DOT_CLASSES.length;
  return { dotClass: NOTE_DOT_CLASSES[index], textClass: NOTE_TEXT_CLASSES[index] };
}

export function pickTapeStyle(key: string): { tapeClass: string; tapeRotateDeg: number } {
  const index = hashStringToInt(`tape-${key}`) % TAPE_CLASSES.length;
  return {
    tapeClass: TAPE_CLASSES[index],
    tapeRotateDeg: hashToRange(`tape-rotate-${key}`, TAPE_ROTATE_RANGE_DEG),
  };
}

export function pickAudioBars(key: string): number[] {
  const seed = hashStringToInt(`audio-${key}`);
  return Array.from({ length: AUDIO_BAR_COUNT }, (_, i) => 12 + ((seed >> (i * 3)) % 24));
}

export type ScatterTransform = { rotateDeg: number; offsetX: number; offsetY: number; gapPx: number };

// 화이트보드에 대충 핀으로 붙여놓은 듯한 배치를 위해, 카드 중심을 살짝 어긋나게 하고 회전시키며, 카드 간 간격도 들쭉날쭉하게 만든다.
export function pickScatterTransform(key: string): ScatterTransform {
  return {
    rotateDeg: hashToRange(`scatter-rotate-${key}`, SCATTER_ROTATE_RANGE_DEG),
    offsetX: hashToRange(`scatter-offsetX-${key}`, SCATTER_OFFSET_X_RANGE_PX),
    offsetY: hashToRange(`scatter-offsetY-${key}`, SCATTER_OFFSET_Y_RANGE_PX),
    gapPx: hashToRange(`scatter-gap-${key}`, SCATTER_GAP_RANGE_PX),
  };
}
