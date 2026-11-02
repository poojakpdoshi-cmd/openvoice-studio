# OpenVoice Studio — Comprehensive AI TTS Model Comparison & Technical Evaluation

## Executive Summary

This document presents a rigorous technical investigation and comparative analysis of open-source Text-to-Speech (TTS) and voice cloning models conducted for **OpenVoice Studio**.

Our design objective is to provide professional-grade, subscription-free speech generation and voice cloning that runs completely locally without commercial API dependencies. To achieve this ethically and practically, model evaluation must balance:
1. **Acoustic Quality & Naturalness** (UTMOS / Mean Opinion Score).
2. **Computational Footprint & Hardware Accessibility** (CPU viability, GPU VRAM, Real-Time Factor).
3. **Voice Cloning Capabilities** (Zero-shot in-context vs. fine-tuning vs. tone color conversion).
4. **Multilingual Breadth** (Native phonetic systems vs. cross-lingual synthesis).
5. **Licensing & Legal Compliance** (Code license vs. weight license vs. training data provenance and commercial redistribution rights).

---

## 1. Candidate Model Matrix

The table below provides a side-by-side technical comparison of candidate speech synthesis engines:

| Dimension | Kokoro-82M | Piper TTS | XTTS v2 (Coqui) | F5-TTS | OpenVoice V2 | Fish Speech | Suno Bark |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Architecture** | StyleTTS 2 + ISTFTNet (Decoder-only) | VITS (Conditional VAE + Normalizing Flows) | GPT-2 Autoregressive + HiFi-GAN | Non-autoregressive Flow Matching DiT | Decoupled Tone Converter + MeloTTS | Dual-autoregressive Transformer + VQ-GAN | GPT-style Transformer (EnCodec) |
| **Parameter Count** | ~82 Million | ~15M - 32M | ~467 Million | ~350 Million | ~100M (Converter) | ~500M - 1B | ~1 Billion |
| **Speech Quality (MOS/UTMOS)** | **4.45 / 5.0** (Exceptional) | 3.8 - 4.1 / 5.0 (Good/Clear) | 4.3 / 5.0 (Very High) | 4.4 / 5.0 (High fidelity) | 4.2 / 5.0 (Good timbre match) | 4.3 / 5.0 (Expressive) | 3.9 / 5.0 (Prone to hallucinations) |
| **Zero-Shot Voice Cloning** | ❌ No (Embedding blending only) | ❌ No (Requires fine-tuning) | ✅ Yes (6s - 15s reference audio) | ✅ Yes (5s - 15s + transcript) | ✅ Yes (3s - 5s reference audio) | ✅ Yes (Reference audio) | ❌ No (Prompt-based heuristics) |
| **Languages Supported** | 9 (en-US, en-GB, es, fr, hi, it, ja, pt-BR, zh) | 50+ languages & dialects | 17 major languages | English, Chinese + experimental | 6 (en, es, fr, zh, ja, ko) | Chinese, English, Japanese | 13+ languages |
| **Pretrained Voices Available** | 54+ (v1.0), 100+ (v1.1-zh) | 300+ models (2,900+ speakers) | 50+ built-in speakers | Reference-driven | Reference-driven | Reference-driven | Speaker presets |
| **Model Weight Size** | **326 MB** (ONNX FP32) / 164 MB (FP16) | **50 MB - 120 MB** (ONNX) | ~1.8 GB - 2.1 GB | ~1.35 GB | ~2.5 GB (with base TTS) | ~2.5 GB - 4 GB | ~4.5 GB |
| **VRAM Required (Inference)** | **< 1 GB** (RTX 3050+) | **0 GB** (Runs on CPU) | 4 GB - 6 GB (6GB+ recommended) | 2 GB - 3 GB | 1 GB - 3 GB | 6 GB - 8 GB | 6 GB - 12 GB |
| **CPU Viability** | ✅ Excellent (1.5x - 3x real-time) | ⚡ Outstanding (5x - 10x real-time) | ❌ Impractical (10x-12x slower than real-time) | ⚠️ Slow (2x-4x slower than real-time) | ⚠️ Moderate on CPU | ❌ Very slow | ❌ Unusable |
| **Real-Time Factor (GPU)** | **0.05 - 0.15** | 0.05 - 0.10 | 0.20 - 0.40 | 0.15 - 0.30 | 0.10 - 0.20 | 0.30 - 0.60 | 1.20+ |
| **Native Streaming** | ✅ Yes (Chunk generator) | ✅ Yes (PCM chunk streaming) | ✅ Yes (`inference_stream`) | ⚠️ Experimental | ❌ Offline post-process | ⚠️ In development | ❌ No |
| **Long-Text Handling** | Requires chunking (150-500 char sweet spot) | Requires chunking (1,500 char chunks) | Max 250-400 chars per chunk (loop risk) | Chunked flow matching | Dependent on MeloTTS | Chunked tokenization | Hallucinates on long text |
| **Code License** | **Apache 2.0** | **MIT** (rhasspy) / GPL-3.0 (piper1) | **MPL-2.0** | **MIT** | **MIT** | Apache 2.0 | MIT |
| **Model Weights License** | **Apache 2.0** (Free commercial use) | **Varies per voice** (CC0, CC-BY, NC) | **CPML** (Strictly Non-Commercial) | **CC-BY-NC-4.0** (Non-Commercial) | **MIT** (Free commercial use) | CC-BY-NC-SA 4.0 | MIT |
| **Commercial Usage Permitted** | ✅ **YES** | ⚠️ **Conditional** (Audit voice license) | ❌ **NO** (Restricted; company defunct) | ❌ **NO** (Weights restricted) | ✅ **YES** | ❌ **NO** | ✅ YES |
| **Active Maintenance** | 🔥 Highly Active (v1.0 Jan 2025) | 🔄 Active (OHF fork v1.8 Sept 2026) | 🛑 Company shut down (Idiap fork) | 🔥 Highly Active (SWivid late 2024+) | 🔄 Maintained by MyShell | 🔄 Active | 🛑 Stagnant |
| **GitHub Stars** | ~9.7K+ | ~11K (Rhasspy) / 6K (OHF) | ~46.2K (Archived) | ~15.2K | ~37K | ~18K | ~34K |

