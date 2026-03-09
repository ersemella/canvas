import {Link} from 'react-router-dom';
import type {GameDescriptor} from 'registry/games';
import styles from './GameCard.module.css';

interface Props {
  game: GameDescriptor;
}

export function GameCard({game}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.thumbnail}>
        <img
          src={game.thumbnail}
          alt={game.title}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{game.title}</h3>
        <p className={styles.description}>{game.description}</p>
        <Link to={`/play/${game.id}`} className={styles.playBtn}>
          Play
        </Link>
      </div>
    </div>
  );
}
