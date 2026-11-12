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
    /** 앱이 SecureStore의 리프레시 토큰으로 재발급하고 액세스 토큰만 다시 주입하도록 요청한다.
     * accessToken은 만료 응답을 받은 요청의 값으로, 이미 갱신한 토큰의 불필요한 재회전을 막는다. */
    type: z.literal('AUTH_TOKEN_REQUEST'),
    payload: z.object({ accessToken: z.string().optional() }),
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
    /** 현재 기기의 최신 리프레시 토큰으로 로그아웃하고 인증·화면 상태를 정리한다. */
    type: z.literal('AUTH_LOGOUT_REQUEST'),
    payload: z.object({}),
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

export const JEJU_CENTER = { lat: 33.361424638771474, lng: 126.52941927591584 } as const;

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
