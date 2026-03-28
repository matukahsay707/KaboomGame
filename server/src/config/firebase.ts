import admin from 'firebase-admin';

console.log('Firebase env check:', {
  hasProjectId: !!process.env.project_id,
  hasClientEmail: !!process.env.client_email,
  hasPrivateKey: !!process.env.private_key,
  nodeEnv: process.env.NODE_ENV,
});

if (!admin.apps.length) {
  if (process.env.project_id && process.env.client_email && process.env.private_key) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.project_id,
        clientEmail: process.env.client_email,
        privateKey: process.env.private_key.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    console.warn('No Firebase credentials found. Auth will use dev mode.');
  }
}

export const firebaseAdmin = admin;
export const firestore = admin.apps.length ? admin.firestore() : null;
