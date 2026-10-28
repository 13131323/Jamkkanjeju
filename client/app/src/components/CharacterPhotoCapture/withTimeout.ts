/**
 * 오프스크린 합성용 <Image> 두 장의 onLoad를 기다리는 동안 안전장치.
 * 왜 필요한가: Android 기기/이미지 파일에 따라 onLoad가 영영 안 오는 사례가 실제로 보고돼 있다.
 * 그대로 두면 isProcessing이 계속 true로 남아 셔터가 영구히 비활성화된다("조용히 멈춤"도
 * 요구사항의 "실패 시 사용자에게 알려라"를 어기는 것이므로 타임아웃으로 명시적 실패를 만든다).
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
