# Lumine Wellness App

A React + Vite personal wellness app with Tailwind CSS, Firebase Auth/Firestore, and PWA support.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Firebase project and enable Authentication + Firestore.

3. Copy `.env.example` to `.env` and fill in your Firebase config:
   ```bash
   cp .env.example .env
   ```

4. Update `src/firebase.js` to read from environment variables:
   ```js
   import { initializeApp } from 'firebase/app';
   import { getAuth } from 'firebase/auth';
   import { getFirestore } from 'firebase/firestore';

   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
     appId: import.meta.env.VITE_FIREBASE_APP_ID
   };

   const app = initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   ```

## Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

## PWA

The app uses `vite-plugin-pwa` for offline support and installability. A service worker is registered automatically.

## Firebase security rules

Use the rule file in `firestore.rules` to ensure users can only access their own data.
