// Firebase configuration for messaging only (Firestore)
// Firebase Auth has been completely removed

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase config - only for Firestore messaging
// ⚠️  IMPORTANT: Replace these placeholder values with your actual Firebase project config
// Go to Firebase Console > Project Settings > General > Your apps > Web app config
const firebaseConfig = {
  apiKey: "AIzaSyDBX5QicwqDXzUN4oD0RdZsDnu2A9kJZA8",
  authDomain: "house-hunter-1-2e9f1.firebaseapp.com",
  projectId: "house-hunter-1-2e9f1",
  storageBucket: "house-hunter-1-2e9f1.firebasestorage.app",
  messagingSenderId: "333132100883",
  appId: "1:333132100883:web:299b50273392874ecb16e6"
};

// Initialize Firebase (only Firestore, no Auth)
const app = initializeApp(firebaseConfig);

// Initialize Firestore for messaging
export const db = getFirestore(app);

// Note: Firebase Auth has been completely removed
// Authentication is now handled by Django JWT