import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBX5QicwqDXzUN4oD0RdZsDnu2A9kJZA8",
  authDomain: "house-hunter-1-2e9f1.firebaseapp.com",
  projectId: "house-hunter-1-2e9f1",
  storageBucket: "house-hunter-1-2e9f1.firebasestorage.app",
  messagingSenderId: "333132100883",
  appId: "1:333132100883:web:299b50273392874ecb16e6"
};

// Clear any existing apps to prevent conflicts
const existingApps = getApps();
if (existingApps.length > 0) {
  console.log('Clearing existing Firebase apps:', existingApps.length);
  // Note: In a real app, you might want to handle this more gracefully
}

// Initialize Firebase only if no app exists
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

console.log('Firebase app initialized:', app.name);
console.log('Firebase config:', firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log('Firebase services initialized');

export default app;