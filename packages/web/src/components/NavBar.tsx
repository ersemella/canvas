import React from 'react';
import { Link } from 'react-router-dom';
import styles from './NavBar.module.css';

export function NavBar() {
  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        Canvas Games
      </Link>
    </nav>
  );
}
