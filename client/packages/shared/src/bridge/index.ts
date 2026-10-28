/**
 * WebView 브릿지 메시지 계약.
 *
 * 예전에는 app/src/bridge/index.ts와 web/src/shared/lib/bridge/index.ts에 같은 내용을
 * 각자 두고 "수동으로 동일하게 유지"했다. 한쪽에만 메시지 타입을 추가하면 다른 쪽 zod 검증에서
 * 조용히 걸러지는 구조라, 계약은 이 파일 하나만 남기고 양쪽은 여기서 re-export한다.
 *
 * 송수신 구현(sendToApp/sendToWeb/listen*)은 플랫폼 API가 서로 달라 각 패키지의 utils.ts에 남는다.
 */
import { z } from 'zod';

// Envelope
export type BridgeMessage<T> = {
  type: string;
  payload: T;
  traceId: string;
};

// Payloads
export type PingPayload = { timestamp: number };
export type PongPayload = { timestamp: number };

// 위치 권한 상태 — web의 status 배지가 이 값으로 안내 문구를 분기한다
// granted-approximate: 대략적 위치만 허용(iOS reduced accuracy / Android coarse)
// blocked: 거부 + 재요청 불가(설정 앱에서 직접 켜야 함) / denied: 거부했지만 재요청 가능
export const LocationPermissionStatusSchema = z.enum(['granted-precise', 'granted-approximate', 'denied', 'blocked', 'undetermined']);
export type LocationPermissionStatus = z.infer<typeof LocationPermissionStatusSchema>;

/**
 * web → app 메시지.
 *
 * **union에 새 type을 추가하면 앱을 먼저 배포한다.** 검증은 앱이 하므로 앱 스키마가 낡으면
 * 그 메시지가 통째로 걸러진다(새 type은 optional로 완화할 수 없다).
 * 수신부가 모르는 type을 무시하도록 되어 있어 오류는 나지 않지만 기능은 동작하지 않는다 —
 * docs/trouble/2026-09-07-bridge-contract-drift.md
 */
