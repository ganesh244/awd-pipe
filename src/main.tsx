import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service worker auto-reload.
// The SW caches the app shell so the app opens instantly and offline. The
// downside is that a deployed fix keeps showing the OLD cached shell until the
// page is reloaded — which is why a shipped fix appeared "still there" on
// devices that had the app open. registerType:'autoUpdate' installs the new SW
// and claims the page in the background; this listener reloads once when that
// new SW takes control, so the current fix and every future one reach an
// already-open app on its own.
//
// The guard matters: the listener is attached ONLY when a controller already
// exists (an update), never on the very first install, and `reloading` stops
// any chance of a reload loop.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
