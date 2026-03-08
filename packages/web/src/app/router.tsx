import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { GamePage } from '../pages/GamePage';
import { NavBar } from '../components/NavBar';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    path: '/play/:gameId',
    element: (
      <Layout>
        <GamePage />
      </Layout>
    ),
  },
]);
