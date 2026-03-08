import React from 'react';
import { GameCard } from '../components/GameCard';
import { games } from '../registry/games';
import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Games</h1>
        <p className={styles.subtitle}>HTML5 canvas games built with a custom ECS engine</p>
      </div>
      <div className={styles.grid}>
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
