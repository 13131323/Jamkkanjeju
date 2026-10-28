import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// vitest는 devDependency로만 있었고 설정 파일이 없어서 `pnpm exec vitest`가 아무 것도 못 찾았다.
// 순수 로직(예: widgets/map/model/treasureMarkerLayout.ts) 테스트를 실행할 수 있게 최소 설정만 둔다.
// tsconfig.json의 paths와 같은 별칭을 vite에도 알려줘야 한다 — vitest는 tsconfig paths를 읽지 않는다.
//
// 실행: pnpm --filter @tamnalog/web exec vitest run
// (package.json에 test 스크립트를 추가하지는 않았다 — 기존 스크립트 구성을 건드리지 않기 위해)
const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@packages/shared': resolvePath('../packages/shared/src/index.ts'),
      '@widgets': resolvePath('./src/widgets'),
      '@features': resolvePath('./src/features'),
      '@entities': resolvePath('./src/entities'),
      '@shared': resolvePath('./src/shared'),
      '@app': resolvePath('./src/app'),
      '@': resolvePath('./src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
  },
});
