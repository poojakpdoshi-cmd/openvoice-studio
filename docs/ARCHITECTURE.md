# OpenVoice Studio — System Architecture & Technical Specification

## 1. System Overview

OpenVoice Studio is an enterprise-grade, desktop-first, open-source AI voice synthesis, multi-voice production, and voice cloning workstation. It is engineered with a strict **local-first** requirement: all inference, audio processing, database storage, and voice cloning calculations execute on the user's workstation without requiring paid API keys, credit consumption, or remote telemetry.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OPENVOICE STUDIO UI (React/TS/Tailwind)               │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬───────────┐  │
│  │ Text-to-     │ Voice        │ Custom Voice │ Multi-Voice  │ Audio     │  │
│  │ Speech Studio│ Library (100)│ Studio       │ Projects     │ Workspace │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┴───────────┘  │
│  ┌─────────────────────────┬─────────────────────────┬───────────────────┐  │
│  │ Web Audio Waveform Player│ Sentence Chunking Editor│ Model Download Mgr│  │
│  └─────────────────────────┴─────────────────────────┴───────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST / SSE API
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    OPENVOICE STUDIO BACKEND & ENGINE                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ API Router: /api/tts, /api/voices, /api/clone, /api/projects, /models │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ Job Queue & Background Task Manager (Async cancellation, progress)    │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ Storage & DB Layer: SQLite (local.db) + Filesystem Storage Manager    │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │             Unified Multi-Engine Inference Orchestrator               │  │
│  │  ┌─────────────────┬──────────────────┬─────────────────────────────┐ │  │
│  │  │ Kokoro-82M      │ Piper TTS        │ Personal Voice Cloner       │ │  │
│  │  │ (StyleTTS2+ISTFT│ (VITS ONNX       │ (Spectral Acoustic Matcher  │ │  │
│  │  │  Apache 2.0)    │  Multi-language) │  + Tone Color Converter)    │ │  │
│  │  └─────────────────┴──────────────────┴─────────────────────────────┘ │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │                  DSP & Audio Processing Pipeline                      │  │
│  │  • FFmpeg 9.0 Core (DSP Resampling, Pitch shifting, Rubberband, Trans) │  │
│  │  • Quality Analyzer (SNR, Noise Floor, Dynamic Range, Clipping Audit) │  │
│  │  • Multi-segment Concatenation with Cross-fade & Silence Gap Control  │  │
│  │  • Lossless/Lossy Audio Encoders: WAV (16/24-bit), MP3 (VBR), FLAC    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Modules & Directory Layout

