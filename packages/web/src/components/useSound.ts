import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {soundPlayer} from '@canvas/engine';

const SOUND_STORAGE = 'canvas:sound-muted';

function savedMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_STORAGE) === '1';
  } catch {
    return false;
  }
}

/**
 * Readies the engine's sounds for a game page: the player's saved mute
 * applies, and audio unlocks on the page's first tap or key press (browsers
 * keep it silent until then).
 */
export function useGameSound(): void {
  useEffect(() => {
    soundPlayer.muted = savedMuted();
    return soundPlayer.unlockOnGesture();
  }, []);
}

/** Whether sound is muted, and a toggle that saves the choice. */
export function useSoundMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(
    (onChange) => soundPlayer.onMutedChange(onChange),
    () => soundPlayer.muted
  );
  const toggle = useCallback(() => {
    soundPlayer.muted = !soundPlayer.muted;
    try {
      localStorage.setItem(SOUND_STORAGE, soundPlayer.muted ? '1' : '0');
    } catch {
      // Private windows may refuse; the choice holds for this visit.
    }
  }, []);
  return [muted, toggle];
}
