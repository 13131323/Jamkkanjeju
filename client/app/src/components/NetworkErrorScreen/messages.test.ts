import { describe, expect, it } from 'vitest';
import { NETWORK_ERROR_MESSAGES } from './messages';

describe('NETWORK_ERROR_MESSAGES', () => {
  it('네트워크 끊김 문구는 기존 그대로다', () => {
    expect(NETWORK_ERROR_MESSAGES.offline).toEqual({
      title: '네트워크에 연결할 수 없어요',
      description: '인터넷 연결 상태를 확인한 뒤\n다시 시도해주세요.',
    });
  });

  it('서버 오류는 제목과 본문이 모두 다르다', () => {
    expect(NETWORK_ERROR_MESSAGES.server).toEqual({
      title: '서버와 연결이 원활하지 않아요',
      description: '잠시 후 다시 시도해주세요.',
    });
  });
});
