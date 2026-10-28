import { ShareSheet } from '@/components/Share/ShareSheet/ShareSheet';
import { inviteShareContent } from './shareMessage';

interface InviteShareSheetProps {
  visible: boolean;
  /** 이미 조립된 초대 URL. 이 시트는 토큰을 모르고 URL을 만들지도 않는다 */
  inviteUrl: string;
  onClose: () => void;
  /** 공유가 실패했을 때. 화면마다 알리는 방법(토스트·배너)이 달라 시트가 직접 띄우지 않는다 */
  onShareError?: (message: string) => void;
  /**
   * 링크를 클립보드에 담았을 때. 시트는 토스트를 띄울 수단이 없어서(화면마다 알리는 방법이 다르다)
   * 알리는 일을 화면(together.tsx)에 넘긴다. 시트 자신은 아무 표시도 바꾸지 않는다.
   */
  onCopied?: () => void;
}

/**
 * 협동 미션 초대 공유 시트.
 *
 * "+ 동반 일행 초대하기"가 OS 공유 시트를 곧바로 띄우면 무엇이 공유되는지 보이지 않는다.
 * 그 사이에 들어가 **초대 링크를 눈으로 확인**하게 하고 거기서 공유 방법을 고르게 하는 시트다.
 *
 * **시트 자체는 이제 공용이다**(`components/Share/ShareSheet`). AI 엽서 결과 화면도 같은 시트를
 * 쓰게 되면서 옮겼고, 여기 남은 것은 **초대 문구를 채워 넣는 일**뿐이다. 이 래퍼를 없애고 호출부가
 * 곧장 `ShareSheet`를 쓰게 하지 않은 이유: 초대 문구(`INVITE_SHARE_HEADLINE`)를 아는 자리가
 * 화면(together.tsx)으로 올라가면 협동 미션 화면이 "무엇을 공유하는지"까지 알게 되고,
 * 그 화면의 호출부(`<InviteShareSheet visible inviteUrl … />`)도 함께 바뀐다 —
 * 협동 미션 쪽은 한 줄도 건드리지 않는 것이 이번 변경의 전제였다.
 *
 * 동작·치수·애니메이션은 전부 `ShareSheet`에 있고 옮기면서 하나도 바꾸지 않았다.
 */
export function InviteShareSheet({ visible, inviteUrl, onClose, onShareError, onCopied }: InviteShareSheetProps) {
  return <ShareSheet visible={visible} content={inviteShareContent(inviteUrl)} onClose={onClose} onShareError={onShareError} onCopied={onCopied} />;
}