---

## 2. In-Depth Technical Analysis per Candidate

### 2.1 Kokoro-82M (Hexgrad)
* **Architecture:** Groundbreaking efficiency achieved by adapting StyleTTS 2 with an Inverse Short-Time Fourier Transform Network (ISTFTNet) neural vocoder. Unlike heavy diffusion systems, ISTFTNet generates magnitude and phase spectra in the frequency domain, dramatically speeding up synthesis.
* **Acoustic Fidelity:** Achieves UTMOS of ~4.45/5.0, rivaling ElevenLabs and OpenAI TTS while using only 82 million parameters. Speech includes natural micro-intonations, subtle breathing pauses, and absence of vocoder buzz.
* **Licensing:** Both code and weights are released under **Apache 2.0**. Hexgrad specifically trained the model using public domain speech, permissively licensed corpora (SIWIS CC-BY 4.0, Koniwa CC-BY 3.0), and commercial distillation outputs, deliberately safeguarding downstream users against copyright claims.
* **Limitations:** Lacks an audio encoder, meaning zero-shot cloning from arbitrary audio is not supported directly in the model. Voice blending (vector linear combination) is supported.

### 2.2 Piper TTS (Rhasspy / Open Home Foundation)
* **Architecture:** Based on VITS (Variational Inference with adversarial learning for end-to-end Text-to-Speech). Directly predicts raw waveforms from text via monotonic alignment and normalizing flows without requiring a standalone vocoder step.
* **Efficiency:** Unrivaled CPU performance. Consumes less than 300 MB RAM and runs 5x–10x faster than real-time on modest Intel/AMD CPUs, and runs smoothly on Raspberry Pi 4/5.
* **Voice Diversity:** The largest open-source catalog of pre-trained voices: over 300 voice models covering 50+ languages and dialects (including Gujarati, Hindi, Arabic, Catalan, etc.) with 2,900+ speakers.
* **Licensing Nuance:** While the engine is MIT/GPL, individual voice models carry disparate licenses depending on the original recording corpus. Commercial platforms must verify the license tag (`CC0`, `CC-BY-4.0`, vs. `research-only`) of each voice model before inclusion.

### 2.3 XTTS v2 (Coqui AI)
* **Architecture:** 467M parameter autoregressive transformer (GPT-2 style) combined with a Perceiver speaker encoder and HiFi-GAN vocoder.
* **Cloning Capability:** Industry standard for zero-shot cloning from a 6-second reference audio clip. Preserves vocal timbre across 17 languages.
* **Critical Legal Limitation:** Coqui AI officially shut down in December 2023. XTTS v2 weights are released under the Coqui Public Model License (CPML), which explicitly forbids commercial monetization of both the model and its generated audio outputs. Since the company is defunct, commercial licensing agreements cannot be purchased. OpenVoice Studio cannot mandate XTTS as a primary commercial-friendly engine.

