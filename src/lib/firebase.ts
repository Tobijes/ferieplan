import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let isConfigured = false;
let environmentName = '';
let initPromise: Promise<void> | null = null;

interface RuntimeConfig {
  ENVIRONMENT_NAME?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_AUTH_DOMAIN?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  FIREBASE_MESSAGING_SENDER_ID?: string;
  FIREBASE_APP_ID?: string;
}

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/config.json');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Initialize Firebase asynchronously.
 * Tries /config.json first (Docker runtime), falls back to import.meta.env (local dev).
 * Safe to call multiple times — only runs once.
 */
export function initFirebase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const runtime = await fetchRuntimeConfig();

    environmentName = runtime.ENVIRONMENT_NAME || import.meta.env.VITE_ENVIRONMENT_NAME || '';

    const config = {
      apiKey: runtime.FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: runtime.FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: runtime.FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: runtime.FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: runtime.FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: runtime.FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || '',
    };

    isConfigured = !!config.apiKey && !!config.projectId;
    console.log('[Firebase]', { projectId: config.projectId, storageBucket: config.storageBucket, isConfigured });

    if (isConfigured) {
      const app = initializeApp(config);
      auth = getAuth(app);
      storage = getStorage(app);
    }
  })();
  return initPromise;
}

export { auth, storage, isConfigured, environmentName };