```
openvoice-studio/
├── docs/
│   ├── MODEL_COMPARISON.md      # Detailed benchmark & evaluation of 8+ TTS engines
│   ├── ARCHITECTURE.md          # Technical architecture & subsystem design
│   ├── VOICE_LIBRARY.md         # Directory of 100+ voices with provenance
│   ├── INSTALLATION.md          # Multi-platform deployment instructions
│   ├── PRIVACY.md               # Biometric privacy & consent model
│   └── SECURITY.md              # Safety, watermarking & anti-impersonation
├── backend/
│   ├── app/
│   │   ├── api/                 # API controllers & route handlers
│   │   │   ├── routes/
│   │   │   │   ├── tts.py / .ts
│   │   │   │   ├── voices.py / .ts
│   │   │   │   ├── clone.py / .ts
│   │   │   │   ├── projects.py / .ts
│   │   │   │   ├── audio.py / .ts
│   │   │   │   └── models.py / .ts
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py / .ts  # Runtime settings, directories, environment
│   │   │   ├── database.py / .ts# SQLite schema & persistence
│   │   │   ├── hardware.py / .ts# CPU/GPU/VRAM detection & benchmarking
│   │   │   └── queue.py / .ts   # Background job management
│   │   ├── adapters/            # Modular model adapters
│   │   │   ├── base.py / .ts    # BaseTTSAdapter interface
│   │   │   ├── kokoro.py / .ts  # Kokoro-82M adapter
│   │   │   ├── piper.py / .ts   # Piper TTS adapter
│   │   │   └── flite.py / .ts   # Built-in instant DSP adapter
│   │   ├── services/
│   │   │   ├── chunker.py / .ts # Sentence & paragraph chunking engine
│   │   │   ├── dictionary.py    # Pronunciation override dictionary
│   │   │   ├── audio_dsp.py     # FFmpeg audio filter & post-processing
│   │   │   ├── voice_cloner.py  # Audio quality audit & cloning engine
│   │   │   └── exporter.py      # Multi-format export (WAV, MP3, FLAC)
│   │   └── main.py / server.ts  # Application entrypoint
│   └── tests/                   # Automated backend test suite
├── frontend/
│   ├── index.html               # SPA Entrypoint
│   ├── src/
│   │   ├── App.tsx              # Root component & navigation
│   │   ├── components/
│   │   │   ├── Navigation.tsx   # Professional sidebar navigation
│   │   │   ├── AudioPlayer.tsx  # Interactive waveform audio workstation
│   │   │   ├── TextEditor.tsx   # Smart chunking text workspace
│   │   │   └── VoiceSelector.tsx# Voice browsing & filter modal
│   │   ├── views/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TextToSpeech.tsx
│   │   │   ├── VoiceLibrary.tsx
│   │   │   ├── CustomVoiceStudio.tsx
│   │   │   ├── MultiVoiceProjects.tsx
│   │   │   ├── AudioEditor.tsx
│   │   │   ├── ModelManager.tsx
│   │   │   ├── GenerationHistory.tsx
│   │   │   └── Settings.tsx
│   │   ├── store/               # Application state (Zustand)
│   │   └── lib/                 # API client & audio utilities
│   └── package.json
└── README.md
```

---

## 3. Database Schema (SQLite)

The local SQLite database (`storage/openvoice.db`) is structured to preserve all studio state:

```sql
-- Voices Catalog (Pre-installed and Downloadable)
CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    language TEXT NOT NULL,
    accent TEXT NOT NULL,
    gender TEXT NOT NULL,
    category TEXT NOT NULL, -- 'conversational', 'narration', 'storytelling', 'news', 'educational'
    engine TEXT NOT NULL,   -- 'kokoro', 'piper', 'flite', 'clone'
    model_id TEXT NOT NULL,
    sample_rate INTEGER DEFAULT 24000,
    license_type TEXT NOT NULL,
    is_installed INTEGER DEFAULT 1,
    is_custom INTEGER DEFAULT 0,
    traits_json TEXT,       -- Speed range, pitch support, styles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generation History
CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    text_content TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    engine TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    file_path TEXT NOT NULL,
    format TEXT NOT NULL,
    sample_rate INTEGER NOT NULL,
    settings_json TEXT,     -- speed, pitch, volume, style
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(voice_id) REFERENCES voices(id)
);

-- Custom Voice Profiles (Voice Cloning)
CREATE TABLE IF NOT EXISTS custom_voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    source_language TEXT NOT NULL,
    reference_audio_path TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    snr_db REAL NOT NULL,
    noise_level TEXT NOT NULL,   -- 'low', 'moderate', 'high'
    is_clipped INTEGER DEFAULT 0,
    consent_confirmed INTEGER NOT NULL, -- Mandatory consent
    consent_timestamp TIMESTAMP NOT NULL,
    acoustic_features_json TEXT, -- Spectral centroids, pitch range, timbre
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multi-Voice Dialogue Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Dialogue Segments
CREATE TABLE IF NOT EXISTS project_segments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    speaker_label TEXT NOT NULL, -- e.g. "Narrator", "Speaker 1"
    voice_id TEXT NOT NULL,
    text_content TEXT NOT NULL,
    pause_after_ms INTEGER DEFAULT 400,
    speed REAL DEFAULT 1.0,
    pitch REAL DEFAULT 1.0,
    volume REAL DEFAULT 1.0,
    generated_audio_path TEXT,
    duration_seconds REAL DEFAULT 0.0,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(voice_id) REFERENCES voices(id)
);

-- Pronunciation Overrides
CREATE TABLE IF NOT EXISTS pronunciations (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    replacement TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    notes TEXT
);
```

