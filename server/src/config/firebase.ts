import admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // In development, use default credentials or skip Firebase
    console.warn('No Firebase service account found. Auth will use dev mode.');
  }
}

export const firebaseAdmin = admin;
export const firestore = admin.apps.length ? admin.firestore() : null;
