import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { App } from './App';
import { getApiMode, probeBackend } from './api/mode';
import './index.css';

// Client ID de Google OAuth (proyecto pa-todo). Sobreescribible con VITE_GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '377828600122-r6kc7b5surfos5ha27fbs4lb9ue7672t.apps.googleusercontent.com';

async function bootstrap() {
  if (getApiMode() === 'auto') {
    await probeBackend();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  );
}

bootstrap();