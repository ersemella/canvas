import {Link} from 'react-router-dom';
import {AppShell, Group, Anchor} from '@mantine/core';
import styles from './NavBar.module.css';

export function NavBar() {
  return (
    <AppShell.Header h={56} className={styles.header!}>
      <Group h="100%" px="xl">
        <Anchor component={Link} to="/" fw={700} fz="lg" c="green.4" className={styles.brand!}>
          Canvas Games
        </Anchor>
      </Group>
    </AppShell.Header>
  );
}
