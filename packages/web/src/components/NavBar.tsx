import {Link} from 'react-router-dom';
import {AppShell, Group, Anchor, Button, Text} from '@mantine/core';
import {useCurrentPageHeader} from './PageHeader';
import {useIsPhone} from './useIsPhone';
import styles from './NavBar.module.css';

/**
 * The top bar: the site name, or on phones, when the page has set one
 * (usePageHeader), a back link and the page's title instead.
 */
export function NavBar() {
  const header = useCurrentPageHeader();
  const phone = useIsPhone();
  if (phone && header) {
    return (
      <AppShell.Header h={56} className={styles.header!}>
        <div className={styles.pageHeader}>
          <Button component={Link} to={header.backTo} variant="subtle" color="gray" size="sm" px={6} aria-label="Back">
            ← Back
          </Button>
          <Text fw={700} fz="lg" truncate="end" className={styles.pageTitle!}>
            {header.title}
          </Text>
        </div>
      </AppShell.Header>
    );
  }
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
