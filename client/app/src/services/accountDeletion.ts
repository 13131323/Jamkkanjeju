/** 기기에 저장된 로그인 세션과 사용자별 화면 상태를 초기화한다. 다음 실행은 로그인 화면이다. */
import { clearAuthSession } from './auth';
import { useCoopPartyStore } from '@/store/coopParty';
import { useMissionCompleteStore } from '@/store/missionComplete';
import { useOnboardingStore } from '@/store/onboarding';
import { useTreasureProgressStore } from '@/store/treasureProgress';

export async function deleteAccountLocally(): Promise<void> {
  await clearAuthSession();
  resetUserStores();
}

/** 로그인 계정에 종속된 화면 상태를 로그아웃·로컬 탈퇴에서 공통으로 정리한다. */
export function resetUserStores(): void {
  useOnboardingStore.getState().reset();
  useCoopPartyStore.getState().reset();
  useTreasureProgressStore.getState().reset();
  useMissionCompleteStore.getState().clear();
}
