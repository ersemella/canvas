import {describe, expect, it} from 'vitest';
import {Shoe} from 'util/Shoe';

describe('Shoe', () => {
  it('deals 52 distinct cards per deck', () => {
    const shoe = new Shoe(1);
    const cards = new Set(
      Array.from({length: 52}, () => {
        const c = shoe.deal();
        return `${c.rank}${c.suit}`;
      })
    );
    expect(cards.size).toBe(52);
  });

  it('reshuffles between rounds only once the shoe runs low', () => {
    const shoe = new Shoe(1);
    expect(shoe.reshuffleIfLow()).toBe(false); // 52 left
    for (let i = 0; i < 33; i++) shoe.deal(); // 19 left, below the 20-card floor
    expect(shoe.reshuffleIfLow()).toBe(true);
    expect(shoe.remaining).toBe(52);
  });

  it('uses a quarter of a multi-deck shoe as the threshold', () => {
    const shoe = new Shoe(6); // 312 cards, threshold 78
    for (let i = 0; i < 234; i++) shoe.deal(); // 78 left
    expect(shoe.reshuffleIfLow()).toBe(false);
    shoe.deal();
    expect(shoe.reshuffleIfLow()).toBe(true);
  });
});
