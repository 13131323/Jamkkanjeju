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
     * 이미지를 기기 갤러리에 저장해 달라는 신호. 갤러리 쓰기는 네이티브만 할 수 있다.
     *
     * **그림을 넘기는 방법이 둘이고, 보내는 쪽이 고른다.**
     *   - `dataUrl` — web이 **직접 만든** 그림. AR 도감 카드가 쓴다. 카드는 여러 DOM 요소를 합성한
     *     결과라 web이 PNG로 떠야만 그 그림이 존재한다. 문자열이 수백 KB가 된다.
     *   - `imageUrl` — **서버에 이미 있는** 그림. AI 엽서가 쓴다. 서버가 완성해 둔 한 장이라
     *     web이 받아 base64로 바꿔 넘길 이유가 없다. 앱이 그 주소에서 곧장 내려받는다.
     *
     * 엽서가 `imageUrl`을 쓰는 이유는 크기만이 아니다 — **web에서 `fetch`로 그 이미지를 읽으면
     * CORS에 막힌다.** 이미지 호스트가 web origin에 헤더를 열어 주지 않아서, `<img>`로 보이기는
     * 하는데 바이트는 못 읽었다(기기에서 확인: 저장만 실패). 네이티브 다운로드에는 그 제약이 없다.
     *
     * 둘 중 **하나만** 보낸다. 어느 쪽이든 저장 버튼처럼 **사용자가 명시적으로 누른 순간**에만
     * 보낸다(자동 전송 금지).
     */
    type: z.literal('SAVE_IMAGE'),
    payload: z.object({
      dataUrl: z.string().startsWith('data:image/').optional(),
      /** 서버에 이미 있는 이미지 주소. `dataUrl` 대신 쓴다 */
      imageUrl: z.string().url().optional(),
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
  z.object({
    /**
     * 회원탈퇴 확인 문구를 입력하고 확정했다는 신호.
     *
     * 서버 API를 호출하지 않는다 — 민감정보가 없어 로컬 데이터만 지우는 것으로 "탈퇴"를 구현한다.
     * 앱이 로컬 세션(SQLite)·WebView 로컬 저장소를 지우고 첫 화면(온보딩)으로 되돌린다.
     * 앱을 종료하지 않는다 — `BackHandler.exitApp()`은 Activity만 finish할 뿐이라 프로세스가
     * 죽지 않은 채 재실행되면 지운 적 없는 화면 상태가 그대로 복원되는 문제가 있었다
     * (app/src/components/HomeWebView/useHomeBridge.ts 참고). index.tsx가 지워진 세션을
     * 보고 스스로 /onboarding/step1로 리다이렉트하므로 별도의 "초기화 완료" 응답은 필요 없다.
     */
    type: z.literal('ACCOUNT_DELETE_REQUEST'),
    payload: z.object({}),
    traceId: z.string(),
  }),
  z.object({
    /**
     * 심사위원 코드 입력 모달이 열려 있는지.
     *
     * 이 모달은 web의 React state로만 뜬다 — URL도 히스토리도 바뀌지 않는다. 앱의 하드웨어
     * 뒤로가기(HomeWebView.tsx의 BackHandler)는 WebView의 `canGoBack`만 보므로, 그대로 두면
     * 모달이 열려 있어도 뒤로가기가 그냥 앱을 꺼 버린다. 그래서 web이 열고 닫을 때마다 이 값을
     * 알려 주고, 앱은 `isOpen`인 동안 뒤로가기를 자기가 소비한 뒤 `HARDWARE_BACK_PRESSED`로
     * "닫아 달라"고 되돌려 준다.
     */
    type: z.literal('JUDGE_CODE_MODAL_STATE'),
    payload: z.object({ isOpen: z.boolean() }),
    traceId: z.string(),
  }),
  z.object({
    /**
     * 공유 시트를 앱이 WebView 위에 띄워 달라는 요청. AI 엽서 결과 화면의 "공유"가 보낸다.
     *
     * **화면은 web에 그대로 있다.** 앱이 하는 일은 협동 미션 초대에서 쓰던 그 시트
     * (app/src/components/Share/ShareSheet)를 그대로 올리는 것뿐이다 — 라인·문자·메일로 곧장
     * 넘기는 일(`Linking.openURL`)과 OS 공유 시트(`Share.share`)는 네이티브만 할 수 있고,
     * WebView 안의 `navigator.share`는 있으면 OS 시트가 곧바로 뜨고 없으면 링크 복사로 떨어져
     * **같은 버튼이 기기마다 다르게 동작했다.** 앱 안에서는 늘 같은 시트가 뜨는 편이 낫다.
     *
     * payload는 `@packages/shared`의 `ShareContent` 그대로다 — 본문("안내 문구 다음 줄에 링크")과
     * `line://`·`sms:`·`mailto:` 주소를 만드는 규칙이 web·app 어느 쪽에도 복사되지 않도록,
     * 조립은 공용 순수 함수(share/shareMessage.ts) 하나만 하고 브릿지는 재료만 옮긴다.
     *
     * **app → web 응답이 없다.** 시트가 열린 뒤의 일은 전부 앱 안에서 끝나고(복사 안내도 시트가
     * 직접 띄운다 — Android에서 RN `Modal`은 별도 윈도우라 web의 토스트가 그 뒤에 가린다),
     * 무엇보다 **"공유했다"를 알 수 있는 쪽이 없다**: `Share.share`의 결과는 공유 앱을 골랐다까지,
     * `openURL`은 그 앱이 떴다까지만 뜻한다. 돌려줄 사실이 없는 신호에 응답 타입을 만들면 낡은 web이
     * 그 응답을 못 알아듣는 실패 모드만 하나 늘어난다.
     *
     * **새 type이므로 앱을 먼저 배포한다**(이 union 위 경고). 낡은 앱에서는 이 메시지가 zod 검증에서
     * 통째로 걸러져 **공유 버튼이 아무 일도 하지 않는다** — web은 앱 WebView 안인지만 보고 갈라서
     * (`isAppWebView()`) 앱이 받았는지는 알 수 없기 때문이다. 앱 밖 브라우저용 폴백
     * (`navigator.share`/클립보드)은 그대로 남아 있으니 순서만 지키면 된다.
     */
    type: z.literal('SHARE_SHEET'),
    payload: z.object({
      /**
       * 실제로 공유되는 주소. 엽서 이미지 주소이거나, 이 시트를 쓰는 다른 화면의 링크다.
       *
       * `.url()`로 조이지 않는 건 시트가 주소를 해석하지 않기 때문이다 — 본문에 붙여 넘길 뿐이라
       * 형식은 받는 앱이 판단한다. 다만 **빈 문자열은 막는다**: 안내 문구만 남은 글은 받는 사람이
       * 들어올 방법이 없어 공용 규칙도 그때는 아무것도 보내지 않는다(buildShareMessage).
       */
      url: z.string().min(1),
      /** 링크 앞줄에 붙는 안내 한 줄. 화면마다 달라서(초대 ↔ 엽서) 계약이 값으로 받는다 */
      headline: z.string().min(1),
      /** 메일 제목. 생략하면 `headline`을 그대로 쓴다(공용 규칙의 기본값) */
      mailSubject: z.string().optional(),
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
 * 앱이 WebView에 심는 심사위원용 모드 전역의 이름 — `window.__TAMNALOG_JUDGE_MODE__`.
 *
 * **모드의 보관은 앱이, 편집은 web이 한다.** web의 localStorage는 문서가 실행된 뒤에야 읽히므로
 * 콜드 스타트에서 첫 렌더·첫 요청이 항상 기본 모드로 나갔다. 앱은 sqlite에 남긴 값을 부트스트랩에서
 * 되살리므로, 그 값을 문서 실행 전에 심으면(injectedJavaScriptBeforeContentLoaded) 그 경쟁이 사라진다
 * — 토큰을 브릿지가 아니라 주입으로 넘기는 것과 같은 이유다(app/.../authTokenScript.ts).
 *
 * **이름과 파싱 규칙을 여기 두는 이유**: 심는 쪽(app)과 읽는 쪽(web)이 문자열을 각자 적으면
 * 오타 하나로 조용히 "값이 없음"이 된다. 토큰 쪽은 실제로 두 파일에 손으로 복제해 두고 주석으로만
 * 맞춰 두었는데, 그 방식을 따라가지 않는다.
 */
export const JUDGE_MODE_GLOBAL = '__TAMNALOG_JUDGE_MODE__';

/**
 * 주입된 전역값을 켜짐/꺼짐으로 접는다.
 *
 * `true`만 켜짐이다 — 앱이 낡아 전역을 아예 심지 않는 경우(`undefined`)와 구버전이 문자열을 심는
 * 경우를 모두 안전한 쪽(꺼짐)으로 접는다. 전역은 web이 혼자 읽으므로 낡은 앱에서는 "값이 없다"가
 * 그대로 관측되고, web은 localStorage로 떨어진다.
 */
export function parseInjectedJudgeMode(value: unknown): boolean {
  return value === true;
}

/**
 * 제주 본섬의 중심점.
 *
 * **web과 app이 같은 값을 써야 한다** — JUDGE_MODE_COORDS와 같은 이유다. web은 좌표를 아직 모를 때
 * 홈 조회의 기준점으로 쓰고(_pages/home/model/homeQueryCoords.ts), app은 미션 중단 요청에서
 * 측위가 끝내 실패했을 때의 폴백으로 쓴다(utils/missionStopCoords.ts). 두 값이 갈리면 같은 "모름"
 * 상태인데 화면과 서버가 서로 다른 지점을 기준으로 추천을 뽑는다.
 */
export const JEJU_CENTER = { lat: 33.361424638771474, lng: 126.52941927591584 } as const;

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
  z.object({
    /**
     * 하드웨어 뒤로가기가 눌렸다는 신호.
     *
     * `JUDGE_CODE_MODAL_STATE`로 모달이 열렸다고 알린 뒤에만 온다 — 앱은 그동안 뒤로가기를
     * 자기가 소비하고(BackHandler가 true를 반환해 기본 동작을 막는다) 대신 이 메시지로
     * "닫아 달라"고 되돌려 준다. web은 열려 있는 모달을 닫는 것으로 응답한다.
     */
    type: z.literal('HARDWARE_BACK_PRESSED'),
    payload: z.object({}),
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
