"""
Production WSGI Server for Windows & Local Networks using Waitress.
Run this file to host the application reliably without development server limitations.
"""
import logging
from waitress import serve
from app import app

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger('waitress')

if __name__ == '__main__':
    port = 5000
    print("=" * 60)
    print("  SignAI Assistant - Production Web Server (Waitress)")
    print(f"  Local Access:      http://localhost:{port}")
    print(f"  Network Access:    http://0.0.0.0:{port}")
    print("=" * 60)
    serve(app, host='0.0.0.0', port=port, threads=6)
