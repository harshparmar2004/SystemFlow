import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// Note: Ensure you have populated your .env file with the correct Firebase configuration.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const checkTeamNameExists = async (eventId: string, teamName: string) => {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where('eventId', '==', eventId), where('teamName', '==', teamName));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};
