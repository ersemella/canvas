/**
 * Generic multi-deck card shoe for any card game.
 * Deals standard playing cards (rank 1–13, four suits).
 *
 * Call `reshuffleIfLow()` between rounds so a fresh shoe never has to be
 * opened mid-round. `deal()` still rebuilds as a last resort if the shoe runs
 * dry, but that can duplicate cards already on the table.
 */

export interface PlayingCard {
  rank: number; // 1=A, 2–10, 11=J, 12=Q, 13=K
  suit: string; // '♠' | '♥' | '♦' | '♣'
}

export class Shoe {
  private readonly numDecks: number;
  private cards: PlayingCard[] = [];

  constructor(numDecks: number) {
    this.numDecks = numDecks;
    this.build();
  }

  /** Deal the top card. Rebuilds if the shoe is empty. */
  deal(): PlayingCard {
    if (this.cards.length === 0) this.build();
    return this.cards.pop()!;
  }

  get remaining(): number {
    return this.cards.length;
  }

  /**
   * Rebuilds and reshuffles when fewer than `minCards` remain (default: a
   * quarter of the shoe, at least 20 cards). Returns true if it reshuffled.
   */
  reshuffleIfLow(minCards = Math.max(20, Math.floor((this.numDecks * 52) / 4))): boolean {
    if (this.cards.length >= minCards) return false;
    this.build();
    return true;
  }

  private build(): void {
    const suits = ['\u2660', '\u2665', '\u2666', '\u2663']; // ♠♥♦♣
    this.cards = [];
    for (let d = 0; d < this.numDecks; d++) {
      for (const suit of suits) {
        for (let rank = 1; rank <= 13; rank++) {
          this.cards.push({suit, rank});
        }
      }
    }
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.cards[i]!;
      this.cards[i] = this.cards[j]!;
      this.cards[j] = tmp;
    }
  }
}
