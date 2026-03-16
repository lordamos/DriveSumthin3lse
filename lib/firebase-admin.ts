import * as admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

export const adminDb = admin.firestore();
// If firestoreDatabaseId is present and not '(default)', we need to specify it
// However, firebase-admin's firestore() doesn't easily take a databaseId in older versions
// In newer versions, you can use admin.firestore(databaseId)
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
  ? (admin as any).firestore(firebaseConfig.firestoreDatabaseId)
  : admin.firestore();

export const auth = admin.auth();
