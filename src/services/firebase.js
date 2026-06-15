import { initializeApp } from 'firebase/app';

import { getAuth } from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA1vynEYHwRaMVdSovZEaTfYtSTBfe1qis",
  authDomain: "vitta-v.firebaseapp.com",
  projectId: "vitta-v",
  storageBucket: "vitta-v.firebasestorage.app",
  messagingSenderId: "297267745858",
  appId: "1:297267745858:web:33ec2cf1ac82549bdbc9db",
  measurementId: "G-8TVRNJDRHZ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export default app;