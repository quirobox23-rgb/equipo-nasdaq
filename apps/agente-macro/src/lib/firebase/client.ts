import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

// Config pública — segura de exponer en el navegador. La seguridad real
// la dan las reglas de Firestore y la propia autenticación, no el
// secreto de esta config.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** Sin claves de Firebase la app funciona en modo local: sin login y con todo
 *  abierto, para probarla en tu ordenador. Al publicarla, pon las claves. */
export const MODO_LOCAL = !firebaseConfig.apiKey

// Se inicializa solo cuando se usa (en el navegador): si se hiciera al
// importar el módulo, `next build` fallaría al prerenderizar las páginas
// en el servidor (auth/invalid-api-key). getApps() evita reinicializar en
// cada hot-reload de Next.js.
function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getFirebaseAuth(): Auth {
  return getAuth(firebaseApp())
}

// db se deja preparado para cuando guardemos los reportes de agentes /
// ATM semanal — hoy no se usa todavía, solo el login.
export function getDb(): Firestore {
  return getFirestore(firebaseApp())
}
