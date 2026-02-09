import { useRef } from 'react';
import type { TouchEvent } from 'react';

export function useLongPress(onLongPress: (x: number, y: number) => void, delay = 500) {
  const timerRef = useRef<number | null>(null);

  function clear() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    timerRef.current = window.setTimeout(() => {
      onLongPress(touch.clientX, touch.clientY);
      timerRef.current = null;
    }, delay);
  }

  return {
    onTouchStart,
    onTouchEnd: clear,
    onTouchMove: clear,
    onTouchCancel: clear
  };
}
