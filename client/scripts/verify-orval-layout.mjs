import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const domains = ['auth', 'cooperative-mission', 'culture-mission', 'default', 'guestbook', 'home', 'map', 'mission', 'mypage', 'onboarding', 'treasure-mission'];

function assertExists(relativePath) {
  if (!existsSync(join(workspaceRoot, relativePath))) {
    throw new Error(`필수 Orval 생성물이 없습니다: ${relativePath}`);
  }
}

function assertMissing(relativePath) {
  if (existsSync(join(workspaceRoot, relativePath))) {
    throw new Error(`이전 Orval 생성물이 남아 있습니다: ${relativePath}`);
  }
}

const sharedGeneratedPath = 'packages/shared/src/api/generated';
assertExists(`${sharedGeneratedPath}/index.ts`);

const sharedModelCount = readdirSync(join(workspaceRoot, sharedGeneratedPath)).filter((fileName) => fileName.endsWith('.ts') && fileName !== 'index.ts').length;

if (sharedModelCount === 0) {
  throw new Error('shared에 생성된 API 모델이 없습니다.');
}

for (const platform of ['app', 'web']) {
  assertMissing(`${platform}/src/schemas/api`);

  for (const domain of domains) {
    const generatedService = `${platform}/src/services/api/${domain}/${domain}.ts`;
    assertExists(generatedService);
    assertMissing(`${platform}/src/services/${domain}`);

    const source = readFileSync(join(workspaceRoot, generatedService), 'utf8');
    if (!source.includes('packages/shared/src/api/generated')) {
      throw new Error(`shared API 모델을 import하지 않습니다: ${generatedService}`);
    }
  }
}

console.log(`Orval 구조 확인 완료: shared 모델 ${sharedModelCount}개, 플랫폼별 도메인 ${domains.length}개`);
