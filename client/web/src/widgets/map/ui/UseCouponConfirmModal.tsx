'use client';
import { ConfirmModal } from '@shared/ui/ConfirmModal';

export function UseCouponConfirmModal(props: { pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <ConfirmModal {...props} title="쿠폰을 사용하시겠습니까?" cancelLabel="취소" confirmLabel="사용" />;
}
