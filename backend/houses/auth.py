from typing import Optional, Tuple

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework import exceptions

import os
from django.conf import settings
import jwt


class FirebaseUser:
    def __init__(self, uid: str, email: str | None):
        self.uid = uid
        self.email = email

    @property
    def is_authenticated(self) -> bool:
        return True

# Try to import Firebase Admin; tolerate absence for local dev
try:
    import firebase_admin  # type: ignore
    from firebase_admin import auth as fb_auth, credentials  # type: ignore
    FIREBASE_AVAILABLE = True
except Exception:
    firebase_admin = None  # type: ignore
    fb_auth = None  # type: ignore
    credentials = None  # type: ignore
    FIREBASE_AVAILABLE = False


def _ensure_firebase_initialized() -> None:
    if not FIREBASE_AVAILABLE:
        return
    try:
        if not firebase_admin._apps:
            service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
            firebase_project_id = os.getenv('FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT') or 'house-hunter-1-2e9f1'
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred, {
                    'projectId': firebase_project_id,
                })
            else:
                # Initialize with explicit projectId so token verification works without ADC
                firebase_admin.initialize_app(options={
                    'projectId': firebase_project_id,
                })
    except Exception as e:
        # If Firebase cannot initialize, we fail later when verifying tokens
        print(f"Firebase init warning (auth): {e}")


class FirebaseAuthentication(BaseAuthentication):
    """Authenticate requests with Firebase ID tokens provided via Authorization: Bearer <token>"""

    def authenticate(self, request) -> Optional[Tuple[object, None]]:
        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != b'bearer':
            # Dev fallback: if no token provided, allow a dummy authenticated user in DEBUG
            if getattr(settings, 'DEBUG', False):
                return FirebaseUser('dev-user', None), None
            return None

        if len(auth) == 1:
            raise exceptions.AuthenticationFailed('Invalid Authorization header. No credentials provided.')
        elif len(auth) > 2:
            raise exceptions.AuthenticationFailed('Invalid Authorization header. Token string should not contain spaces.')

        token = auth[1].decode('utf-8')

        _ensure_firebase_initialized()

        try:
            if FIREBASE_AVAILABLE:
                decoded = fb_auth.verify_id_token(token)  # type: ignore
            else:
                raise Exception('firebase_admin not available')
        except Exception as e:
            # Development fallback: allow unverified decode when DEBUG and no service account
            if getattr(settings, 'DEBUG', False):
                try:
                    unverified = jwt.decode(token, options={"verify_signature": False})
                    uid = unverified.get('uid') or unverified.get('user_id')
                    email = unverified.get('email')
                    if uid:
                        return FirebaseUser(uid, email), None
                except Exception:
                    pass

            # Allow anonymous for public GET houses if token invalid
            if request.method == 'GET' and request.path.startswith('/api/houses/'):
                return None

            raise exceptions.AuthenticationFailed(f'Invalid Firebase token: {e}')

        uid = decoded.get('uid') or decoded.get('user_id')
        email = decoded.get('email')
        if not uid:
            raise exceptions.AuthenticationFailed('Invalid Firebase token: missing uid')

        return FirebaseUser(uid, email), None


