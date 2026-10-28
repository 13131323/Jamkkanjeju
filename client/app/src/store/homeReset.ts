import { create } from 'zustand';

/**
 * "/home을 처음 상태로 되돌려 달라"는 요청.
 *
 * /home은 WebView 한 장이고, web은 그 안에서 자기 히스토리를 갖는다(마이페이지 → 도감 카드 …).
 * 그래서 `navigate.replace('/home')`만으로는 홈 화면이 나오지 않는다 — 라우트는 /home이 맞지만
 * 이미 살아 있는 WebView가 **직전에 보던 web 페이지를 그대로 들고 있기** 때문이다.
 * 미션 완료의 "홈으로 이동하기"를 눌렀는데 도감 카드가 떠 있던 게 이 때문이다(사용자 확인).
 *
 * 라우트 파라미터로 넘기지 않는 이유: replace로 이미 떠 있는 /home에 되돌아갈 때 파라미터가
 * 그 인스턴스까지 닿는지가 라우터 구현에 달려 있다. 스토어는 화면이 재사용되든 아니든 똑같이 읽힌다.
 *
 * 값 자체에는 의미가 없다 — **바뀌었다는 사실**만 쓴다(HomeWebView가 이 값을 WebView의 key로 쓴다).
 */
interface HomeResetStore {
  token: number;

  /** /home으로 보내기 **직전에** 호출한다. 이동과 순서가 바뀌면 리셋이 한 박자 늦는다 */
  request: () => void;
}

export const useHomeResetStore = create<HomeResetStore>((set) => ({
  token: 0,
  request: () => set((state) => ({ token: state.token + 1 })),
}));
