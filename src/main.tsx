import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/app.css';
import App from './App';
import { initSocialLogin } from './lib/social-login';

// Initialize the social-login plugin on every page load — not just on button
// click. The web OAuth popup returns to this same app; the plugin reads the
// token and closes that popup from its web-class constructor, which only runs
// once a plugin method is invoked. Without this the Google popup authenticates
// and then hangs open.
initSocialLogin().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
