# Environment Setup Guide

## Local Development

1. Create a `.env` file in the `backend/` directory:
```bash
cp .env.example .env  # If you have an example file, or create manually
```

2. Add your environment variables:
```env
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
CORS_ALLOW_ALL_ORIGINS=True
FIREBASE_PROJECT_ID=house-hunter-1-2e9f1
FIREBASE_SERVICE_ACCOUNT_PATH=backend/backend/firebase_service_key.json
```

## Production

Set environment variables in your hosting platform (Heroku, AWS, DigitalOcean, etc.):

```env
DJANGO_SECRET_KEY=<strong-random-secret>
DEBUG=False
ALLOWED_HOSTS=your-api-domain.com
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
CORS_ALLOW_ALL_ORIGINS=False
FIREBASE_PROJECT_ID=house-hunter-1-2e9f1
FIREBASE_SERVICE_ACCOUNT_PATH=/secure/path/to/firebase_service_key.json
# OR
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

## Important Notes

- **Never commit** `.env` or `firebase_service_key.json` to git
- These files are already in `.gitignore`
- Use environment variables in production for security
