// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Orval 생성 코드. 파일 상단에 "Do not edit manually"가 붙어 있고 pnpm generate가
  // 통째로 덮어쓰므로 여기서 난 경고는 손으로 고칠 수 없다.
  //
  // react-hooks/immutability는 Orval이 모든 query 훅에 넣는
  // `query.queryKey = queryOptions.queryKey`를 잡는다. 훅이 돌려준 객체에 프로퍼티를
  // 얹는 패턴이라 규칙 자체는 옳지만, 고치려면 Orval 템플릿을 바꿔야 한다.
  {
    files: ['src/services/api/**/*.ts'],
    rules: { 'react-hooks/immutability': 'off' },
  },

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  ...storybook.configs['flat/recommended'],
]);
