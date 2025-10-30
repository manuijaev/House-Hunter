const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Note: You'll need to set up your service account key
// For now, using environment variables or default credentials
if (!admin.apps.length) {
  // If you have a service account file, use:
  // const serviceAccount = require('./firebase-service-account.json');
  // admin.initializeApp({
  //   credential: admin.credential.cert(serviceAccount)
  // });

  // For development, you might use default credentials if running on GCP
  // or set GOOGLE_APPLICATION_CREDENTIALS environment variable
  admin.initializeApp({
    // Add your project config here if needed
    projectId: 'house-hunter-1-2e9f1'
  });
}

const db = admin.firestore();

async function clearAllRecommendations() {
  try {
    console.log('Starting to clear AI recommendations from all users...');

    // Get all users
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      console.log('No users found.');
      return;
    }

    let clearedCount = 0;

    // Clear recommendations for each user
    const batch = db.batch();
    snapshot.forEach((doc) => {
      const userRef = usersRef.doc(doc.id);
      batch.update(userRef, {
        recommendations: admin.firestore.FieldValue.delete()
      });
      clearedCount++;
    });

    // Commit the batch
    await batch.commit();

    console.log(`Successfully cleared AI recommendations from ${clearedCount} users.`);

  } catch (error) {
    console.error('Error clearing recommendations:', error);
  }
}

// Run the function
clearAllRecommendations().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});