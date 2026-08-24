import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  push,
  serverTimestamp as rtdbServerTimestamp
} from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyC1fc-KgWr84-FZdaIxL0N4io0jlKUU_wg",
  authDomain: "raitra-42e79.firebaseapp.com",
  databaseURL: "https://raitra-42e79-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "raitra-42e79",
  storageBucket: "raitra-42e79.firebasestorage.app",
  messagingSenderId: "858315451218",
  appId: "1:858315451218:web:13dc3a5516ffdcdd7b288b",
  measurementId: "G-F6WW6TDVB8"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  push,
  rtdbServerTimestamp
};

export type { User };
