/**
 * 보물찾기 진행도 API 응답 → 화면 데이터 변환.
 *
 * - POST /api/v1/treasure-missions/{treasureMissionId}/progress (시작/이어하기)
 * - PATCH /api/v1/treasure-missions/{treasureMissionProgressId}/progress (보물 하나 발견)
 * - PATCH .../progress/stop (중단 = 완료 처리)
 *
 * **에셋을 import하지 않는다.** vitest에는 Metro의 에셋 로더가 없어서 `require('...png')`를 든 모듈은
 * 테스트에서 읽을 수 없다(treasureSpots.ts 주석과 같은 이유). 에셋 연결은 treasureHunt.ts가 맡는다.
 */
import { TREASURE_TYPE } from '@packages/shared';
import type { GeneratedApi, TreasureType } from '@packages/shared';
import { readApiErrorCode } from '@/utils/apiError';

export interface TreasureCoords {
  latitude: number;
  longitude: number;
}

/**
 * 화면이 다루는 보물 하나 — 서버 필드만 담은 형태(에셋 제외).
 *
 * 예전 mock은 문자열 id('dolmeong'/'coupon'/'point')와 별도의 order를 들고 있었는데,
 * 서버는 `treasureIndex`(1부터 오름차순) 하나로 보물을 식별한다. 진행도 저장 요청 body가
 * 그 값을 그대로 요구하므로 id 체계를 서버 쪽으로 통일했다 — 화면의 "N번째 보물"도 같은 값이다.
 */
export interface TreasureSpot {
  treasureIndex: number;
  /** 보상 종류. 알려진 순서를 벗어난 보물은 null (아래 TREASURE_REWARD_ORDER 주석 참고) */
  treasureType: TreasureType | null;
  coords: TreasureCoords;
  /** 획득 모달 설명 문구 */
  description: string;
}

/**
 * 보물 순번 → 보상 종류.
 *
 * 서버는 보물마다 종류를 주지 않는다(treasureItems에는 좌표와 발견 여부만 있다). 대신 보상은
 * **보물 하나를 찾을 때마다 AR 캐릭터 → 포인트 → 쿠폰 순서로 하나씩** 지급된다(진행도 저장 응답의
 * reward에 그 회차에 지급된 항목만 채워져 온다 — 라이브 서버로 확인). 그래서 순번을 그 지급 순서에
 * 그대로 대응시킨다. AR 캐릭터가 1번인 것은 화면 흐름상으로도 필요하다 — 캐릭터만 촬영(step3)으로
 * 이어지므로, 그 분기가 어느 보물에 붙는지는 순번으로 정해져 있어야 한다.
 *
 * 이 대응은 "이번 회차에 실제로 무엇이 지급되는가"와 어긋날 수 있다(이미 AR 캐릭터를 받은 사용자가
 * 다시 도전하면 1번째 보물이 포인트를 준다). 획득 모달은 서버에 저장하기 **전에** 뜨므로 지급 결과를
 * 미리 알 수 없고, 그래서 모달 문구는 금액·캐릭터 이름 같은 사실을 말하지 않는다(아래 설명 문구).
 * 실제로 받은 보상은 완료 화면이 서버 응답으로 보여준다.
 */
export const TREASURE_REWARD_ORDER: readonly TreasureType[] = [TREASURE_TYPE.CHARACTER, TREASURE_TYPE.POINT, TREASURE_TYPE.COUPON];

/** 순번에 대응하는 보상 종류. 서버가 보물을 3개보다 많이 주면 대응이 없어 null이다 */
export function resolveTreasureRewardKind(treasureIndex: number): TreasureType | null {
  return TREASURE_REWARD_ORDER[treasureIndex - 1] ?? null;
}

/**
 * 획득 모달의 설명 문구.
 *
 * 금액("천원 쿠폰")·캐릭터 이름("돌담이")을 넣지 않는다 — 모달은 저장 요청 전에 뜨므로 이번에 무엇이
 * 얼마나 지급될지 알 수 없고, 라이브 서버 값(+150P / 3,000원 쿠폰 / 천지연 물방울)은 디자인 목업과도
 * 다르다. 사실을 말할 수 없는 자리에서는 말하지 않는다.
 */
