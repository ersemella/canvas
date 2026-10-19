import {useSyncExternalStore} from 'react';

/** Phone widths: the breakpoint the game pages' compact layouts use. */
export const PHONE_QUERY = '(max-width: 960px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches
  );
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
