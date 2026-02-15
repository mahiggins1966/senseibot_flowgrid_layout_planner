import { useRef, useCallback } from 'react';

export interface PressAndHoldOptions {
  delay?: number;
  onPressStart?: () => void;
  onHoldStart?: () => void;
  onRelease?: () => void;
}

export function usePressAndHold({
  delay = 200,
  onPressStart,
  onHoldStart,
  onRelease,
}: PressAndHoldOptions) {
  const timerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const hasFiredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (e: React.MouseEvent) => {
      clear();
      hasFiredRef.current = false;
      isHoldingRef.current = false;

      onPressStart?.();

      timerRef.current = window.setTimeout(() => {
        isHoldingRef.current = true;
        hasFiredRef.current = true;
        onHoldStart?.();
      }, delay);
    },
    [delay, onPressStart, onHoldStart, clear]
  );

  const handleEnd = useCallback(() => {
    const wasHolding = isHoldingRef.current;
    clear();
    isHoldingRef.current = false;
    onRelease?.();
    return wasHolding;
  }, [onRelease, clear]);

  const handleCancel = useCallback(() => {
    clear();
    isHoldingRef.current = false;
    hasFiredRef.current = false;
  }, [clear]);

  const isHolding = useCallback(() => isHoldingRef.current, []);
  const hasFired = useCallback(() => hasFiredRef.current, []);

  return {
    handleStart,
    handleEnd,
    handleCancel,
    isHolding,
    hasFired,
  };
}