### 2.4 F5-TTS (SWivid)
* **Architecture:** State-of-the-art non-autoregressive system built on Flow Matching with Diffusion Transformers (DiT) and ConvNeXt V2 text conditioning.
* **Cloning Capability:** Exceptional zero-shot voice cloning given 5–15 seconds of audio and its reference transcript. Avoids autoregressive repetition loops.
* **Licensing Limitation:** Pre-trained weights are restricted to non-commercial use under CC-BY-NC-4.0.

### 2.5 OpenVoice V2 (MyShell / MIT)
* **Architecture:** Decoupled two-tier architecture separating the base speech generation (MeloTTS) from timbre modeling (Tone Color Converter with normalizing flows and speaker verification embeddings).
* **Licensing:** Fully permissive **MIT License** for both code and weights.
* **Cloning Capability:** Can clone any reference voice from 3–5 seconds of audio. Because timbre is decoupled from style, it allows cross-lingual synthesis without accent bleed.

---

## 3. OpenVoice Studio Multi-Engine Architecture Decision

To deliver on our commitment of **100% free, local, professional-quality generation without paid subscriptions**, OpenVoice Studio implements a **Multi-Tier Hybrid Engine**:

```
                       ┌─────────────────────────────────────────┐
                       │           OpenVoice Studio              │
                       │        Unified TTS Orchestrator         │
                       └───────────────────┬─────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   Tier 1 Engine  │             │   Tier 2 Engine  │             │   Tier 3 Engine  │
│    Kokoro-82M    │             │    Piper TTS     │             │ Tone Clone Engine│
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│• 4.45/5.0 MOS    │             │• 100+ voices     │             │• Instant cloning │
│• 54+ voices      │             │• 50+ languages   │             │• 3-10s reference │
│• Apache 2.0      │             │• Ultralight CPU  │             │• MIT licensed    │
│• En, Es, Fr, Hi, │             │• Gu, Hi, Ar, etc.│             │• Tone color shift│
│  Ja, Pt, Zh      │             │• MIT/CC licensed │             │• Private local   │
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

1. **Primary Production TTS (Kokoro-82M):**
   * Default engine for high-fidelity English, Spanish, French, Hindi, Japanese, Portuguese, Italian, and Chinese narration.
   * Apache 2.0 license guarantees freedom for personal and commercial creators.
   * Runs natively on CPU or GPU with low latency.

2. **Multilingual & High-Efficiency Catalog (Piper TTS):**
   * Supplies the breadth of our 100+ voice library.
   * Covers regional Indian languages (including Gujarati, Hindi), Arabic, European dialects, and Asian tongues.
   * Runs at up to 10x real-time on CPU.

3. **Personal Voice Cloning Studio (Decoupled Tone Converter / Acoustic Feature Engine):**
   * Extracts vocal spectral signatures and F0 pitch envelopes from user recordings.
   * Zero-shot voice profile extraction with strict ownership validation and safety watermarking.

4. **Zero-Dependency Native Fallback (DSP Speech Synthesizer + FFmpeg):**
   * Built-in synthesis pipeline ensuring immediate generation on any machine without pre-downloading multi-gigabyte models.

---

## 4. Hardware Sizing & Minimum System Requirements

| Tier | Target Machine | RAM | VRAM | Real-Time Factor | Recommended Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Low Resource** | Quad-core CPU, No GPU (Laptops, Mini PCs) | 4 GB | 0 GB | 0.15 - 0.40 (Faster than RT) | Piper TTS / Flite DSP |
| **Standard** | 8-core CPU or Entry GPU (GTX 1650, RTX 3050) | 8 GB | 2 GB - 4 GB | 0.08 - 0.20 (5x-12x RT) | Kokoro-82M (ONNX/PyTorch) |
| **Pro Studio** | Modern GPU (RTX 3060, 4060, Apple M-Series) | 16 GB | 6 GB - 8 GB | 0.03 - 0.10 (10x-30x RT) | Kokoro + Voice Cloning Pipeline |

OpenVoice Studio dynamically inspects available hardware upon launch and recommends optimal engine settings automatically.

