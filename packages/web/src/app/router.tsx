import {createBrowserRouter} from 'react-router-dom';
import {HomePage} from 'pages/HomePage';
import {GamePage} from 'pages/GamePage';
import {PokerPage} from 'pages/PokerPage';
import {NavBar} from 'components/NavBar';

function Layout({children}: {children: React.ReactNode}) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
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
        <PokerPage />
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
