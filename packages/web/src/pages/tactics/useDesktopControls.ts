import {useEffect} from 'react';
import type {RefObject} from 'react';

/**
 * Desktop keys and the right button. 1–9 press the turn's buttons in order
 * (`[data-choice]` in `actions`, Move first), Enter or Space confirms
 * what's picked, Esc steps back. A right-click on the
 * board steps back too, and never reaches the board as a click. None of it
 * on a phone.
 */
export function useDesktopControls(options: {
  phone: boolean;
  board: RefObject<HTMLElement>;
  actions: RefObject<HTMLElement>;
  /** The board was mounted afresh: listen on the new one. */
  hasBoard: boolean;
  onConfirm: () => void;
  onStepBack: () => void;
}): void {
  const {phone, board, actions, hasBoard, onConfirm, onStepBack} = options;

  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Escape') return onStepBack();
      if (e.key === 'Enter' || e.key === ' ') {
        // A focused button or menu item answers these keys itself.
        if (el?.closest('button, a, [role="menuitem"]')) return;
        e.preventDefault();
        onConfirm();
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1) {
        const buttons = actions.current?.querySelectorAll<HTMLButtonElement>('[data-choice]');
        buttons?.[n - 1]?.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phone, actions, onConfirm, onStepBack]);

  useEffect(() => {
    const el = board.current;
    if (phone || !el) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) e.stopPropagation();
    };
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      onStepBack();
    };
    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointerup', onDown, true);
    el.addEventListener('contextmenu', onMenu);
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointerup', onDown, true);
      el.removeEventListener('contextmenu', onMenu);
    };
  }, [phone, board, onStepBack, hasBoard]);
}
