import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';

// Debug: surface whether renderer is running inside Electron and whether preload exposed `sidecar`
try {
  // eslint-disable-next-line no-console
  console.log('renderer: process.versions.electron =', (window as any).process?.versions?.electron ?? null);
  // eslint-disable-next-line no-console
  console.log('renderer: window.sidecar =', (window as any).sidecar ?? null);
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('renderer debug check failed', err);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