export function resolveTreasureDescription(treasureType: TreasureType | null): string {
  if (treasureType === TREASURE_TYPE.CHARACTER) return 'AR 캐릭터와 함께 사진을 찍어보세요';
  if (treasureType === TREASURE_TYPE.POINT) return '포인트가 적립되었어요';
  if (treasureType === TREASURE_TYPE.COUPON) return '제휴 매장에서 사용할 수 있는 쿠폰이에요';
  return '미션 보상이 지급되었어요';
}

/**
 * 시작/이어하기 응답의 보물 목록 → 화면 보물 목록.
 *
 * treasureIndex 오름차순으로 정렬한다 — 서버가 이미 정렬해서 주지만, 순번이 "N번째 보물" 라벨과
 * 보상 종류 대응에 모두 쓰이므로 순서에 의존하는 쪽을 응답 순서에 맡기지 않는다.
 */
export function toTreasureSpots(treasureItems: readonly GeneratedApi.TreasureItemResponse[]): TreasureSpot[] {
  return [...treasureItems]
    .sort((left, right) => left.treasureIndex - right.treasureIndex)
    .map((item) => {
      const treasureType = resolveTreasureRewardKind(item.treasureIndex);
      return {
        treasureIndex: item.treasureIndex,
        treasureType,
        coords: { latitude: item.location.lat, longitude: item.location.lng },
        description: resolveTreasureDescription(treasureType),
      };
    });
}

/**
 * 이미 찾은 보물 번호. 이어하기로 들어오면 isFound가 true인 항목이 섞여 온다.
 * 진행도 저장 응답의 foundTreasureIndexes와 같은 형태(오름차순)로 맞춘다.
 */
export function toFoundTreasureIndexes(treasureItems: readonly GeneratedApi.TreasureItemResponse[]): number[] {
  return treasureItems
    .filter((item) => item.isFound)
    .map((item) => item.treasureIndex)
    .sort((left, right) => left - right);
}

/**
 * 회차 동안 지급된 보상을 누적한다.
 *
 * **이 함수가 없으면 완료 화면이 보상을 한 줄만 보여준다.** 보물찾기는 보물을 찾을 때마다 보상을
 * 하나씩 지급하고, 각 응답의 reward에는 그 요청으로 지급된 항목만 들어 있다. 마지막(완료) 응답만
 * 넘기면 거기엔 쿠폰 하나뿐이거나(이미 다 받은 회차라면) 전부 null이다. 문화 미션은 완료 응답 하나가
 * 보상 전체를 담아 와서 이 문제가 없다.
 *
 * 병합 기준은 null/undefined다 — falsy가 아니다. 서버가 내려준 point 0은 "0P를 지급했다"는 실제
 * 값이라 미지급(null)과 구분해야 한다(missionHome.ts의 toMissionRewards와 같은 규칙).
 *
 * 언제나 세 항목이 있는 객체를 돌려준다. 완료 화면(constants/missionComplete.ts)이 reward가 null이면
 * "아직 모른다"로 보고 디자인 폴백 행을 쓰기 때문에, "아무것도 못 받았다"는 결과는 객체로 전달해야 한다.
 */
export function mergeGrantedRewards(
  accumulated: GeneratedApi.GrantedRewardResponse | null | undefined,
  granted: GeneratedApi.GrantedRewardResponse | null | undefined,
): GeneratedApi.GrantedRewardResponse {
  return {
    arCharacter: granted?.arCharacter ?? accumulated?.arCharacter ?? null,
    point: granted?.point ?? accumulated?.point ?? null,
    coupon: granted?.coupon ?? accumulated?.coupon ?? null,
  };
}

/** 서버가 진행도 저장/중단에서 내려주는 도메인 에러코드 */
export const TREASURE_PROGRESS_ERROR_CODE = {
  /** 진행 중인 진행도가 없다 — 이미 완료됐거나 다른 기기에서 끝난 경우 */
  PROGRESS_NOT_FOUND: 'TREASURE_MISSION_PROGRESS_NOT_FOUND',
  /** 그 번호의 보물이 없다 */
  ITEM_NOT_FOUND: 'TREASURE_ITEM_NOT_FOUND',
  /** 이미 찾은 보물을 다시 보냈다 */
  ITEM_ALREADY_FOUND: 'TREASURE_ITEM_ALREADY_FOUND',
} as const;

