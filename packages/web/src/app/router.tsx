import {createBrowserRouter, Navigate} from 'react-router-dom';
import {AppShell} from '@mantine/core';
import {HomePage} from 'pages/HomePage';
import {GamePage} from 'pages/GamePage';
import {PokerLobbyPage} from 'pages/poker/PokerLobbyPage';
import {PokerRoomPage} from 'pages/poker/PokerRoomPage';
import {TacticsPage} from 'pages/tactics/TacticsPage';
import {NavBar} from 'components/NavBar';
import {PageHeaderProvider} from 'components/PageHeader';

/** The page in the app shell, under the top bar unless `bare` (the page has the whole screen). */
function Layout({children, bare = false}: {children: React.ReactNode; bare?: boolean}) {
  return (
    <PageHeaderProvider>
      <AppShell {...(bare ? {} : {header: {height: 56}})}>
        {!bare && <NavBar />}
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell>
    </PageHeaderProvider>
  );
}

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/',
    element: (
      <Layout>
        <HomePage />
      </Layout>
    ),
  },
  {
    path: '/play/poker',
    element: (
      <Layout>
        <PokerLobbyPage />
      </Layout>
    ),
  },
  {
    path: '/play/poker/:roomId',
    element: (
      <Layout>
        <PokerRoomPage />
      </Layout>
    ),
  },
  {
    // Caravan (package id `silk-road-run`): its own page, the run played in the browser.
    // No top bar: the board gets the whole screen.
    path: '/play/caravan',
    element: (
      <Layout bare>
        <TacticsPage />
      </Layout>
    ),
  },
  {
    // Caravan's old address, kept for bookmarks.
    path: '/play/silk-road-run',
    element: <Navigate to="/play/caravan" replace />,
  },
  {
    path: '/play/:gameId',
    element: (
      <Layout>
        <GamePage />
      </Layout>
    ),
  },
]);
