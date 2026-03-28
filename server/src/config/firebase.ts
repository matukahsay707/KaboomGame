import admin from 'firebase-admin';

console.log('Firebase env check:', {
  hasProjectId: !!process.env.project_id,
  hasClientEmail: !!process.env.client_email,
  hasPrivateKey: !!process.env.private_key,
  privateKeyLength: process.env.private_key?.length ?? 0,
  privateKeyStart: process.env.private_key?.substring(0, 30) ?? 'MISSING',
  nodeEnv: process.env.NODE_ENV,
});

if (!admin.apps.length) {
  if (process.env.project_id && process.env.client_email && process.env.private_key) {
    try {
      const privateKey = process.env.private_key.replace(/\\n/g, '\n');
      console.log('Firebase: Initializing with project:', process.env.project_id);
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.project_id,
          clientEmail: process.env.client_email,
          privateKey,
        }),
      });
      console.log('Firebase: Initialized successfully');
    } catch (err) {
      console.error('Firebase: Initialization FAILED — continuing without Firebase:', err);
    }
  } else {
    console.warn('No Firebase credentials found. Auth will use dev mode.');
  }
}

export const firebaseAdmin = admin;
export const firestore = admin.apps.length ? admin.firestore() : null;
