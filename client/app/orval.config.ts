import { config } from 'dotenv';
import { defineConfig } from 'orval';

config({ path: '.env' });

export default defineConfig({
  tamnalog: {
    input: {
      target: process.env.EXPO_PUBLIC_API_URL + '/openapi.json',
      override: {
        // 서버가 파일 배열을 nullable로 바꾸면서 anyOf[array, null]이 되어 orval이 배열로
        // 인식하지 못한다. 생성 전에 그 래퍼만 벗겨 explode가 다시 걸리게 한다.
        transformer: '../scripts/orval-unwrap-nullable-file-arrays.mjs',
      },
    },
    output: {
      mode: 'tags-split',
      target: 'src/services/api',
      schemas: '../packages/shared/src/api/generated',
      clean: true,
      client: 'react-query',
      httpClient: 'axios',
      override: {
        // 파일·값 배열을 **인덱스 없이 같은 키로 반복** append한다. FastAPI의 list[...]가
        // 그 형태만 리스트로 받는다.
        //
        // 세 선택지가 실제로 만드는 코드는 이렇다(@orval/core의 formData 생성기):
        //   'serialize'              → arr.forEach(v => fd.append('key', v))      ← 필요한 것
        //   'explode'                → arr.forEach((v,i) => fd.append('key[i]', v))
        //   'serialize-with-brackets'→ arr.forEach(v => fd.append('key[]', v))
        //
        // 예전 주석은 'serialize'가 배열을 통째로 넣는다고 적어 두었는데 사실이 아니다 —
        // 통째로 넣는 코드는 필드가 **배열로 인식되지 않았을 때** 나오는 스칼라 경로다.
        // (그 인식 문제는 input.override.transformer가 처리한다)
        formData: { arrayHandling: 'serialize' },
        mutator: {
          path: 'src/services/client.ts',
          name: 'orvalClient',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
