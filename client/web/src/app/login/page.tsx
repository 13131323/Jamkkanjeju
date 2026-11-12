'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { browserLogin } from '@shared/api/auth/browserAuth';
import { limitLoginInput, validateLoginInput, type LoginField } from '@packages/shared';
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  function changeInput(field: LoginField, input: string) {
    const result = limitLoginInput(field, input);
    (field === 'identifier' ? setIdentifier : setPassword)(result.value);
    setError(result.error);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const validationError = validateLoginInput(identifier, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPending(true);
    setError('');
    try {
      await browserLogin(identifier.trim(), password);
      router.replace('/');
    } catch (cause) {
      const failure = cause as { response?: { data?: { message?: string } } };
      setError(failure.response?.data?.message ?? '로그인하지 못했습니다. 연결 상태를 확인해 주세요.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-[#fffdf7] px-7 py-12 text-[#242424]">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold text-[#789e38]">나만의 제주 여행 기록</p>
          <h1 className="text-4xl font-bold">잠깐제주</h1>
          <p className="mt-4 text-sm text-neutral-500">로그인하고 여행을 이어가세요.</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <label className="text-sm font-semibold">
            아이디 또는 이메일
            <input
              autoComplete="username"
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => changeInput('identifier', e.target.value)}
              placeholder="아이디 또는 이메일을 입력해 주세요"
              required
              className="mt-2 block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-base outline-none focus:border-[#90b644]"
            />
          </label>
          <label className="text-sm font-semibold">
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => changeInput('password', e.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              required
              className="mt-2 block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-base outline-none focus:border-[#90b644]"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button disabled={pending || !identifier.trim() || !password} className="mt-2 rounded-full bg-[#242424] py-4 font-bold text-white disabled:opacity-40">
            {pending ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </main>
  );
}