export const WebToAppMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PING'),
    payload: z.object({ timestamp: z.number() }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('LOCATION_PERMISSION_REQUEST'),
    payload: z.object({}),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('NAVIGATE'),
    payload: z.object({
      route: z.enum(['culture-mission', 'treasure-mission', 'coop-mission']),
      // 유형별 세부 미션 id. 앱 인트로가 GET /api/v1/missions/{missionType}/{missionId}에 쓴다.
      // optional인 이유: 이 필드가 없던 web 빌드가 WebView에 남아 있으면 zod 검증에서
      // 통째로 걸러져 "시작하기"가 먹통이 된다. 없으면 앱이 기본값으로 진행한다.
      missionId: z.number().int().positive().optional(),
      /**
       * 진행 중인 미션을 이어서 할 때 참. 홈 상단 "진행중인 미션" 카드의 ">"가 보낸다.
       *
       * 앱이 인트로를 건너뛰고 미션 진행 화면으로 바로 보낸다. 단계는 그 화면이 스스로 찾는다
       * (culture는 resumed ref, treasure는 treasureProgress 스토어).
       *
       * missionId와 같은 이유로 optional이다 — 이 필드를 모르는 낡은 앱 번들에서도 zod 검증을
       * 통과해야 하고, 그때는 예전처럼 인트로로 간다(기능이 죽는 것보다 한 화면 더 거치는 게 낫다).
       */
      resume: z.boolean().optional(),
    }),
    traceId: z.string(),
  }),
  z.object({
    /**
     * 신체 활동(ACTIVITY_RECOGNITION) 권한을 다시 요청해 달라는 신호.
     *
     * 홈에서 한 번 요청하고 거절당하면 걸음 수를 셀 수 없어 저장할 것도 생기지 않는다.
     * 마이페이지에 들어올 때 한 번 더 물어보기 위해 web이 보낸다 — 권한 요청은 네이티브만 할 수 있다.
     * (안드로이드에서 사용자가 "다시 묻지 않기"를 골랐으면 OS가 다이얼로그를 띄우지 않는다)
     */
    type: z.literal('STEP_PERMISSION_REQUEST'),
    payload: z.object({}),
    traceId: z.string(),
  }),
  z.object({
    /**
     * web 화면의 뒤로가기를 앱 스택으로 넘긴다.
     *
     * WebView가 특정 경로를 **첫 페이지로** 여는 화면(app/app/place.tsx의 /map/{placeId})에서는
     * 브라우저 히스토리에 되돌아갈 항목이 없다. 그래서 web의 router.back()은 아무 일도 하지
     * 않고, 화면에 보이는 뒤로가기 버튼만 죽은 버튼이 된다. 앱이 라우터 스택을 pop해 준다.
     *
     * 일반 브라우저에서는 이 메시지를 보낼 통로가 없으므로(sendToApp이 조용히 넘어간다)
     * 호출부가 router.back()으로 갈라 써야 한다.
     */
    type: z.literal('NAVIGATE_BACK'),
    payload: z.object({}),
    traceId: z.string(),
  }),
  z.object({
    /**
     * 마이페이지 도감의 "함께 사진 찍기". 앱이 캐릭터 합성 촬영 화면을 연다.
     *
     * 카메라는 네이티브만 열 수 있어서 web은 "무엇을 찍을지"만 넘긴다.
     * `imageUrl`은 **절대 URL**이다 — 도감 이미지는 web 번들의 정적 파일이라 경로만 보내면
     * 앱이 그것을 어디서 받아야 할지 알 수 없다. web이 자기 origin을 붙여서 보낸다.
     */
    type: z.literal('CHARACTER_PHOTO'),
    payload: z.object({
      characterId: z.string().min(1),
      name: z.string().min(1),
      imageUrl: z.string().url(),
    }),
    traceId: z.string(),
  }),
  z.object({
    /**
     * web이 만든 이미지를 기기 갤러리에 저장해 달라는 신호.
     *
     * 도감 카드의 저장 버튼이 쓴다 — 카드는 web이 그리므로 **web만 그림을 만들 수 있고**,
     * 갤러리 쓰기는 네이티브만 할 수 있다. 그래서 web이 카드를 PNG로 떠서 넘긴다.
     *
     * `dataUrl`은 `data:image/png;base64,...` 형식이다. 문자열이 수백 KB가 되므로
     * 저장 버튼처럼 **사용자가 명시적으로 누른 순간**에만 보낸다(자동 전송 금지).
     */
    type: z.literal('SAVE_IMAGE'),
    payload: z.object({
      dataUrl: z.string().startsWith('data:image/'),
      /** 갤러리에 남길 파일 이름(확장자 제외). 공백·경로 구분자가 없어야 한다 */
      fileName: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[\w-]+$/),
    }),
    traceId: z.string(),
  }),
  z.object({
    /**
     * 토큰을 다시 심어 달라는 요청. web이 401을 받았을 때 보낸다.
     *
     * web은 토큰을 가질 수 없다 — 직접 `/auth/anonymous`를 부르면 앱과 다른 사용자가 된다.
     * 앱이 새 익명 토큰을 발급해 주입 스크립트를 다시 실행하면, 그 스크립트가 쏘는
     * `tamnalog:auth-ready`를 신호로 web이 원래 요청을 재시도한다.
     */
    type: z.literal('AUTH_TOKEN_REQUEST'),
    payload: z.object({}),
    traceId: z.string(),
  }),
  z.object({
    /**
     * 심사위원용 모드가 켜졌는지. 홈 단축 버튼 행의 "모드변경"에 코드를 넣으면 켜진다.
     *
     * 켜고 끄는 UI와 저장(localStorage)이 web에 있으므로 web이 주인이고, 앱은 받은 값을
     * 메모리에만 든다 — 양쪽이 각자 저장하면 상태가 갈라진다.
     *
     * 앱에서의 효과: 협동 미션 시뮬레이션 + 네이티브 좌표를 JUDGE_MODE_COORDS로 고정
     * + **API 호출을 JUDGE_ACCESS_TOKEN으로**(app/src/services/authHeader.ts).
     *
     * **불리언만 보낸다. 토큰은 payload에 싣지 않는다.** 값이 비밀이 아니고 이 파일의
     * JUDGE_ACCESS_TOKEN이 web·app 공통 출처라 실어 보낼 이유가 없고, payload에 넣으면
     * 앱이 낡았을 때 스키마 검증에서 메시지가 통째로 버려져 모드 자체가 켜지지 않는다
     * (docs/trouble/2026-09-07-bridge-contract-drift.md).
     */
    type: z.literal('JUDGE_MODE_UPDATE'),
    payload: z.object({ enabled: z.boolean() }),
    traceId: z.string(),
  }),
  z.object({
    // 보물찾기 step1 지도에서 보물 마커를 눌렀을 때. 앱이 step1 시트를 다시 올리는 데 쓴다 —
    // 시트는 손으로 끌어내려 닫을 수 있고, 닫은 뒤 다시 열 방법이 이 탭이다.
    type: z.literal('TREASURE_MARKER_PRESS'),
    payload: z.object({
      // 서버가 매긴 보물 번호(treasureIndex). 브릿지의 마커 payload는 treasureId가 문자열이라
      // web이 그 값을 숫자로 되돌려 보낸다 — 앱 내부 식별자가 숫자이기 때문이다.
      treasureIndex: z.number().int().positive(),
    }),
    traceId: z.string(),
  }),
]);

