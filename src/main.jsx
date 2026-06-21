import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ToastProvider } from './contexts/ToastContext';
import './index.css';

registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('swUpdated'));
  },
  onOffline() {
    window.dispatchEvent(new CustomEvent('swOffline'));
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