/**
 * 에러 응답 바디의 code.
 *
 * 구현은 `utils/apiError.ts`로 옮겼다(협동 미션도 같은 함수를 쓴다). 기존 호출부와 테스트가
 * 이 이름으로 가져가고 있어 여기서 다시 내보낸다.
 */
export { readApiErrorCode };

/**
 * 진행도 저장 실패를 화면이 취할 행동으로 좁힌다.
 *
 * 어떤 실패에도 사용자를 화면에 붙잡아 두지 않는 것이 목적이다(culture.tsx의 abandonMission이
 * 중단 실패를 삼키고 나가는 것과 같은 태도).
 * - already-found: 서버는 이미 찾은 것으로 알고 있다. 로컬 목록만 맞추고 계속 진행한다.
 * - progress-gone: 이어갈 진행도가 없다. 이미 지급된 보상을 들고 완료 화면으로 내보낸다.
 * - retryable: 원인 불명(네트워크 등). 보물을 못 찾은 상태로 남겨 다시 탭할 수 있게 한다.
 */
export type TreasureProgressFailure = 'already-found' | 'progress-gone' | 'retryable';

export function resolveTreasureProgressFailure(error: unknown): TreasureProgressFailure {
  const code = readApiErrorCode(error);

  if (code === TREASURE_PROGRESS_ERROR_CODE.ITEM_ALREADY_FOUND) return 'already-found';
  if (code === TREASURE_PROGRESS_ERROR_CODE.PROGRESS_NOT_FOUND) return 'progress-gone';
  // ITEM_NOT_FOUND는 그 번호의 보물이 애초에 없다는 뜻이라 재시도가 의미 없지만, 화면에서 할 수 있는
  // 일은 "그 보물을 못 찾은 상태로 두기"뿐이라 retryable과 같은 처리로 묶는다.
  return 'retryable';
}

/** 찾은 보물 번호 목록에 하나를 더한다(중복 없이 오름차순) */
export function withFoundTreasureIndex(foundTreasureIndexes: readonly number[], treasureIndex: number): number[] {
  if (foundTreasureIndexes.includes(treasureIndex)) return [...foundTreasureIndexes];
  return [...foundTreasureIndexes, treasureIndex].sort((left, right) => left - right);
}

/**
 * 보물을 다 찾았는지.
 *
 * 목표 개수는 서버의 treasureCount다. 아직 시작 응답이 오지 않아 0인 동안은 완료로 보지 않는다 —
 * `0 >= 0`이 참이 되어 빈 진행도가 완료로 판정되는 것을 막는다.
 */
export function isTreasureRunComplete(foundCount: number, treasureCount: number): boolean {
  if (treasureCount <= 0) return false;
  return foundCount >= treasureCount;
}

/**
 * 장소 id.
 *
 * 생성 타입 TreasureMissionLocationResponse가 locationId를 required로 들고 있어 정상 응답에서는
 * 항상 값이 있다. 그래도 판정을 남겨 두는 이유는 이 값이 그대로 GET /api/v1/map/locations/{id}로
 * 나가기 때문이다 — 낡은 서버·목 데이터에서 0이나 음수가 섞여 들어오면 404가 나므로
 * 유효한 양의 정수가 아니면 null로 막고, 호출부가 장소 설명과 "장소 상세보기"를 함께 감춘다.
 */
export function resolveTreasureLocationId(location: GeneratedApi.TreasureMissionLocationResponse): number | null {
  const { locationId } = location;

  if (typeof locationId !== 'number' || !Number.isInteger(locationId) || locationId <= 0) return null;
  return locationId;
}

/**
 * 장소 상세의 locationDescription을 "한 줄 소개" 한 줄로 줄인다.
 *
 * prompt §9가 이 자리를 "최대 글자수 20자인 장소 한 줄 소개"로 못박고 있는데 서버가 주는
 * locationDescription은 TourAPI에서 온 여러 문장짜리 설명이다. 그대로 slice하면 단어 중간이
 * 잘려 읽히지 않으므로, 한도 안에서 마지막 공백까지만 남기고 말줄임표를 붙인다.
 *
 * 문장이 한도 안에 들어오면 말줄임표 없이 그대로 쓴다. 설명이 비어 있으면(TourAPI 조회 실패 시
 * 서버가 null을 준다) null을 돌려주고, 호출부가 카드를 아예 그리지 않는다 —
 * 없는 설명을 지어내 채우지 않는다.
 */