---

## 4. Audio Processing & DSP Specifications

1. **Text Chunking Pipeline:**
   * Text is parsed into sentences using regex boundary matching aware of honorifics (Mr., Dr., Mrs.), numbers ($10.50), and abbreviations (U.S.A., e.g.).
   * Sentences exceeding maximum token/character constraints (250 chars for high-speed synthesis) are split on semantic punctuation (semicolons, em-dashes, commas).
   * Pacing tokens (`<break time="500ms"/>` or `[pause:500]`) are extracted and converted to precise millisecond digital silence buffers.

2. **DSP Voice Conditioning:**
   * Speed adjustment: utilizes time-domain pitch-synchronous overlap-add (TD-PSOLA) / atempo filtering to scale tempo without pitch distortion.
   * Pitch adjustment: utilizes sample-rate remapping (`asetrate`) coupled with resampling to alter vocal fundamental frequency ($F_0$) without changing playback speed.
   * Equalization & Formant Shifting: multi-band parametric equalization to adapt vocal timbre (warmth, presence, air).

3. **Audio Export Architecture:**
   * **WAV:** Uncompressed PCM (16-bit or 24-bit integer, mono or stereo, 16kHz to 48kHz).
   * **MP3:** Fraunhofer/LAME variable bit-rate (V0) or constant bit-rate (128 kbps to 320 kbps).
   * **FLAC:** Free Lossless Audio Codec (compression level 5, 24-bit support).
   * Built-in ID3/RIFF metadata tagger: adds `Artist: OpenVoice Studio`, `Title`, and an invisible safety disclosure tag: `AI_VOICE_STUDIO_GENERATED: true`.

---

## 5. Zero-Model Procedural Audio & Music Synthesis Engine

OpenVoice Studio includes a dedicated zero-model procedural audio generation engine (`backend/procedural_engine.js`) that operates completely independently of neural network weights, cloud APIs, and external sample libraries. All sound waves are computed on-the-fly via mathematical functions and digital signal processing algorithms.

### 5.1 Mathematical DSP Foundations
* **Oscillators**: Continuous-phase mathematical functions for Sine ($\sin(2\pi ft)$), Square with pulse-width duty modulation ($D \in [0.1, 0.9]$), Sawtooth ($2(p \bmod 1) - 1$), Triangle ($2|2(p \bmod 1) - 1| - 1$), and White Noise ($\mathcal{U}(-1, 1)$).
* **Pink Noise (Voss-McCartney Algorithm)**: 3-pole IIR filter network providing a $1/f$ spectral roll-off (-3 dB/octave) for natural acoustic whooshes and wind simulation.
* **ADSR Envelope Generator**: Piecewise linear attack, exponential decay, sustain plateau, and linear release curves with millisecond precision.
* **Biquad State-Variable Filter**: Second-order IIR filters supporting Lowpass, Highpass, and Bandpass topologies with configurable cutoff frequency $f_c$ and resonance $Q$.
* **Algorithmic Freeverb Network**: Classic Schroeder reverberator implementation combining 8 parallel feedback comb filters with damping low-pass filters and 4 series allpass delay stages for diffuse spatial decay without pre-recorded impulse responses.
* **Distortion & Saturation**: Hyperbolic tangent ($\tanh(x \cdot \text{drive})$) soft-clipping for analog warmth, hard clipping, and 16-step bitcrushing for lo-fi aesthetics.
* **Master Limiter & Normalizer**: Lookahead peak scanner with soft-tanh saturation threshold preventing digital clipping at -1.0 dBFS.

