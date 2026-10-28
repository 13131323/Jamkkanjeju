/**
 * 회원탈퇴 — 로컬 데이터 초기화.
 *
 * 서버에 삭제할 개인정보가 없어 API를 호출하지 않는다. 이 기기에 남아 있는 세션(SQLite)과
 * 메모리 상태만 지우고, 호출부(useHomeBridge)가 이어서 WebView 로컬 저장소를 지운 뒤
 * 앱을 종료한다 — 다음 실행에서 bootstrapSession()이 새 익명 사용자를 발급하고,
 * 저장된 온보딩 결과가 없으므로 온보딩부터 다시 시작한다(app/index.tsx).
 */
import { clearSession } from '@/db/session';
import { setCachedSession } from './sessionCache';
import { useCoopPartyStore } from '@/store/coopParty';
import { useJudgeModeStore } from '@/store/judgeMode';
import { useMissionCompleteStore } from '@/store/missionComplete';
import { useOnboardingStore } from '@/store/onboarding';
import { useTreasureProgressStore } from '@/store/treasureProgress';

export async function deleteAccountLocally(): Promise<void> {
  setCachedSession(null);
  await clearSession();

  useOnboardingStore.getState().reset();
  useCoopPartyStore.getState().reset();
  useTreasureProgressStore.getState().reset();
  useMissionCompleteStore.getState().clear();
  useJudgeModeStore.getState().setEnabled(false);
}
