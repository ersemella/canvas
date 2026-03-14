import {createBrowserRouter} from 'react-router-dom';
import {AppShell} from '@mantine/core';
import {HomePage} from 'pages/HomePage';
import {GamePage} from 'pages/GamePage';
import {PokerLobbyPage} from 'pages/poker/PokerLobbyPage';
import {PokerRoomPage} from 'pages/poker/PokerRoomPage';
import {NavBar} from 'components/NavBar';

function Layout({children}: {children: React.ReactNode}) {
  return (
    <AppShell header={{height: 56}}>
      <NavBar />
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
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
    path: '/play/:gameId',
    element: (
      <Layout>
        <GamePage />
      </Layout>
    ),
  },
]);