/**
 * 심사위원용 모드에서 "현재 위치"로 삼는 좌표 — 제주시청.
 *
 * web(지도·주소)과 app(미션 좌표·GPS 저장)이 같은 지점을 봐야 해서 계약과 함께 여기 둔다.
 * 한쪽만 옮기면 web 지도에는 마커가 있는데 앱은 제주 밖이라 미션이 시작되지 않는다.
 */
export const JUDGE_MODE_COORDS = { lat: 33.4996, lng: 126.5312 } as const;

/**
 * 심사위원용 모드에서 쓰는 고정 토큰 — 서버에 미리 심어 둔 목업 사용자.
 *
 * 심사 환경에서는 앱이 발급한 익명 사용자로는 볼 것이 없다(미션 진행 이력·도감이 비어 있다).
 * 그래서 모드가 켜지면 web도 app도 이 사용자로 호출한다.
 *
 * **web과 app이 같은 값을 써야 한다.** JUDGE_MODE_COORDS와 같은 이유이고, 어긋났을 때가 더
 * 나쁘다 — 좌표는 화면이 다르게 보이는 데서 그치지만, 토큰이 갈리면 홈(web)이 보여 준
 * "진행중인 미션"과 그것을 이어받는 앱 호출이 **서로 다른 사용자**가 된다. 실제로 그랬다:
 * 앱은 이 토큰을 모른 채 자기 익명 토큰으로 불렀고, 그래서 홈에서 이어하기를 누르면
 * 남의 진행도를 자기 계정으로 다시 시작하거나(토큰이 살아 있을 때) 401이 났다
 * (토큰이 서버에서 사라졌을 때 — 심사용 목업 시딩으로 익명 사용자가 지워진 경우).
 *
 * 값을 env로 빼지 않고 상수로 둔 이유: 비밀이 아니다. 서버 레포의 `scripts/sql/02-data-mock.sql`에
 * 해시가 그대로 커밋돼 있고 주석에 사용법까지 적혀 있다. env로 빼면 설정이 빠졌을 때 기능이
 * **조용히** 동작하지 않는 실패 모드만 하나 늘어난다.
 *
 * **하이픈이다.** `sha256("test-user-1-token")`이 서버 `USER.access_token_hash`와 일치하고
 * 밑줄 버전(`test_user_1_token`)은 불일치라 401이 된다 — 실제로 배포 API에 두 값을 넣어 확인했다.
 * docs/trouble/2026-09-09-webview-token-version-skew.md
 */
export const JUDGE_ACCESS_TOKEN = 'test-user-1-token';

/**
 * `Bearer {token}` — 서버가 요구하는 형식이다(server/app/core/security.py의 TOKEN_TYPE).
 *
 * **상수가 아니라 함수다.** app 쪽에서 모듈 최상위 상수로 만들면 Metro가 shared의 `export *`를
 * CommonJS로 옮기는 과정에서 배럴이 아직 비어 있는 시점에 평가돼 `undefined`가 박힌다
 * (app/src/store/judgeMode.ts의 judgeModePosition 주석과 같은 함정). 호출 시점으로 미룬다.
 */
