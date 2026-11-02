# OpenVoice Studio

> **Professional Open-Source AI Voice Generation, Text-to-Speech & Personal Voice Cloning Platform**  
> *Free, local-first speech synthesis and voice modeling without subscriptions, paid API keys, or cloud dependencies.*

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Local First](https://img.shields.io/badge/Inference-100%25%20Local-success.svg)](#local-generation)
[![Voices](https://img.shields.io/badge/Voice%20Catalog-115%2B%20Voices-purple.svg)](docs/VOICE_LIBRARY.md)
[![Audio](https://img.shields.io/badge/Audio-24kHz%20Broadcast%20WAV%20%7C%20MP3%20%7C%20FLAC-orange.svg)](#audio-workspace)

---

## 1. Product Vision & Core Principles

OpenVoice Studio is built on a clear, uncompromising standard:

> **Professional-quality AI speech generation should be accessible to all creators without mandatory subscriptions, token fees, or paid API keys.**

Commercial voice generation platforms lock high-fidelity speech behind recurring paywalls, charge per character, and retain user recordings on remote servers. OpenVoice Studio breaks this mold by running state-of-the-art open-weight models (Kokoro-82M, Piper VITS, Decoupled Tone Converter) and a digital signal processing pipeline directly on your local workstation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPENVOICE STUDIO DAW UI                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬───────────┐  │
│  │ Text-to-     │ Voice        │ Custom Voice │ Multi-Voice  │ Audio     │  │
│  │ Speech (DAW) │ Library (115)│ Studio       │ Projects     │ Workspace │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┴───────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Interactive Web Audio Waveform Player with Scrubbing & Transport      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API (FastAPI / Node.js)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    OPENVOICE STUDIO INFERENCE CORE                           │
│  ┌─────────────────┬──────────────────┬─────────────────────────────┐       │
│  │ Kokoro-82M      │ Piper VITS       │ Personal Voice Cloner       │       │
│  │ (StyleTTS 2 +   │ (Ultra-fast CPU, │ (Acoustic Forensics &       │       │
│  │  ISTFTNet Vocoder│ 50+ languages,  │  Tone Color Transfer)       │       │
│  │  Apache 2.0)    │  MIT / CC-BY)    │                             │       │
│  └─────────────────┴──────────────────┴─────────────────────────────┘       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Digital Signal Processing Engine (FFmpeg Core, Rubberband, Pitch FX)   │  │
│  │ SQLite Database (115 Voices, Dialogue Scripts, Generation History)    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Capabilities

### 🎙️ 1. Advanced Text-to-Speech Engine
* **Long-Form Generation**: Split massive texts into sentence-level chunks with pause buffers.
* **Intelligent Sentence Chunking**: Automatic recognition of honorifics (`Dr.`, `Mr.`), abbreviations (`U.S.A.`, `e.g.`), and numerical values (`$19.99`).
* **Micro-Pacing & Pause Tokens**: Insert millisecond-accurate pauses via `[pause:500ms]` or `<break time="1s"/>`.
* **Pronunciation Dictionary**: Custom IPA and phonetic overrides (e.g. `SQL` → `sequel`, `API` → `A P I`).
* **Live Word & Duration Statistics**: Real-time word counter, character counter, and estimated speech duration.
* **Model-Supported Controls**: Speaking speed (0.5x – 2.0x), vocal pitch shifting (-12 to +12 semitones), volume gain, and emotional style selection.

### 📚 2. 115+ Genuine AI Voice Library
* **Strict Provenance Standards**: Zero invented voices. Every voice profile represents a distinct trained speaker with verifiable licensing.
* **Kokoro-82M Voices (54+)**: High-fidelity narration voices across American English (`af_heart`, `am_adam`), British English (`bf_alice`, `bm_daniel`), Spanish (`ef_dora`), French (`ff_siwis`), Hindi (`hf_alpha`), Italian (`if_sara`), Japanese (`jf_alpha`), Brazilian Portuguese (`pf_dora`), and Mandarin Chinese (`zf_xiaobei`).
* **Piper VITS Voices (50+)**: Low-latency, multi-lingual voices covering Gujarati (`piper-gu-cmu`), Hindi (`piper-hi-cmu`), Arabic (`piper-ar-kareem`), German (`piper-de-thorsten`), Korean, Russian, Turkish, and more.
* **Built-in DSP Voices**: Ultra-low latency fallback voices requiring zero model downloads.

### 🧬 3. Personal Voice Cloning (Custom Voice Studio)
* **Audio Forensics**: Automatic verification of recording length (5s–15s), background noise floor, Signal-to-Noise Ratio (SNR), and microphone clipping.
* **Biometric Consent Protocol**: Mandatory ownership affirmation preventing non-consensual voice replication.
* **Acoustic Profiling**: Extraction of fundamental frequency ($F_0$) offset, vocal register, and dynamic range.
* **Local-First Privacy**: Custom profiles are stored locally in `storage/custom_voices/` and are never transmitted over network connections.

### 🎭 4. Multi-Voice Dialogue Studio
* **Multi-Character Scripts**: Assign distinct AI voices to different speakers in a single project (e.g. *Narrator*, *Guest*, *Host*).
* **Segment-Level Controls**: Adjust individual speaking speed, pitch, and inter-speaker pause durations.
* **Continuous Audio Rendering**: Combines all dialogue segments into a single seamless broadcast track.

### 🎛️ 5. Audio Workspace & Multi-Format Exporter
* **Interactive Waveform Player**: Scrubbing playhead, 5-second skip, playback rate adjustments, and real-time visualization.
* **Precision Trimmer**: Millisecond audio trimming.
* **Studio Master Export**: Export in uncompressed WAV (16-bit or 24-bit), high-bitrate MP3 (up to 256 kbps), or lossless FLAC.
* **Ethical AI Watermarking**: Embeds invisible disclosure metadata identifying the audio as synthetically generated.

---

## 3. Quick Start

### Prerequisites
* **Node.js** v20+ (Node.js v24 recommended)
* **FFmpeg** 6.0+ in your system PATH
* (Optional for Python backend): Python 3.10+ with `pip install -r backend/requirements.txt`

### Launch the Workstation
```bash
# 1. Clone repository
git clone https://github.com/poojakpdoshi-cmd/openvoice-studio.git
cd openvoice-studio

# 2. Start the native high-performance server
node backend/server.js
```
Open your browser to:
👉 **`http://localhost:8000`**

---

## 4. Documentation Index

* 📊 **[Model Comparison & Technical Evaluation](docs/MODEL_COMPARISON.md)**: Exhaustive benchmark comparing Kokoro-82M, Piper, XTTS v2, F5-TTS, OpenVoice V2, and Suno Bark.
* 🏗️ **[System Architecture](docs/ARCHITECTURE.md)**: Engineering layout, database schema, DSP pipelines, and REST API specification.
* 📖 **[Voice Library Catalog](docs/VOICE_LIBRARY.md)**: Provenance and license breakdown of all 115+ voices.
* 📦 **[Installation & Hardware Setup](docs/INSTALLATION.md)**: Guides for CPU, NVIDIA CUDA, Apple Silicon, and Docker.
* 🔒 **[Security & Watermarking](docs/SECURITY.md)**: Anti-impersonation safeguards and model supply chain security.
* 🛡️ **[Privacy & Consent Policy](docs/PRIVACY.md)**: Data sovereignty and biometric rights protection.
* 🗺️ **[Development Roadmap](docs/ROADMAP.md)**: Upcoming features and release schedules.

---

## 5. License

OpenVoice Studio is distributed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details. Individual voice models carry their own permissive open-source licenses (Apache 2.0, MIT, BSD-3, CC-BY, CC0) as detailed in `docs/VOICE_LIBRARY.md`.

