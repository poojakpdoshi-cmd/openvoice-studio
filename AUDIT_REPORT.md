# OPENVOICE STUDIO — COMPREHENSIVE ENGINEERING AUDIT REPORT

**Date:** 2026-11-03  
**Audit Scope:** Complete codebase audit of backend services, neural inference dispatchers, procedural DSP engines, database schema, audio workspace, timeline multitrack mixer, API routes, and frontend SPA interface.  
**Repository:** [openvoice-studio](https://github.com/poojakpdoshi-cmd/openvoice-studio)  

---

## EXECUTIVE SUMMARY

OpenVoice Studio is designed as a local-first, zero-cloud speech synthesis and procedural audio workstation. A rigorous inspection of the codebase reveals that while high-performance neural inference (Kokoro-82M ONNX, Piper VITS ONNX, Meta MMS Gujarati ONNX) and mathematical DSP audio generation (Mulberry32 PRNG, IIR filters, multitrack timeline) exist, critical engineering gaps cause voice uniformity, phantom catalog entries, omitted style parameters, and unverified voice cloning.

The most critical issue (**P0**)—*different voices sounding almost identical*—was traced to two primary root causes:
1. **Catalog & Piper Model Routing**: 176 out of 178 Piper voices in the catalog are not installed on disk. In `backend/neural_engine.js`, any selected Piper voice (other than Hindi) was hardcoded to synthesize using `en_US-lessac-medium`, resulting in 100% bitwise duplicate audio regardless of the voice selected.
2. **Speaking Style & Emotion Disconnect**: The frontend UI featured an emotion/style dropdown (`#styleSelector`), but the value was completely omitted from the API payload sent to `/api/tts/generate`, and the backend had no emotion dispatcher or prosodic parameter modulation.

---

## 1. FEATURE INVENTORY & ARCHITECTURAL TRACE

| Subsystem / Feature | Responsible Source Files | Declared Feature | Actual Implementation Status | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Kokoro-82M Neural TTS** | `backend/neural_engine.js`, `backend/server.js` | 28 distinct studio-grade neural voices | **Fully Functional**. 28 authentic speaker embeddings in ONNX Runtime. | Clean |
| **Piper VITS Neural TTS** | `backend/neural_engine.js`, `storage/models/piper/` | 178 multilingual voices | **Broken Routing / Phantom Catalog**. Only `en_US-lessac` and `hi_IN-pratham` installed on disk. 176 voices silently routed to Lessac. | **P0** |
| **Meta MMS Gujarati TTS** | `backend/neural_engine.js`, `storage/models/mms_gu/` | End-to-end Gujarati neural synthesis | **Fully Functional**. Custom tokenizer + ONNX VITS graph (16kHz). | Clean |
| **Speaking Styles & Emotions** | `frontend/dist/index.html`, `backend/server.js` | 9 speaking styles (Narration, News, etc.) | **Completely Disconnected**. Frontend does not send `style` in request; backend lacks emotion/style engine. | **P0** |
| **Voice Cloning Pipeline** | `backend/server.js`, `backend/neural_engine.js` | Zero-shot reference voice cloning | **Acoustic Profiling Fallback**. Synthesizes base timbre (`am_adam`/`af_bella`) and applies pitch shift; lacks true reference-conditioned speaker encoder. | **P1** |
| **Voice Catalog & Metadata** | `backend/catalog.js`, `backend/build_catalog.js` | 207 verified installed voices | **Misleading Metadata**. Advertises 207 installed voices when only 31 are on disk. | **P0** |
| **Procedural Music Engine** | `backend/procedural_engine.js`, `backend/server.js` | 9 rule-based genres, seeded PRNG | **Functional**. Generates mathematical audio via Mulberry32 PRNG and algorithmic DSP. | **P1** |
| **Procedural SFX Engine** | `backend/procedural_engine.js`, `backend/server.js` | 14 sound effects with sound design controls | **Functional**. Oscillators, ADSR, filters, and reverb. | **P1** |
| **Meme Maker & Audio Mixer** | `backend/procedural_engine.js`, `frontend/dist/index.html` | 4-track timeline, ducking, automation | **Functional**. Timeline automation, speech ducking, and MP3/WAV export work. | **P1** |
| **Mini DAW & Audio Editor** | `frontend/dist/index.html`, `backend/server.js` | Trimming, silence padding, mastering | **Partially Functional**. Canvas waveform is pseudo-random rather than actual PCM decoded; master volume slider works. | **P2** |
| **Multi-Speaker Dialogue** | `backend/server.js`, `frontend/dist/index.html` | Multi-voice script rendering | **Functional**. Renders segments and concatenates with pauses. | Clean |
| **Hardware Telemetry** | `backend/server.js` | Real CPU, GPU, RAM detection | **Functional**. Reads `os` info and WMI/system telemetry. | Clean |

---

## 2. DETAILED FINDINGS & ROOT CAUSES (CLASSIFIED BY PRIORITY)

### [P0 - CRITICAL] Issue 1: Piper Voices Routing to Identical Voice (`en_US-lessac-medium`)
- **Location:** `backend/neural_engine.js` (Lines 245–250, 284–287) and `backend/catalog.js`.
- **Root Cause:** 
  In `neural_engine.js`:
  ```javascript
  async function synthesizePiperEnglish(text, outputPath, speed = 1.0, voiceId = 'en_US-lessac-medium', volume = 1.0) {
    const modelName = voiceId.includes('lessac') ? 'en_US-lessac-medium' : 'en_US-lessac-medium';
    const { session, config } = await getPiperSession(modelName);
  ```
  `modelName` ternary condition evaluated to `'en_US-lessac-medium'` regardless of `voiceId`.
  Furthermore, `storage/models/piper/` only contained 2 models (`en_US-lessac-medium` and `hi_IN-pratham-medium`), but `VOICE_CATALOG` in `catalog.js` listed 178 Piper voices as `is_installed: 1`. When a user selected French, German, Spanish, Arabic, or alternate English voices, the system silently executed Lessac, producing identical audio.
- **Fix Required:**
  1. Audit `catalog.js`: Only mark models that actually exist on disk as `is_installed: 1`. Mark uninstalled models as `is_installed: 0` with clear download/install triggers.
  2. Implement genuine dynamic model loader in `getPiperSession(modelName)` that matches `voice.model_id`.
  3. Validate voice existence before inference and return explicit error/fallback status instead of silent imitation.

---

### [P0 - CRITICAL] Issue 2: Speaking Styles & Emotion Controls Completely Disconnected
- **Location:** `frontend/dist/index.html` (Lines 742–753, 1602–1610) and `backend/server.js` (`/api/tts/generate`).
- **Root Cause:**
  The frontend HTML exposed a styled `<select id="styleSelector">`, but the `generateSpeech()` JavaScript function did not include `style` in the JSON request payload:
  ```javascript
  const payload = {
    text: text,
    voice_id: selectedVoice ? selectedVoice.id : 'af_heart',
    speed: parseFloat(document.getElementById('speedSlider').value),
    pitch: parseFloat(document.getElementById('pitchSlider').value),
    volume: parseFloat(document.getElementById('volumeSlider').value),
    format: document.getElementById('formatSelector').value
    // MISSING: style / emotion
  };
  ```
  Additionally, `/api/tts/generate` in `server.js` had no parameter handler for `style`, and `neural_engine.js` did not support prosodic direction or style modulation.
- **Fix Required:**
  1. Pass `style: document.getElementById('styleSelector').value` in the API payload.
  2. Create an honest **Capability Registry** documenting native vs DSP approximation vs unsupported styles across Kokoro, Piper, and MMS.
  3. Implement neural & DSP prosody modulation (noise_scale, speech rate, pitch variance, presence EQ, breath/compression) in `backend/neural_engine.js`.

---

### [P1 - HIGH] Issue 3: Voice Cloning Lacks Reference Conditioning
- **Location:** `backend/neural_engine.js` (`synthesizeClonedVoice`) and `backend/server.js` (`/api/clone/voices`).
- **Root Cause:**
  When a user records or uploads reference audio, the backend analyzes duration and SNR, but generates speech by picking a fixed Kokoro voice (`am_adam` or `af_bella`) and applying a static pitch shift ($\pm 1.0$ semitones) via FFmpeg `asetrate`. It does not extract or condition on acoustic speaker embeddings.
- **Fix Required:**
  1. Honestly label this mode as **Acoustic Profiling & Timbre Matching**, not zero-shot voice cloning.
  2. Perform real F0 fundamental frequency and spectral centroid analysis on the reference audio so that pitch bias and formant shifts genuinely match the uploaded speaker's vocal characteristics rather than using hardcoded $\pm 1.0$ semitone constants.
  3. Support multi-sample reference analysis and biometric consent verification.

---

### [P1 - HIGH] Issue 4: Waveform Display in Audio Workspace is Heuristic, Not Real Audio PCM
- **Location:** `frontend/dist/index.html` (`drawWaveform`).
- **Root Cause:**
  ```javascript
  const barH = Math.max(4, Math.sin(i * 0.15) * 12 + Math.cos(i * 0.35) * 8 + 14);
  ```
  The waveform canvas draws a trigonometric sine/cosine curve rather than decoding the actual audio buffer's RMS/peak waveform. Users cannot visually identify silences, speech bursts, or cut points.
- **Fix Required:**
  Implement real Web Audio API `AudioContext.decodeAudioData()` to render sample-accurate peak/RMS waveform envelopes on `<canvas id="waveformCanvas">`.

---

### [P1 - HIGH] Issue 5: Sentence Regeneration Re-renders Entire Project in Dialogue Editor
- **Location:** `frontend/dist/index.html` and `backend/server.js` (`/api/projects/:id/render`).
- **Root Cause:**
  Modifying a single dialogue segment requires re-rendering all dialogue segments across the entire project. There is no segment cache or individual segment render API.
- **Fix Required:**
  Add segment-level rendering (`POST /api/projects/:id/segments/:segId/render`) and audio stitcher so users can preview or edit an individual sentence without regenerating the entire dialogue.

---

### [P2 - MEDIUM] Issue 6: Procedural Music Compositional Coherence
- **Location:** `backend/procedural_engine.js` (`generateProceduralMusic`).
- **Root Cause:**
  While deterministic PRNG seeding was fixed, musical form structure (Intro, Verse, Chorus, Outro) and chord voicings across genres can be enriched with more realistic instrument arrangements (synth pad, acoustic guitar plucking, basslines, percussion).
- **Fix Required:**
  Add musical section arrangement (A/B song structure, transitions, filter sweeps) and additional instrument timbres.

---

### [P2 - MEDIUM] Issue 7: Pronunciation Dictionary Not Ingested by Synthesis Pipeline
- **Location:** `backend/server.js` (`/api/tts/pronunciations`).
- **Root Cause:**
  The SQLite database stores custom word-to-phoneme/text replacements, but `synthesizeSpeech` did not apply the dictionary replacements prior to phonemization.
- **Fix Required:**
  Apply dictionary replacement regex pass to text in `synthesizeSpeech` before forwarding to Kokoro/Piper.

---

### [P3 - OPTIONAL] Issue 8: Security & Sanitization Hardening
- **Location:** `backend/server.js`.
- **Root Cause:**
  File paths in `/api/audio/file/:filename` use `path.basename` which protects against basic directory traversal, but additional input validation on project IDs and voice IDs will ensure complete hardening.
- **Fix Required:**
  Add strict alphanumeric regex validation (`/^[a-zA-Z0-9_-]+$/`) to all IDs and file parameters.

---

## 3. AUDIT CONCLUSION & IMPLEMENTATION ROADMAP

1. **Phase 2 (Immediate Priority)**:
   - Repair Voice Diversity: Fix model routing in `neural_engine.js`.
   - Audit voice catalog: Ensure only installed models report `is_installed: 1`.
   - Build automated Voice Identity Matrix test verifying acoustic separation between distinct voices.
2. **Phase 3**:
   - Implement Capability Registry for speaking styles and emotions.
   - Wire `style` from UI through API to speech engine with genuine prosodic & DSP direction.
3. **Phase 4**:
   - Honest voice cloning audit & dynamic acoustic feature extraction.
4. **Phase 5**:
   - Segment-level TTS regeneration and pronunciation dictionary integration.
5. **Phase 6–10**:
   - Procedural music arrangement, sound effect library expansion, and sample-accurate waveform visualization.