### 5.2 16 Procedural Sound Effects
| Preset Key | Acoustic Architecture | Primary Use Case |
|---|---|---|
| `cartoon_boing` | Exponential sine frequency glide with vibrato LFO modulation | Comedic cartoon bounce |
| `funny_pop` | High-to-low fast logarithmic frequency snap (850Hz → 90Hz) | Bubble pops, button clicks |
| `punch_impact` | 160Hz sine sweep + filtered pink noise transient + tanh drive | Comic combat impacts |
| `falling_sound` | Exponential whistle descent with 16Hz vibrato oscillation | Cartoon falling whistles |
| `record_scratch` | Oscillating bandpass filter sweep over noise burst | Turntable DJ stops |
| `bass_drop` | 808-style pure exponential sub-sweep (140Hz → 30Hz) | Modern meme drops & EDM drops |
| `dramatic_impact` | Low sub boom (90Hz → 38Hz) layered with detuned C2 brass | Cinematic movie hits |
| `whoosh` | Symmetric bandpass filter sweep (200Hz → 3800Hz → 200Hz) | Transition swooshes |
| `glitch` | Stepped random frequency square wave with bitcrushing | Digital error & static |
| `riser` | Quadratic frequency rise (80Hz → 1800Hz) with accelerating LFO | Tension buildups |
| `suspense_effect` | Dissonant minor 2nd cluster (E3, F3, Bb3) with tremolo & reverb | Horror & suspense cues |
| `retro_coin` | Rapid 2-tone square wave arpeggio (B5 → E6) | 8-bit game pickups |
| `retro_jump` | Upward chirped square wave (150Hz → 650Hz in 140ms) | 8-bit retro jumps |
| `retro_laser` | Fast downward sawtooth chirp (950Hz → 90Hz in 130ms) | Arcade sci-fi zaps |
| `notification_chime`| Major triad harmonic bell (C6, E6, G6) with natural decay | UI chimes & alerts |
| `comedic_transition`| Descending 4-tone brass ("wah-wah-wah-waaah") with pitch sag | Fail cues & punchlines |

### 5.3 9 Procedural Music Composition Genres
* **Algorithmic Drum Machine (`SynthDrums`)**: Synthesized kick (sine sweep 140Hz → 42Hz + soft clip), snare (185Hz body tone + 1.8kHz bandpass noise burst), and closed/open hi-hats (6.5kHz–7.0kHz highpass filtered noise).
* **Music Genres**:
  1. `8bit_retro` (136 BPM): Fast 16th-note pulse arpeggios, triangle bassline, 8-bit drum beats.
  2. `electronic` (124 BPM): 4-on-the-floor kick, offbeat open hat, 16th-note saw bassline, synth pluck.
  3. `comedy` (120 BPM): Oompah bass bounce (1-5), syncopated ragtime triangle chord stabs.
  4. `suspense` (72 BPM): Heartbeat sub-kick, detuned low drone, eerie dissonant high cluster pings with Freeverb.
  5. `cinematic` (90 BPM): Taiko sub booms, marching snare rolls, driving staccato strings ostinato, sustained brass chords.
  6. `ambient` (60 BPM): Lush evolving warm pad chords (Maj7/9), generative sparse crystalline pentatonic chimes.
  7. `happy` (128 BPM): Upbeat pop drums, walking bassline, cheerful syncopated bell melody.
  8. `dramatic` (80 BPM): Heavy sub impacts, harmonic minor arpeggios, brass stabs, timpani crescendo rolls.
  9. `minimal` (88 BPM): Lo-fi subtle sub pulse, delicate Rhodes-like sine chords, micro-percussion clicks.

### 5.4 Multitrack Meme Audio Studio
* **4-Stem Timeline Mixer**: Supports dynamic layering of synthetic speech stems, procedural music tracks, and primary/secondary sound effects.
* **Volume Staging & Delay Offsets**: Configurable track-level gain ($0.0\times$ to $2.0\times$) and millisecond timeline offsets.
* **Audio Export Engine**: Seamless mixdown and mastering to broadcast WAV and MP3 (libmp3lame 256 kbps).

