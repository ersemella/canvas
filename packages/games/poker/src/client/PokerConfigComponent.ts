/**
 * Configuration for the PokerSystem.
 * Place on a dedicated config entity in game.json.
 */

export interface PokerConfigData {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;

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
