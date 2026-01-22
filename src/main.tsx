import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PostHogProvider } from 'posthog-js/react';

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  session_recording: {
    maskAllInputs: false,
    maskInputOptions: {
      password: true
    }
  },
  capture_pageview: true,
  capture_pageleave: true
} as const;

// Unregister any existing service workers to prevent errors
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch((error) => {
        console.log('Service worker unregistration failed:', error);
      });
    }
  });
}
console.log('PostHog options:', import.meta.env.VITE_PUBLIC_POSTHOG_KEY);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={options} >
      <App />
    </PostHogProvider>
  </StrictMode>
);
