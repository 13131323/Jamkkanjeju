/**
 * KST(UTC+9) 벽시계 기준, offset 없는 ISO 8601 문자열을 만든다.
 *
 * 왜 별도 모듈인가: POST /api/v1/treasure-missions/pictures-with-character의 `takenAt`이
 * "KST 기준 offset 없는 ISO 8601"(예: `2026-08-26T14:32:10`)만 받는다. 서버는
 * `datetime.fromisoformat` 으로 파싱한 뒤 **tzinfo가 붙어 있으면 거절**하고(400 INVALID_REQUEST),
 * 값 자체를 KST로 간주해 저장한다. 즉 `Z`도 `+09:00`도 보낼 수 없다.
 *
 * 표준 API로는 이 형식을 안전하게 만들 수 없다:
 * - `toISOString()` → UTC 시각 + `Z` + 밀리초. 시각도 표기도 둘 다 스펙 위반이다.
 * - `toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })` 류 → 형식이 로케일/엔진 구현에 딸려 있고,
 *   RN Android의 Hermes는 빌드 옵션에 따라 Intl 타임존 데이터가 없어 `timeZone` 옵션이 무시되거나
 *   던질 수 있다. 서버에 보내는 값의 정확성을 Intl 가용성에 걸 이유가 없다.
 * - `getHours()` 같은 로컬 시각 게터 → **기기 타임존**을 따른다. 여행자 앱이므로 기기가 KST가 아닐 수 있다.
 *
 * 그래서 epoch에 +9시간을 더한 뒤 `getUTC*` 로 읽는다. 두 값 모두 기기 타임존과 무관한
 * epoch 기반이라 결과가 기기 설정에 흔들리지 않는다.
 */

/** KST는 UTC+9 고정 오프셋이다 — 한국은 서머타임을 쓰지 않으므로 날짜별 분기가 필요 없다. */
const KST_OFFSET_MINUTES = 9 * 60;

const MS_PER_MINUTE = 60_000;

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/**
 * `date`가 가리키는 순간을 KST 벽시계로 읽어 `YYYY-MM-DDTHH:mm:ss` 로 만든다.
 *
 * 밀리초는 붙이지 않는다 — 스펙 예시가 초 단위이고, 서버는 촬영 시각을 초 정밀도로만 쓴다.
 * (밀리초가 붙어도 `fromisoformat`은 통과하지만, 스펙에 없는 값을 보낼 이유가 없다)
 */
export function toKstTimestamp(date: Date): string {
  // +9시간을 더해 두면 "UTC로 읽은 값"이 곧 KST 벽시계가 된다.
  const kst = new Date(date.getTime() + KST_OFFSET_MINUTES * MS_PER_MINUTE);

  const year = pad(kst.getUTCFullYear(), 4);
  const month = pad(kst.getUTCMonth() + 1, 2);
  const day = pad(kst.getUTCDate(), 2);
  const hours = pad(kst.getUTCHours(), 2);
  const minutes = pad(kst.getUTCMinutes(), 2);
  const seconds = pad(kst.getUTCSeconds(), 2);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
