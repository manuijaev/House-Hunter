# Firebase Firestore Index Setup

## Required Index for Messages Collection

To fix the Firestore index error, you need to create a composite index in Firebase Console.

### Steps:
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `house-hunter-1-2e9f1`
3. Go to Firestore Database → Indexes
4. Click "Create Index"
5. Set the following fields:
   - Collection ID: `messages`
   - Fields to index:
     - `houseId` (Ascending)
     - `timestamp` (Ascending)
   - Query scope: Collection
6. Click "Create"

### Alternative: Use the direct link from the error
The error message provides a direct link to create the index. Click on the URL in the console error message.

### Indexes Needed:
1. Collection: `messages`
   - Field 1: `houseId` (Ascending)
   - Field 2: `timestamp` (Ascending)

2. Collection: `messages` (for tenant queries)
   - Field 1: `receiverId` (Ascending)
   - Field 2: `timestamp` (Ascending)

3. Collection: `messages` (for landlord queries by email)
   - Field 1: `receiverEmail` (Ascending)
   - Field 2: `timestamp` (Ascending)

4. Collection: `users` (for email lookup)
   - Field 1: `email` (Ascending)

