import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// No APK os arquivos já vêm dentro do app; um service worker poderia servir a versão antiga após atualizar.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