export function toPlaceSummary(description: string | null | undefined, maxLength: number): string | null {
  if (typeof description !== 'string') return null;

  // TourAPI 설명에는 줄바꿈·연속 공백이 섞여 있어 한 줄로 눌러 준다
  const text = description.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return null;
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  // 한도 안에 공백이 없으면(긴 한 단어) 어쩔 수 없이 글자 수로 자른다
  const head = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;

  return `${head}…`;
}

/**
 * 보상 이름. 획득 모달의 "보물을 찾아 **{}**를(을) 획득했습니다."에 들어간다.
 *
 * 이 모달은 진행도를 저장하기 **전에** 뜨므로 지급 응답(grantedReward)이 아직 없다. 그래서
 * 미션 홈의 "아직 지급되지 않은 보상"(remainingReward)을 읽는다 — 이름·금액이 거기 이미 있다.
 * 값이 비어 있으면 종류만 말한다(디자인의 "AR 캐릭터 보물이"에서 이름만 빠진 형태다).
 */
export function resolveTreasureRewardLabel(treasureType: TreasureType | null, reward: GeneratedApi.RemainingRewardResponse | GeneratedApi.GrantedRewardResponse | null | undefined): string {
  if (treasureType === TREASURE_TYPE.CHARACTER) {
    const name = reward?.arCharacter?.name;
    return name ? `AR 캐릭터 ${name}` : 'AR 캐릭터';
  }
  if (treasureType === TREASURE_TYPE.POINT) {
    const point = reward?.point;
    return typeof point === 'number' ? `${point.toLocaleString('ko-KR')}포인트` : '포인트';
  }
  if (treasureType === TREASURE_TYPE.COUPON) {
    const price = reward?.coupon?.couponPrice;
    return typeof price === 'number' ? `${price.toLocaleString('ko-KR')}원 쿠폰` : '쿠폰';
  }
  // 서버가 3개보다 많이 준 보물 — 종류를 모르니 보상이라고만 한다
  return '보상';
}

/**
 * 시작/이어하기 응답을 받은 화면이 할 일.
 *
 * - `play`: 진행 중인 진행도다. 지도를 그리고 보물을 찾게 둔다.
 * - `already-complete`: 서버가 **이미 끝난 진행도**를 돌려줬다. 사냥 화면을 그리면 안 된다.
 */
export type TreasureStartOutcome = 'play' | 'already-complete';

/**
 * 시작 응답의 `missionProgressStatus`로 화면을 정한다.
 *
 * POST .../{treasureMissionId}/progress는 진행 중인 진행도가 있으면 그것을 그대로 돌려준다.
 * 그 진행도가 이미 `COMPLETED`일 수 있다 — 중단("포기 할래요")도 서버는 완료로 처리하는데
 * (TreasureMissionStopResponse 문서: 상태는 항상 COMPLETED), 그때 찾은 보물은 3개가 아닐 수 있다.
 * 상태를 보지 않고 `treasureItems`의 `isFound`만 복원하면 두 가지로 무너진다.
 * - 셋 다 찾은 진행도: 남은 보물이 없어 진입 시트가 뜨지 않는다 → 3/3 지도에 갇힌다
 * - 중단으로 끝난 진행도: 남은 보물이 있어 시트가 뜨고, 실제로 걸어가 보물을 눌러야
 *   PATCH가 404(TREASURE_MISSION_PROGRESS_NOT_FOUND)로 떨어져 보상 없는 완료 화면으로 밀린다
 * 둘 다 "끝난 미션을 진행 중인 것처럼 그렸다"는 같은 원인이다. 상태를 먼저 본다.
 *
 * @param photoOnly `?start=photo` — 이미 끝낸 미션에 **일부러** 사진만 찍으러 들어온 경로다
 *   (intro의 완료 화면 "보물이랑 사진찍기"). 이때 COMPLETED는 정상이라 되돌려 보내면 안 된다.
 */
export function resolveTreasureStartOutcome(missionProgressStatus: string, photoOnly: boolean): TreasureStartOutcome {
  if (photoOnly) return 'play';
  return missionProgressStatus === 'COMPLETED' ? 'already-complete' : 'play';
}
