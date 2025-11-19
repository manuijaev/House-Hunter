#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django
django.setup()

# Import and run Daphne
from daphne.cli import CommandLineInterface

if __name__ == '__main__':
    cli = CommandLineInterface()
    cli.run(['-b', '0.0.0.0', '-p', '8000', 'backend.asgi:application'])