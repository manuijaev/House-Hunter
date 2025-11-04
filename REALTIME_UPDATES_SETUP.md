# Real-Time House Status Updates Setup

## Overview
Auto-refresh has been **removed** and replaced with **real-time Firebase listeners** that provide **immediate updates** when admin changes house status.

## How It Works

### 1. Firebase Status Broadcast
- When admin approves/rejects a house, Django backend updates Firebase
- When landlord toggles vacancy, both Django and Firebase are updated
- Frontend listens to Firebase for instant updates

### 2. Real-Time Listeners
- **Landlord Dashboard**: Listens to `house_status_updates` collection filtered by `landlord_id`
- **Tenant Dashboard**: Listens to all `house_status_updates` for approved houses
- Updates happen **immediately** without polling

### 3. Fallback Mechanism
- If Firebase listener fails to initialize, automatically falls back to polling (every 10 seconds)
- This ensures the system works even if Firebase has issues

## Backend Setup Required

### Install Firebase Admin SDK
```bash
cd backend
pip install firebase-admin
```

### Optional: Firebase Service Account
For production, create a Firebase service account key:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Save as `firebase-service-account.json` in backend directory
4. Set environment variable: `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`

### Note
The backend will work without Firebase Admin SDK - it will simply skip Firebase updates and the frontend will fall back to polling.

## Frontend Features

### Real-Time Updates
- ✅ **Landlord Dashboard**: Houses update immediately when admin approves/rejects
- ✅ **Tenant Dashboard**: Houses appear/disappear immediately when status changes
- ✅ **Vacancy Toggle**: Updates broadcast in real-time
- ✅ **No Polling**: Removed all `setInterval` auto-refresh

### Benefits
- **Instant Updates**: Changes appear immediately without waiting
- **Better Performance**: No constant API polling
- **Reduced Server Load**: Only updates when changes occur
- **Better UX**: Users see changes as they happen

## Firebase Collection Structure

### Collection: `house_status_updates`
```javascript
{
  // Document ID = houseId (string)
  approval_status: 'pending' | 'approved' | 'rejected',
  is_vacant: boolean,
  landlord_id: string, // Firebase UID or Django User ID
  updated_at: Timestamp,
  updated_by: 'admin' | 'landlord'
}
```

## How Status Changes Work

### Admin Approves/Rejects House
1. Admin calls Django API endpoint
2. Django updates house in database
3. Django broadcasts to Firebase `house_status_updates` collection
4. Frontend Firebase listeners detect change **immediately**
5. UI updates **instantly** without refresh

### Landlord Toggles Vacancy
1. Landlord clicks toggle button
2. Frontend updates local state immediately (optimistic)
3. Frontend sends update to Django API
4. Frontend also updates Firebase directly (for speed)
5. Django backend also updates Firebase (for consistency)
6. All connected clients receive update **instantly**

## Testing

To verify real-time updates work:
1. Open landlord dashboard in one browser
2. Open admin panel in another browser/window
3. Approve/reject a house in admin panel
4. Watch landlord dashboard - it should update **immediately** without refresh

## Troubleshooting

### Updates not appearing?
1. Check browser console for Firebase errors
2. Verify Firebase connection is working
3. Check if backend Firebase helper is working (check Django logs)
4. System will automatically fall back to polling if Firebase fails

### Firebase Admin SDK not installed?
- Backend will continue to work
- Frontend will fall back to polling (10 second intervals)
- Install Firebase Admin SDK for full real-time functionality

