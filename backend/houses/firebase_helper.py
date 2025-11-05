"""
Firebase helper to broadcast house status changes
This allows real-time updates in the frontend without polling
"""
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase Admin (only if not already initialized)
try:
    if not firebase_admin._apps:
        # Try to use service account key if available
        service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
        firebase_project_id = os.getenv('FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT') or 'house-hunter-1-2e9f1'
        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred, {
                'projectId': firebase_project_id,
            })
        else:
            # Use default credentials (for local development) with explicit projectId
            firebase_admin.initialize_app(options={
                'projectId': firebase_project_id,
            })
    
    db = firestore.client()
except Exception as e:
    print(f"Firebase initialization warning: {e}")
    db = None

def update_house_status_in_firebase(house_id, approval_status, is_vacant, landlord_id=None, pending_reason: str | None = None):
    """
    Update house status in Firebase for real-time frontend updates
    
    Args:
        house_id: The house ID
        approval_status: 'pending', 'approved', or 'rejected'
        is_vacant: Boolean indicating if house is vacant
        landlord_id: Optional landlord ID or email
    """
    if not db:
        print("Firebase not initialized, skipping status update")
        return
    
    try:
        status_ref = db.collection('house_status_updates').document(str(house_id))
        payload = {
            'approval_status': approval_status,
            'is_vacant': is_vacant,
            'landlord_id': landlord_id,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'updated_by': 'admin'
        }
        if pending_reason:
            payload['pending_reason'] = pending_reason
        status_ref.set(payload, merge=True)
        print(f"Updated house {house_id} status in Firebase: {approval_status}")
    except Exception as e:
        print(f"Error updating Firebase status for house {house_id}: {e}")

