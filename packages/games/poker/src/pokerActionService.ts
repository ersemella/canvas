import type { PokerAction } from './types';

class PokerActionService {
  private pending: PokerAction | null = null;

  submit(action: PokerAction): void {
    this.pending = action;
  }

  consume(): PokerAction | null {
    const action = this.pending;
    this.pending = null;
    return action;
  }
}

export const pokerActionService = new PokerActionService();
