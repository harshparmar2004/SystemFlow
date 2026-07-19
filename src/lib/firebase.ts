import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const checkTeamNameExists = async (eventId: string, teamName: string) => {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where('eventId', '==', eventId), where('teamName', '==', teamName));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};
