/**
 * Configuration for the PokerSystem.
 * Place on a dedicated config entity in game.json.
 */

export interface PokerConfigData {
  /** Raise buttons step by this; the server's blinds are fixed at 5/10. */
  bigBlind: number;

  // Panel entity IDs driven by SidePanelSystem
  potValueId: string;
  heroChipsId: string;
  phaseTextId: string;
  /** Five log line entity IDs, newest shown first (index 0 = top). */
  logIds: string[];

  foldBtnId: string;
  checkBtnId: string;
  callBtnId: string;
  raiseBtnId: string;
  raiseDownId: string;
  raiseAmountId: string;
  raiseUpId: string;
}
