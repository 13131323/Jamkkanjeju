import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Metro/TS는 tsconfig.json의 paths로 "@/*"를 해석하지만 vitest는 그 설정을 읽지 않는다.
// 같은 별칭을 여기에도 등록해야 소스와 테스트가 동일한 경로 표기를 쓸 수 있다.
export default defineConfig({
  // RN 번들러가 넣어 주는 전역이라 vitest에는 없다. 상수 파일의 dev 플래그(`__DEV__ && true`)를
  // import하는 테스트가 ReferenceError로 죽지 않도록 개발 빌드와 같은 값으로 정의한다.
  define: { __DEV__: 'true' },
  // packages/shared는 자체 테스트 러너가 없다. app이 유일한 소비자이므로
  // 여기서 함께 돌려 로직과 테스트가 같은 디렉터리에 있게 한다.
  //
  // include를 직접 지정하는 순간 기본값이 통째로 대체된다. scripts/*.test.mjs가
  // 조용히 빠지지 않도록 여기에 함께 적는다.
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs', '../packages/shared/src/**/*.test.ts'],
    /**
     * 기본값 5초는 이 레포에서 너무 짧다.
     *
     * 73개 파일을 병렬로 돌리면 가장 먼저 도는 파일이 **자기 로직과 무관하게** 시간 초과로
     * 실패했다(`src/services/client`, `src/db/sqlite`, `src/services/auth` 등이 돌아가며 걸렸다).
     * 지연이 테스트 본문이 아니라 import·transform에서 오기 때문이다.
     *
     * `scripts/metro-device-config`는 단독 실행에서도 **본문만 20초**가 걸린다(의존성 해석을
     * 실제로 수행한다). 그래서 20초로는 부족해 넉넉히 잡았다.
     * web/vitest.config.ts와 같은 이유·같은 조치다.
     */
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@assets': path.resolve(__dirname, 'assets'),
    },
  },
});
