import {createBrowserRouter} from 'react-router-dom';
import {AppShell} from '@mantine/core';
import {HomePage} from 'pages/HomePage';
import {GamePage} from 'pages/GamePage';
import {PokerLobbyPage} from 'pages/poker/PokerLobbyPage';
import {PokerRoomPage} from 'pages/poker/PokerRoomPage';
import {TacticsPage} from 'pages/tactics/TacticsPage';
import {NavBar} from 'components/NavBar';
import {PageHeaderProvider} from 'components/PageHeader';

function Layout({children}: {children: React.ReactNode}) {
  return (
    <PageHeaderProvider>
      <AppShell header={{height: 56}}>
        <NavBar />
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
    // Its own page: the run lives on the server (a RunRoom), not in the browser.
    path: '/play/silk-road-tactics',
    element: (
      <Layout>
        <TacticsPage />
      </Layout>
    ),
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
