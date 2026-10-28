import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_KAKAO_MAP_KEY: z.string().min(1),
  /**
   * [dev 전용] 브라우저가 API를 부를 때 쓸 **같은 origin** 경로. 예: `/dev-api`
   *
   * 배포 API를 로컬에서 볼 때 필요하다. 앱 WebView는 web을 http://localhost:3000에서 읽는데,
   * 배포 서버의 CORS 허용 목록에 그 origin이 없어 브라우저가 응답을 버린다
   * (Access-Control-Allow-Origin이 오지 않고 preflight는 400이다).
   *
   * 이 값이 있으면 axios가 절대주소 대신 이 경로를 baseURL로 쓰고, next.config의 rewrite가
   * 그 경로를 NEXT_PUBLIC_API_BASE_URL로 대신 전달한다 — 브라우저 입장에서는 same-origin이라
   * CORS가 아예 발생하지 않는다.
   *
   * 비워 두면(기본) 예전처럼 절대주소로 직접 호출한다. 프로덕션에서는 설정하지 않는다.
   */
  NEXT_PUBLIC_API_PROXY_PATH: z
    .string()
    .regex(/^\/[A-Za-z0-9._~\-/]*$/, '슬래시로 시작하는 경로여야 합니다(예: /dev-api)')
    .optional(),
  /**
   * 심사위원용 모드 진입 코드(6자). 홈의 열쇠 아이콘 → 모달에서 이 값과 대조한다.
   *
   * **optional이다.** 필수로 두면 이 값을 설정하지 않은 기존 배포가 env 검증에서 통째로 죽는다.
   * 비어 있으면 어떤 코드로도 통과하지 않는다(features/judge-mode의 verifyJudgeCode).
   *
   * `NEXT_PUBLIC_`은 빌드 시점에 번들로 인라인되므로 **번들을 열어보면 보인다.** 심사 진입을
   * 막는 문턱일 뿐 비밀이 아니다 — 진짜로 가려야 하면 서버 라우트에서 비공개 env로 대조해야 한다.
   */
  NEXT_PUBLIC_JUDGE_MODE_CODE: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_KAKAO_MAP_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
  // 빈 문자열은 "설정하지 않음"으로 본다 — .env에 키만 남겨 둔 경우가 정상 경로다
  NEXT_PUBLIC_API_PROXY_PATH: process.env.NEXT_PUBLIC_API_PROXY_PATH || undefined,
  NEXT_PUBLIC_JUDGE_MODE_CODE: process.env.NEXT_PUBLIC_JUDGE_MODE_CODE || undefined,
});

if (!parsed.success) {
  // ZodError를 그대로 던지지 않는다.
  // ZodError.message는 getter만 있고 setter가 없는데, Next.js는 서버에서 올라온 에러를
  // 직렬화하면서 message를 다시 대입한다. strict mode라 그 대입이 TypeError로 터지고
  // 원래 에러가 통째로
  //   "TypeError: Cannot set property message of [object Object] which has only a getter"
  // 라는, 원인과 아무 상관 없는 unhandledRejection으로 바뀌어버린다.
  // (실제로 /map 진입 시 이 증상으로 지도가 통째로 렌더되지 않았다)
  // 평범한 Error로 바꿔 던져서 어떤 변수가 비었는지가 그대로 보이게 한다.
  const invalidKeys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`환경 변수가 올바르지 않습니다: ${invalidKeys}. web/.env.local(또는 .env.production)을 확인하세요.`);
}

export const env = parsed.data;
