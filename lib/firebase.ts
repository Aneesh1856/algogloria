import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

// Initialize Firebase (Singleton pattern to prevent re-initialization in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Enable Persistence (Browser environment only)
if (typeof window !== "undefined") {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, fallback to basic persistence
      console.warn("Firestore: Multiple tabs open, persistence limited.");
    } else if (err.code === 'unimplemented-') {
      // Browser doesn't support persistence
      console.warn("Firestore: Persistence unimplemented in this browser.");
    }
  });
}

export { app, db };
