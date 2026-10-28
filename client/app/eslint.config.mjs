import expo from 'eslint-config-expo/flat.js';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  expo,
  globalIgnores(['android/**', 'ios/**', '.expo/**', 'node_modules/**']),

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

  // CommonJS로 도는 Node 스크립트. expo 프리셋은 RN 런타임 기준이라
  // __dirname 같은 CJS 전역을 모른다.
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', __filename: 'readonly' },
    },
  },
]);
