# OpenVoice Studio — Installation & Setup Guide

## System Requirements

| Specification | Minimum (Low Resource) | Recommended (Pro Studio) |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS 12+, Ubuntu 20.04+ | Windows 11, macOS 14 (M-Series), Ubuntu 22.04+ |
| **CPU** | 4-Core x86_64 or ARM64 | 8+ Core modern CPU (AMD Ryzen 7/9, Intel i7/i9, Apple M-Series) |
| **RAM** | 8 GB | 16 GB+ |
| **GPU / VRAM** | CPU AVX2 multi-threaded SIMD supported | NVIDIA GPU (DirectML / CUDA) or Apple Silicon GPU |
| **Disk Space** | 2 GB (neural models + audio cache) | 10 GB (for multi-language voice packs and projects) |

---

## 1. Quick Launch (Node.js Neural Engine)

OpenVoice Studio includes a high-performance native server leveraging Node.js v20+ (v24 recommended) with native ONNX Runtime, Kokoro-82M, Piper VITS, and Meta MMS.

```bash
# 1. Clone repository
git clone https://github.com/poojakpdoshi-cmd/openvoice-studio.git
cd openvoice-studio

# 2. Install dependencies (ONNX Runtime and Kokoro TTS)
npm install

# 3. Ensure FFmpeg is installed and accessible in PATH
ffmpeg -version

# 4. Start OpenVoice Studio
node backend/server.js
```

Open your browser to: **`http://localhost:8000`**

---

## 2. Running Automated Neural Tests

OpenVoice Studio includes a complete neural acceptance test suite that validates hardware detection, model loading, Kokoro inference, Piper English/Hindi inference, Meta MMS Gujarati inference, zero-shot voice cloning, and audio workspace exports:

```bash
node backend/test_suite.js
```

Expected output:
```
================================================================
       OPENVOICE STUDIO — NEURAL ACCEPTANCE TEST SUITE          
================================================================

[PASS] Hardware Telemetry Check
[PASS] Voice Catalog Audit
[PASS] Kokoro-82M Neural Synthesis (English)
[PASS] Piper VITS Neural Synthesis (English)
[PASS] Piper VITS Neural Synthesis (Hindi)
[PASS] Meta MMS Neural Synthesis (Gujarati)
[PASS] Zero-Shot Custom Voice Cloning
[PASS] Audio Workspace Exports (WAV, MP3, FLAC)
[PASS] Multi-Speaker Dialogue Synthesis

================================================================
TOTAL TESTS: 9 | PASSED: 9 | FAILED: 0
================================================================
```

---

## 3. Python FastAPI Backend Setup (Optional Alternative)

If you prefer to run the Python backend with PyTorch:

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Run FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 4. Hardware Acceleration

* **CPU**: Automatically utilizes multi-threaded AVX2/AVX-512 SIMD vector instructions via `onnxruntime-node`.
* **Integrated GPUs (AMD Radeon, Intel Iris Xe)**: Detected in telemetry; DirectML acceleration supported.
* **NVIDIA CUDA**: Fully supported via ONNX Runtime CUDA provider when NVIDIA GPU and drivers are present.
