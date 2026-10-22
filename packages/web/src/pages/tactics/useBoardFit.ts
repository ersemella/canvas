import {useEffect, useRef, useState} from 'react';
import {SCENE_SIZE} from '@canvas/games-silk-road-run';

/**
 * The board's size on screen. `boardSize` follows the canvas's, to place
 * the phone's tooltip and desktop's Confirm over it. On a phone,
 * `fitWidth` is the board's width as large as its slot allows, width or
 * height, keeping its shape.
 *
 * The board is mounted afresh each time it replaces the start menu (Reset
 * run keeps the old fight), so the observers follow `hasBoard`, whether
 * it's showing, not whether there's a fight.
 */
export function useBoardFit(phone: boolean, hasBoard: boolean) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  /** Phones: the space the board may fill. */
  const boardSlotRef = useRef<HTMLDivElement | null>(null);
  const [fitWidth, setFitWidth] = useState<number | null>(null);
  const [boardSize, setBoardSize] = useState<{width: number; height: number} | null>(null);

  useEffect(() => {
    const canvas = boardRef.current?.querySelector('canvas');
    if (!canvas) return;
    const observer = new ResizeObserver(() =>
      setBoardSize({width: canvas.offsetWidth, height: canvas.offsetHeight})
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [phone, hasBoard]);

  useEffect(() => {
    const slot = boardSlotRef.current;
    if (!phone || !slot) return;
    const observer = new ResizeObserver(() =>
      setFitWidth(
        Math.floor(
          Math.min(slot.clientWidth, (slot.clientHeight * SCENE_SIZE.width) / SCENE_SIZE.height)
        )
      )
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, [phone, hasBoard]);

  return {boardRef, boardSlotRef, boardSize, fitWidth};
}
