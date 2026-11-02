# OpenVoice Studio — Installation & Setup Guide

## System Requirements

| Specification | Minimum (Low Resource) | Recommended (Pro Studio) |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS 12+, Ubuntu 20.04+ | Windows 11, macOS 14 (M-Series), Ubuntu 22.04+ |
| **CPU** | 4-Core x86_64 or ARM64 | 8+ Core modern CPU (Intel i7/i9, Ryzen 7/9, Apple M3/M4) |
| **RAM** | 4 GB | 16 GB+ |
| **GPU / VRAM** | None required (CPU DSP mode active) | NVIDIA GPU with 6+ GB VRAM (RTX 3060/4060 or higher) |
| **Disk Space** | 500 MB (core engine + 115 voices) | 5 GB (for onnx models and audio exports) |

---

## 1. Quick Launch (Node.js Engine)

OpenVoice Studio includes a high-performance native server leveraging Node.js v20+ with built-in SQLite, audio streaming, and FFmpeg DSP.

```bash
# 1. Ensure FFmpeg is installed
# On Windows (winget):
winget install Gyan.FFmpeg

# On macOS (Homebrew):
brew install ffmpeg

# On Linux (Debian/Ubuntu):
sudo apt update && sudo apt install -y ffmpeg

# 2. Start OpenVoice Studio
node backend/server.js
```

Open your browser to: **`http://localhost:8000`**

---

## 2. Python FastAPI Backend Setup (Optional Alternative)

If you prefer to run the Python backend with PyTorch:

```bash
# 1. Create and activate a virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Run FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 3. Running Automated Tests

To run the internal verification test suite:

```bash
node backend/tests/direct_test.js
```

Expected output:
```
--- 1. Testing Voice Catalog Seeding ---
✓ Voice catalog loaded: 115 voices.
--- 2. Testing SQLite Database & 110+ Voice Insertion ---
✓ Database voice count: 115
--- 3. Testing Real Speech Synthesis & DSP Pitch Shift ---
✓ Generated master audio file size: 205996 bytes
--- 4. Testing Audio Forensics & Quality Auditing ---
✓ Audited duration: 4.29s
--- 5. Testing Multi-Format Export (WAV -> MP3) ---
✓ Exported MP3 size: 87432 bytes
--- 6. Testing Custom Voice Cloning Profile Generation ---
✓ Custom voice profile written with biometric consent affirmation.
--- 7. Testing Cloned Voice Synthesis ---
✓ Cloned voice synthesis verified: 76182 bytes
--- 8. Testing Inter-Speaker Pause & Multi-Voice Concatenation ---
✓ Multi-speaker continuous dialogue rendered: 282100 bytes
========================================================
  🎉 100% OF OPENVOICE STUDIO SUBSYSTEMS VERIFIED OK!
========================================================
```
