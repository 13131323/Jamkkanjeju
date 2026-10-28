import { hashKey } from '@tanstack/react-query';
import { isJudgeAuthEnabled } from '../auth/judgeToken';

/**
 * 쿼리 캐시를 **계정(= 심사위원용 모드) 단위로 나눈다.**
 *
 * 예전에는 모드가 바뀔 때 `resetQueries()`로 캐시를 통째로 버렸다. 남의 계정 응답이 화면에 남는
 * 것을 막으려는 조치였는데, 그 대가로 모드를 바꿀 때마다 홈의 모든 데이터를 처음부터 다시 받아야
 * 했다 — 되돌아올 때도 마찬가지라 같은 대기가 매번 반복됐다(사용자 지적: 전환이 너무 느리다).
 *
 * 키에 모드를 섞으면 두 계정의 응답이 **애초에 다른 칸**에 들어간다. 버릴 이유가 없어지고,
 * 한 번씩 다녀온 뒤로는 전환이 캐시 적중으로 끝난다.
 *
 * 기본 해시(`hashKey`)를 감싸는 이유: 그쪽은 객체 키 순서를 정렬해 안정적으로 만든다. 직접
 * `JSON.stringify`로 바꾸면 orval이 만든 params 객체의 키 순서가 달라질 때 같은 조회가 두 벌로 갈린다.
 *
 * **한계**: 모드 값은 모듈 플래그라, 값이 바뀌어도 이미 마운트된 관찰자는 자기 해시를 다시 계산하기
 * 전까지 옛 칸을 본다. 이 앱에서는 모드를 켜고 끄는 UI가 홈에만 있고 홈이 모드를 구독해 리렌더되므로
 * 그 하위 관찰자가 모두 새 해시를 얻는다 — 다른 화면에서 토글할 수 있게 되면 이 전제를 다시 봐야 한다.
 */
export function hashQueryKeyByAccount(queryKey: readonly unknown[]): string {
  return hashKey([isJudgeAuthEnabled() ? 'judge' : 'app', ...queryKey]);
}
