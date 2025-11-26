#!/usr/bin/env bash
echo "=== Building Django Application ==="
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
echo "=== Build Complete ==="