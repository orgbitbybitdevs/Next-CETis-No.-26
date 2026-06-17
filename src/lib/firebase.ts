import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
  type Auth,
  type User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  type DocumentSnapshot,
  type Firestore,
  where
} from 'firebase/firestore';

let app: FirebaseApp | undefined;
let appCheck: AppCheck | undefined;

export function getFirebaseApp() {
  if (!app) {
    app = initializeApp({
      apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
      authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
      measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID
    });
  }

  return app;
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  void setPersistence(auth, browserLocalPersistence);
  return auth;
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function initAppCheck() {
  if (typeof window === 'undefined' || appCheck || !import.meta.env.PUBLIC_FIREBASE_APP_CHECK_SITE_KEY) {
    return appCheck;
  }

  appCheck = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.PUBLIC_FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });

  return appCheck;
}

export async function ensureAnonymousUser(): Promise<User> {
  const auth = getFirebaseAuth();
  initAppCheck();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function getCurrentRole(uid: string) {
  const snapshot = await getDoc(doc(getFirebaseDb(), 'roles', uid));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return data.active === false ? null : data.role;
}

export function reportsPageQuery(options: {
  status?: string;
  type?: string;
  cursor?: DocumentSnapshot;
}) {
  const clauses = [];
  if (options.status && options.status !== 'all') {
    clauses.push(where('status', '==', options.status));
  }
  if (options.type && options.type !== 'all') {
    clauses.push(where('type', '==', options.type));
  }

  const ordered = [
    collection(getFirebaseDb(), 'reports'),
    ...clauses,
    orderBy('createdAt', 'desc'),
    limit(20)
  ] as const;

  return options.cursor ? query(...ordered, startAfter(options.cursor)) : query(...ordered);
}

export { serverTimestamp };