export function judgeAuthorizationHeader(): string {
  return `Bearer ${JUDGE_ACCESS_TOKEN}`;
}

// 보물찾기 step1 지도용 위치·heading payload.
// heading은 위치 권한이 없거나 나침반이 아직 준비되지 않은 경우 -1(무효값)이 올 수 있다.
// web 쪽은 -1을 "방향 삼각형을 그리지 않음"으로 명시적으로 처리해야 한다 (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4).
export const TREASURE_INVALID_HEADING = -1;

export const AppToWebMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PONG'),
    payload: z.object({ timestamp: z.number() }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('LOCATION_PERMISSION_RESULT'),
    payload: z.object({ status: LocationPermissionStatusSchema }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('LOCATION_UPDATE'),
    payload: z.object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number(),
      timestamp: z.number(),
    }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('LOCATION_ERROR'),
    payload: z.object({ message: z.string() }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('STEP_COUNT_UPDATE'),
    payload: z.object({ steps: z.number(), timestamp: z.number() }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('TREASURE_LOCATION_UPDATE'),
    payload: z.object({
      latitude: z.number(),
      longitude: z.number(),
      // expo-location trueHeading 값 그대로. 무효값은 TREASURE_INVALID_HEADING(-1).
      heading: z.number(),
      timestamp: z.number(),
    }),
    traceId: z.string(),
  }),
  z.object({
    // 보물찾기 step0 지도에 그릴 보물 마커 목록. 좌표에 붙어 팬/줌을 따라가야 하므로
    // 네이티브 오버레이가 아니라 지도(web)가 CustomOverlay로 그린다 (prompt §9).
    type: z.literal('TREASURE_MARKERS_UPDATE'),
    payload: z.object({
      /** 지도 초기 중심. 첫 메시지에서 한 번만 쓰인다(이후 사용자 팬을 덮지 않는다) */
      center: z.object({ latitude: z.number(), longitude: z.number() }).nullable(),
      treasures: z.array(
        z.object({
          treasureId: z.string(),
          order: z.number(),
          latitude: z.number(),
          longitude: z.number(),
          /** 이미 찾은 보물은 "열린 에셋"으로 그린다 */
          found: z.boolean(),
        }),
      ),
    }),
    traceId: z.string(),
  }),
  z.object({
    type: z.literal('SAFE_AREA_UPDATE'),
    // Android WebView는 시스템 바를 몰라 env(safe-area-inset-*)가 항상 0이다.
    // 네이티브가 실측 inset(dp)을 그대로 넘기고, web이 CSS 변수로 반영한다.
    payload: z.object({ top: z.number(), bottom: z.number() }),
    traceId: z.string(),
  }),
]);

// Types inferred from schemas
export type WebToAppMessage = z.infer<typeof WebToAppMessageSchema>;
export type AppToWebMessage = z.infer<typeof AppToWebMessageSchema>;

/**
 * 이 번들이 아는 메시지 type 목록. **모르는 type과 잘못된 payload를 가르는 데** 쓴다.
 *
 * - 모르는 type → 상대가 더 새 번들이다. 조용히 무시한다(낡은 쪽이 할 수 있는 일이 없다)
 * - 아는 type + 어긋난 payload → 진짜 계약 위반이므로 이때만 기록한다
 *
 * 예전에는 둘이 zod 실패 하나로 뭉쳐 있어, 메시지를 추가할 때마다 낡은 앱이
 * `Invalid discriminator value`를 쏟아냈다(docs/trouble/2026-09-07-bridge-contract-drift.md).
 */
export const WEB_TO_APP_MESSAGE_TYPES: ReadonlySet<string> = new Set(WebToAppMessageSchema.options.map((option) => option.shape.type.value));

export const APP_TO_WEB_MESSAGE_TYPES: ReadonlySet<string> = new Set(AppToWebMessageSchema.options.map((option) => option.shape.type.value));
