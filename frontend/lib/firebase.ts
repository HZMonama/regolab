'use client';

// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBUxMvid8lEXjVf00XUvie69NMtIlLG84I",
  authDomain: "regolab-cloud.firebaseapp.com",
  projectId: "regolab-cloud",
  storageBucket: "regolab-cloud.firebasestorage.app",
  messagingSenderId: "989548067514",
  appId: "1:989548067514:web:ae8c816ebf67d85123e083",
  measurementId: "G-HP5GDTBZRN"
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Analytics (client-side only)
let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Initialize Auth
const auth = getAuth(app);

// Initialize GitHub Auth Provider
const githubProvider = new GithubAuthProvider();
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');

// Initialize Firestore with database name 'regolab'
const db = getFirestore(app, 'regolab');

export { app, analytics, auth, githubProvider, db };
