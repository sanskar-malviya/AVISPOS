import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// A build without the Firebase config (e.g. Netlify environment variables not
// set) would otherwise show a blank page. Say exactly what is missing instead.
const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_APP_ID',
] as const;
const missing = REQUIRED.filter((k) => !import.meta.env[k]);

if (missing.length > 0) {
  root.render(
    <div className="h-full grid place-items-center p-6">
      <div className="card p-6 max-w-lg">
        <h1 className="text-xl font-extrabold text-red-700">App is not configured</h1>
        <p className="mt-2 text-stone-600">
          This build is missing its Firebase settings. Add these environment variables (Netlify →
          Site configuration → Environment variables, or the <code>.env</code> file) and deploy
          again:
        </p>
        <ul className="mt-3 font-mono text-sm list-disc ml-5">
          {missing.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
    </div>,
  );
} else {
  // Loaded only when configured, because importing the app initialises Firebase.
  void Promise.all([
    import('react-router-dom'),
    import('./app/App'),
    import('./app/auth'),
    import('./components/Toast'),
  ]).then(([{ BrowserRouter }, { default: App }, { AuthProvider }, { ToastProvider }]) => {
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>,
    );
  });
}
