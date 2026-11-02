# AGENTS.md — Development & Operational Guidelines for AI Assistants

This repository (`openvoice-studio`) contains production-grade neural speech synthesis, voice modeling, and procedural audio engines. All autonomous agents, coding assistants, and engineers working in this repository must adhere to the following rules:

---

## 1. Targeted File Inspection Rules (Strict)

* **No Unsolicited Full-Project Audits**: Never perform broad, repository-wide file scans, recursive directory inventories, or full-project feature audits unless the user explicitly commands a full audit.
* **Inspect Only Task-Relevant Files**: Confine reads and edits strictly to the subsystems and files mentioned in or directly required by the current user request (e.g., if working on procedural audio, touch only `backend/procedural_engine.js`, `backend/test_procedural.js`, procedural server endpoints in `backend/server.js`, and the procedural/meme sections in `frontend/dist/index.html`).
* **Preserve Unrelated Subsystems**: Never modify, rewrite, or disturb working neural pipelines (`backend/neural_engine.js`), voice catalogs (`backend/catalog.js`), or model weight caches in `storage/models/`.

---

## 2. Audio & Synthesis Engineering Standards

* **Honest Attribution & Labeling**:
  * Clearly label neural speech as **Neural AI Speech Synthesis** (Kokoro, Piper, Meta MMS).
  * Clearly label algorithmic music, sound effects, and prompt parsing as **Rule-Based Procedural DSP Generation**, not neural AI.
  * Never claim "studio-grade" or "professional broadcast" quality without verified listening tests or objective DSP metrics (SNR, frequency response, dynamic range).
* **Zero Model Violations in Procedural DSP**:
  * Procedural audio must never download weights, call cloud APIs, or load neural models.
  * All waveforms must originate from mathematical oscillators, noise generators, IIR/FIR filters, and DSP math.
* **Deterministic Reproducibility**:
  * Algorithmic generation functions must support deterministic random seeding (e.g. Mulberry32 PRNG) to allow identical reproduction of compositions.
  * Every random path in procedural music (SynthDrums noise, Karplus-Strong string initialization, micro-percussion, chord voicings, and motif variations) must pass through the seeded PRNG.
  * Zero uncontrolled `Math.random()` calls are permitted within seeded generation paths. Same settings + same seed must yield 100% bitwise-identical audio samples across all genres.
* **Multitrack Stem Mixer & Ducking Precedence**:
  * Explicit track configuration (`is_ducked: false` or `is_ducked: true`) must strictly override any heuristic type-based classification. When a user disables ducking on a music track, it must never be attenuated during speech.
  * Timeline supports keyframed volume automation (`volume_automation: [{ time, volume }]`), piecewise linear gain interpolation, clip trimming, and cosine fades.
* **Audio Safety & Clipping Guard**:
  * All audio mixing, ducking, and synthesis routines must pass through brickwall soft-saturation limiting (-1.0 dBFS ceiling) to prevent digital harshness and inter-sample clipping.

---

## 3. Verification & Acceptance Testing Protocol

* Run targeted test suites rather than unguided manual experimentation:
  * For procedural audio & timeline mixer: `node backend/test_procedural.js`
  * For neural speech & system core: `node backend/test_suite.js`
* Maintain distinct test separation: clearly distinguish unit assertions from end-to-end integration test cases in test runners.
* **Portable Test Fixtures**:
  * Never rely on gitignored audio assets to pass integration tests.
  * Test suites must dynamically generate required temporary speech fixtures through local neural inference when models are present.
  * If neural models are uninstalled, report tests honestly as skipped (`skipE2E`) rather than falsely passing them, while generating synthetic speech fixtures so procedural mixer tests run completely independently on fresh clones.

---

## 4. Git & Version Control

* Keep working directory clean.
* Exclude generated test audio files and temporary buffers from git via `.gitignore`.
* Stage and commit only relevant files with precise, conventional commit messages.

