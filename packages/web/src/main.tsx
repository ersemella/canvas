import {StrictMode} from 'react';
import ReactDOM from 'react-dom/client';
import {MantineProvider, createTheme} from '@mantine/core';
import {Notifications} from '@mantine/notifications';
import {App} from 'app/App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

const theme = createTheme({
  primaryColor: 'violet',
  fontFamily: 'system-ui, -apple-system, sans-serif',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <App />
    </MantineProvider>
  </StrictMode>
);
