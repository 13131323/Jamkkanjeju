import type { GeneratedApi } from '@packages/shared';

/** Spring 홈 조회가 제공하는 점검 공지. 시각은 KST 기준 offset 없는 ISO 8601이다. */
export type HomeMaintenance = {
  message: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'IN_PROGRESS';
};

/** 기존 v1 생성 타입과 분리하여 Spring v2의 점검 공지 계약을 반영한다. */
export type HomeResponse = GeneratedApi.HomeResponse & {
  maintenance: HomeMaintenance | null;
};
