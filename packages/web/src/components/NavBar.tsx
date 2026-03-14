import {Link} from 'react-router-dom';
import {AppShell, Group, Anchor} from '@mantine/core';

export function NavBar() {
  return (
    <AppShell.Header h={56} style={{borderBottom: '1px solid var(--mantine-color-dark-4)'}}>
      <Group h="100%" px="xl">
        <Anchor component={Link} to="/" fw={700} fz="lg" c="violet.4" style={{letterSpacing: '-0.02em', textDecoration: 'none'}}>
          Canvas Games
        </Anchor>
      </Group>
    </AppShell.Header>
  );
}
