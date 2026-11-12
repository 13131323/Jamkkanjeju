import { NextRequest, NextResponse } from 'next/server';
import { isStoredLoginSession, loginSessionFrom, type LoginResponse } from '@packages/shared';
const COOKIE = 'tamnalog-refresh';
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
/** JSON·동일 출처 요청만 허용한다. 리프레시 쿠키를 사용하는 경로의 CSRF를 차단한다. */
function sameOrigin(request: NextRequest): boolean {
  try {
    const origin = new URL(request.headers.get('origin') ?? '');
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
    const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
    return origin.host === host && origin.protocol === `${protocol}:` && request.headers.get('content-type')?.split(';')[0].trim() === 'application/json';
  } catch {
    return false;
  }
}
function cookieOptions(request: NextRequest) {
  return { httpOnly: true, secure: request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https', sameSite: 'strict' as const, path: '/api/auth' };
}
/** HttpOnly 토큰으로 서버 로그아웃을 중계하고 실패하더라도 현재 브라우저 쿠키를 삭제한다. */
export async function handleBrowserLogout(request: NextRequest): Promise<NextResponse> {
  if (!sameOrigin(request)) return errorResponse(403, 'FORBIDDEN', '접근 권한이 없습니다.');
  let response: NextResponse;
  try {
    const refreshToken = request.cookies.get(COOKIE)?.value;
    if (!refreshToken) {
      response = new NextResponse(null, { status: 204 });
    } else {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
      if (!base) throw new Error('Missing API URL');
      const upstream = await fetch(`${base}/api/v2/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (upstream.ok) response = new NextResponse(null, { status: 204 });
      else {
        const data = await upstream.json();
        response = errorResponse(
          upstream.status,
          typeof data.code === 'string' ? data.code : 'AUTH_REQUEST_FAILED',
          typeof data.message === 'string' ? data.message : '로그아웃 요청을 처리하지 못했습니다.',
        );
      }
    }
  } catch {
    response = errorResponse(503, 'AUTH_SERVER_UNAVAILABLE', '인증 서버에 연결할 수 없습니다.');
  }
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(COOKIE, '', { ...cookieOptions(request), maxAge: 0 });
  return response;
}
/** 브라우저 로그인·재발급의 중계. 토큰 원문은 로그나 브라우저 JSON에 반환하지 않는다. */
export async function handleBrowserAuth(request: NextRequest, action: 'login' | 'refresh'): Promise<NextResponse> {
  if (!sameOrigin(request)) return errorResponse(403, 'FORBIDDEN', '접근 권한이 없습니다.');
  let payload: unknown;
  if (action === 'login') {
    try {
      const value = await request.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) return errorResponse(400, 'INVALID_REQUEST', '요청값이 올바르지 않습니다.');
      payload = { email: value.email, password: value.password, deviceInfo: value.deviceInfo ?? 'Web' };
    } catch {
      return errorResponse(400, 'INVALID_REQUEST', '요청값이 올바르지 않습니다.');
    }
  } else {
    const refreshToken = request.cookies.get(COOKIE)?.value;
    if (!refreshToken) return errorResponse(401, 'UNAUTHORIZED', '인증이 필요합니다.');
    payload = { refreshToken };
  }
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    if (!base) return errorResponse(503, 'AUTH_SERVER_UNAVAILABLE', '인증 서버에 연결할 수 없습니다.');
    const upstream = await fetch(`${base}/api/v2/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const response = errorResponse(
        upstream.status,
        typeof data.code === 'string' ? data.code : 'AUTH_REQUEST_FAILED',
        typeof data.message === 'string' ? data.message : '인증 요청을 처리하지 못했습니다.',
      );
      if (action === 'refresh' && (upstream.status === 401 || upstream.status === 403)) response.cookies.set(COOKIE, '', { ...cookieOptions(request), maxAge: 0 });
      return response;
    }
    const issued = data as LoginResponse;
    if (
      !isStoredLoginSession(loginSessionFrom(issued)) ||
      typeof issued.refreshToken !== 'string' ||
      !issued.refreshToken ||
      !Number.isFinite(issued.refreshTokenExpiresIn) ||
      issued.refreshTokenExpiresIn <= 0
    )
      return errorResponse(502, 'INVALID_AUTH_RESPONSE', '인증 응답을 처리하지 못했습니다.');
    const response = NextResponse.json(
      { accessToken: issued.accessToken, tokenType: issued.tokenType, accessTokenExpiresIn: issued.accessTokenExpiresIn, refreshTokenExpiresIn: issued.refreshTokenExpiresIn, user: issued.user },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.cookies.set(COOKIE, issued.refreshToken, { ...cookieOptions(request), maxAge: issued.refreshTokenExpiresIn });
    return response;
  } catch {
    return errorResponse(503, 'AUTH_SERVER_UNAVAILABLE', '인증 서버에 연결할 수 없습니다.');
  }
}
