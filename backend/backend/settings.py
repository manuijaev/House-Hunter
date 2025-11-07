"""
Django settings for backend project.
"""
import json
from pathlib import Path
import os
from datetime import timedelta

# Try to import Firebase (optional)
try:
    import firebase_admin
    from firebase_admin import credentials
    FIREBASE_AVAILABLE = True
except ImportError:
    firebase_admin = None
    FIREBASE_AVAILABLE = False

# Load environment variables from a .env file if available
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize Firebase Admin SDK safely (dev- and prod-friendly)
if FIREBASE_AVAILABLE:
    try:
        if not firebase_admin._apps:
            FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT') or 'house-hunter-1-2e9f1'

            # 1) Prefer explicit JSON from env (FIREBASE_CREDENTIALS_JSON)
            creds_json_str = os.getenv('FIREBASE_CREDENTIALS_JSON')
            # 2) Then explicit path from env
            service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH') or os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            # 3) As a last resort, use local dev file if present
            default_local_path = str(Path(__file__).resolve().parent / "firebase_service_key.json")

            if creds_json_str:
                try:
                    creds_dict = json.loads(creds_json_str)
                    cred = credentials.Certificate(creds_dict)
                    firebase_admin.initialize_app(cred, { 'projectId': FIREBASE_PROJECT_ID })
                except Exception as e:
                    print(f"Invalid FIREBASE_CREDENTIALS_JSON: {e}")
                    raise
            elif service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred, { 'projectId': FIREBASE_PROJECT_ID })
            elif os.path.exists(default_local_path):
                # Dev-only fallback; ensure this file is gitignored
                cred = credentials.Certificate(default_local_path)
                firebase_admin.initialize_app(cred, { 'projectId': FIREBASE_PROJECT_ID })
            else:
                # Initialize with explicit projectId so verification works without a key in dev/CI
                firebase_admin.initialize_app(options={ 'projectId': FIREBASE_PROJECT_ID })
    except Exception as e:
        print(f"Firebase init warning (settings): {e}")
        FIREBASE_AVAILABLE = False
else:
    print("Firebase admin not installed - continuing without Firebase features")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-insecure-secret-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True').lower() in ('1', 'true', 'yes')

ALLOWED_HOSTS = [h for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'houses',  # your custom app
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# CORS settings - allow React app to communicate with Django
# For production, prefer explicit origins via env; in dev you can allow all
cors_allow_all = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ('1', 'true', 'yes')
# In DEBUG, allow all origins to simplify local development
CORS_ALLOW_ALL_ORIGINS = True if DEBUG else cors_allow_all

# Include common dev ports (3000, 5173) by default; override with env in prod
_cors_origins_env = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGINS = [o for o in _cors_origins_env.split(',') if o]

CORS_ALLOW_CREDENTIALS = True

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'houses.auth.FirebaseAuthentication',
    ],
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
