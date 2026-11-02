"""
OpenVoice Studio — Core Configuration
"""
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
AUDIO_DIR = STORAGE_DIR / "audio"
MODELS_DIR = STORAGE_DIR / "models"
VOICES_DIR = STORAGE_DIR / "custom_voices"
PREVIEWS_DIR = STORAGE_DIR / "previews"
EXPORTS_DIR = STORAGE_DIR / "exports"
DB_PATH = STORAGE_DIR / "openvoice.db"

# Create required directories
for d in [STORAGE_DIR, AUDIO_DIR, MODELS_DIR, VOICES_DIR, PREVIEWS_DIR, EXPORTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

APP_NAME = "OpenVoice Studio"
APP_VERSION = "1.0.0"
HOST = os.getenv("OPENVOICE_HOST", "127.0.0.1")
PORT = int(os.getenv("OPENVOICE_PORT", 8000))
CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173", "*"]

DEFAULT_SAMPLE_RATE = 24000
MAX_TEXT_LENGTH = 50000
MAX_CHUNK_CHARS = 350

