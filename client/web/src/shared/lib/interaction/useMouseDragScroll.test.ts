import { expect, it, vi } from 'vitest';
import type { PointerEvent, MouseEvent } from 'react';
import { useMouseDragScroll } from './useMouseDragScroll';

vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }) }));

function setup() {
  const hook = useMouseDragScroll();
  let captured = false;
  const element = {
    scrollLeft: 200,
    style: { scrollSnapType: 'x mandatory', scrollBehavior: '' },
    setPointerCapture: vi.fn(() => { captured = true; }),
    hasPointerCapture: () => captured,
    releasePointerCapture: vi.fn(() => { captured = false; }),
  };
  hook.scrollRef.current = element as unknown as HTMLDivElement;
  const pointer = (clientX: number, pointerType = 'mouse') => ({ clientX, pointerType, button: 0, pointerId: 1, preventDefault: vi.fn() }) as unknown as PointerEvent<HTMLDivElement>;
  const click = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as MouseEvent<HTMLDivElement>;
  return { ...hook, element, pointer, click };
}

it('짧은 클릭은 포인터를 가로채지 않고 하트 버튼에 전달한다', () => {
  const { dragHandlers, element, pointer, click } = setup();
  dragHandlers.onPointerDown(pointer(100));
  dragHandlers.onPointerMove(pointer(104));
  dragHandlers.onPointerUp(pointer(104));
  const event = click();
  dragHandlers.onClickCapture(event);
  expect(element.setPointerCapture).not.toHaveBeenCalled();
  expect(event.stopPropagation).not.toHaveBeenCalled();
  expect(element.scrollLeft).toBe(200);
});

it('드래그 중에는 스냅을 풀어 이동하고 놓으면 복원하며 클릭·모달 닫힘을 막는다', () => {
  const { dragHandlers, element, pointer, click } = setup();
  dragHandlers.onPointerDown(pointer(200));
  dragHandlers.onPointerMove(pointer(60));
  expect(element.scrollLeft).toBe(340);
  expect(element.style.scrollSnapType).toBe('none');
  dragHandlers.onPointerUp(pointer(60));
  expect(element.style.scrollSnapType).toBe('x mandatory');
  expect(element.releasePointerCapture).toHaveBeenCalledWith(1);
  const event = click();
  dragHandlers.onClickCapture(event);
  expect(event.stopPropagation).toHaveBeenCalledOnce();
});

it('터치 제스처는 브라우저 기본 스크롤에 맡긴다', () => {
  const { dragHandlers, element, pointer } = setup();
  dragHandlers.onPointerDown(pointer(200, 'touch'));
  const move = pointer(60, 'touch');
  dragHandlers.onPointerMove(move);
  expect(element.scrollLeft).toBe(200);
  expect(move.preventDefault).not.toHaveBeenCalled();
});

it('포인터 취소 시에도 캡처와 스냅 설정을 복원한다', () => {
  const { dragHandlers, element, pointer } = setup();
  dragHandlers.onPointerDown(pointer(200));
  dragHandlers.onPointerMove(pointer(60));
  dragHandlers.onPointerCancel(pointer(60));
  expect(element.style.scrollSnapType).toBe('x mandatory');
  expect(element.releasePointerCapture).toHaveBeenCalledWith(1);
});
