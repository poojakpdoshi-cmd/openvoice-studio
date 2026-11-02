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
  * Algorithmic generation functions must support deterministic random seeding (e.g. PRNG) to allow identical reproduction of compositions.
* **Audio Safety & Clipping Guard**:
  * All audio mixing, ducking, and synthesis routines must pass through brickwall soft-saturation limiting (-1.0 dBFS ceiling) to prevent digital harshness and inter-sample clipping.

---

## 3. Verification & Acceptance Testing Protocol

* Run targeted test suites rather than unguided manual experimentation:
  * For procedural audio & timeline mixer: `node backend/test_procedural.js`
  * For neural speech & system core: `node backend/test_suite.js`
* Maintain distinct test separation: clearly distinguish unit assertions from end-to-end integration test cases in test runners.
* Use real generated speech assets (from local ONNX inference or cached studio runs) for multitrack timeline integration tests.

---

## 4. Git & Version Control

* Keep working directory clean.
* Exclude generated test audio files and temporary buffers from git via `.gitignore`.
* Stage and commit only relevant files with precise, conventional commit messages.
