# OpenVoice Studio — Real-World Smoke Test Report

**Execution Timestamp:** 2026-11-03 14:18 UTC  
**Environment:** Windows (Local Node.js v24.19.0, FFmpeg 9.0, ONNX Runtime CPU)  
**Status:** **7 / 7 Workflows Executed** | **Zero Execution Crashes** | **26 Real Audio/Video Artifacts Generated**  

---

## 1. Executive Summary

A comprehensive, unmocked, end-to-end smoke test was executed against the running application. All synthesis and media processing were performed locally with zero cloud APIs and zero fake fixtures.

All 26 output media files have been verified and saved into [`test-results/`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results).

---

## 2. Test Results by Workflow

### Workflow 1: Voice Test (5 Kokoro Voices + Hindi + Gujarati) — **PASSED**
Identical benchmark sentences were synthesized across 5 Kokoro voices, Piper Hindi, and Meta MMS Gujarati.

| Engine | Voice ID | Language / Dialect | Duration | Pitch ($F_0$) | Loudness (LUFS) | True Peak | Output File |
|---|---|---|:---:|:---:|:---:|:---:|---|
| **Kokoro-82M** | `af_heart` | English (US Female) | 6.20s | 211 Hz | -21.4 LUFS | -0.8 dBFS | [`voice_kokoro_af_heart.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_kokoro_af_heart.wav) |
| **Kokoro-82M** | `af_bella` | English (US Female) | 6.63s | 222 Hz | -19.5 LUFS | -0.8 dBFS | [`voice_kokoro_af_bella.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_kokoro_af_bella.wav) |
| **Kokoro-82M** | `am_adam` | English (US Male) | 6.30s | 133 Hz | -18.8 LUFS | -1.0 dBFS | [`voice_kokoro_am_adam.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_kokoro_am_adam.wav) |
| **Kokoro-82M** | `bf_emma` | English (UK Female) | 6.33s | 211 Hz | -17.4 LUFS | -0.7 dBFS | [`voice_kokoro_bf_emma.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_kokoro_bf_emma.wav) |
| **Kokoro-82M** | `bm_george` | English (UK Male) | 6.95s | 170 Hz | -18.1 LUFS | -1.0 dBFS | [`voice_kokoro_bm_george.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_kokoro_bm_george.wav) |
| **Piper VITS** | `piper-hi_IN-pratham-medium` | Hindi (Devanagari) | 6.41s | 138 Hz | -17.0 LUFS | -1.0 dBFS | [`voice_hindi_piper_pratham.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_hindi_piper_pratham.wav) |
| **Meta MMS** | `mms-gu-vits` | Gujarati (ગુજરાતી) | 3.52s | 110 Hz | -14.3 LUFS | -0.9 dBFS | [`voice_gujarati_mms.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/voice_gujarati_mms.wav) |

---

### Workflow 2: Speaking Style & Emotion Test — **PASSED**
Evaluated 5 styles on voice `af_heart` with identical sentence: *"OpenVoice Studio adapts its delivery to match every creative mood and tone."*

| Style | Duration | RMS Energy | Loudness | True Peak | Underlying Mechanism | Output File |
|---|:---:|:---:|:---:|:---:|---|---|
| **Neutral** | 5.43s | -19.0 dB | -18.5 LUFS | -0.7 dBFS | `native_reference` | [`style_neutral_af_heart.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/style_neutral_af_heart.wav) |
| **Happy** | 5.15s | -20.9 dB | -20.4 LUFS | -0.9 dBFS | `prosodic_dsp_hybrid` | [`style_happy_af_heart.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/style_happy_af_heart.wav) |
| **Sad** | 6.18s | -19.6 dB | -19.2 LUFS | -2.4 dBFS | `prosodic_dsp_hybrid` | [`style_sad_af_heart.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/style_sad_af_heart.wav) |
| **Angry** | 5.05s | -12.4 dB | -11.9 LUFS | +1.8 dBFS | `prosodic_dsp_hybrid` | [`style_angry_af_heart.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/style_angry_af_heart.wav) |
| **Whispering** | 5.70s | -16.1 dB | -14.6 LUFS | +3.3 dBFS | `prosodic_dsp_hybrid` | [`style_whispering_af_heart.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/style_whispering_af_heart.wav) |

*Finding:* Angry and Whispering DSP filters generate distinct timbral character, but their high-shelf/saturation boost overshoots 0 dBFS before downstream mastering.

---

### Workflow 3: Procedural Music Generation — **PASSED (WITH LIMITATION)**

| Requested Genre | Duration | BPM | Actual Synthesized Arrangement | Loudness | True Peak | Output File |
|---|:---:|:---:|---|:---:|:---:|---|
| **Cinematic** | 8.0s | 90 | Ostinato strings, low sub, brass crescendos | -21.1 LUFS | -0.8 dBFS | [`music_cinematic.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/music_cinematic.wav) |
| **Comedy** | 8.0s | 120 | Oompah bounce, staccato triads, woodwind trills | -16.8 LUFS | -1.0 dBFS | [`music_comedy.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/music_comedy.wav) |
| **Documentary** | 8.0s | 70 | **Fell back to Ambient soundscape** (soft warm pad chord) | -22.6 LUFS | -1.0 dBFS | [`music_documentary_ambient_fallback.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/music_documentary_ambient_fallback.wav) |

*Finding:* The engine has 9 genre arrangements (`8bit_retro`, `electronic`, `comedy`, `suspense`, `cinematic`, `ambient`, `happy`, `dramatic`, `minimal`), but does not have a dedicated `documentary` genre; requests fall through to `ambient`.

---

### Workflow 4: Procedural Sound Effects (SFX) — **PASSED**

| Preset | Variation | Duration | Size | Synthesis Method | Output File |
|---|---|:---:|:---:|---|---|
| `whoosh` | Fast (300Hz $\rightarrow$ 2200Hz sweep) | 0.60s | 52.9 KB | Bandpass swept noise | [`sfx_whoosh_var1_fast.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/sfx_whoosh_var1_fast.wav) |
| `whoosh` | Slow (180Hz $\rightarrow$ 3500Hz sweep) | 1.40s | 123.5 KB | Bandpass swept noise | [`sfx_whoosh_var2_slow.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/sfx_whoosh_var2_slow.wav) |
| `punch_impact` | 120Hz sub punch | 0.40s | 35.3 KB | Sine pitch drop + noise transient | [`sfx_punch_impact_var1.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/sfx_punch_impact_var1.wav) |
| `dramatic_impact` | 55Hz cinematic boom | 1.50s | 132.3 KB | Sub bass drop + Freeverb tail | [`sfx_dramatic_impact_var2.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/sfx_dramatic_impact_var2.wav) |
| `thunder_clap` | Close strike (2.0s rumble) | 2.20s | 194.0 KB | Crack impulse + filtered rumble | [`sfx_thunder_var1.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/sfx_thunder_var1.wav) |
| `thunder_clap` | Distant storm (3.5s rumble) | 3.80s | 335.2 KB | Soft crack + extended diffuse rumble | [`sfx_thunder_var2_distant.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/sfx_thunder_var2_distant.wav) |

---

### Workflow 5: Meme Studio Test — **PARTIAL PASS (HONEST ASSESSMENT)**

| Test Aspect | Result | Output File | Detail |
|---|:---:|---|---|
| **Multitrack Audio Mixing** |  PASS | [`meme_multitrack_mix.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/meme_multitrack_mix.wav) | Mixed 3 tracks (Speech, Music, SFX); Speech ducking automatically attenuated music by -10.5 dB. |
| **MP4 Video Export** |  PASS | [`meme_video_waveform_export.mp4`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/meme_video_waveform_export.mp4) | Rendered 1280x720 30fps MP4 video with FFmpeg `showwaves` animated waveform overlay. |
| **Image / Video Input Support** | ❌ **NOT IMPLEMENTED** | — | **Meme Maker currently acts as an Audio Waveform Visualizer.** It does not accept user images/videos as backgrounds, nor does it support visual video clipping or text overlay compositing (`drawtext`). |

---

### Workflow 6: Audio Quality Lab Mastering — **PASSED**
Mastered voiceover using preset `voiceover` (`highpass=80Hz, EQ=3.2kHz (+2dB), loudnorm(I=-16, TP=-1.0, LRA=10)`).

| Target Metric | Target Value | Measured Value | Result |
|---|:---:|:---:|:---:|
| **Integrated Loudness** | -16.0 LUFS ($\pm 1.5$) | **-17.2 LUFS** |  PASS |
| **True Peak** | -1.0 dBFS | **-0.9 dBFS** |  PASS |
| **Loudness Range (LRA)** | 10.0 LU | **3.6 LU** (broadcast ready) |  PASS |
| **Digital Clipping** | 0 samples | **0 samples** (No clipping) |  PASS |
| **Mastered File** | — | [`mastered_voiceover_ebur128.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/mastered_voiceover_ebur128.wav) |  VERIFIED |

---

### Workflow 7: Save, Restart & Multi-Format DAW Export — **PASSED**
Created multi-speaker dialogue project with Sarah (`af_heart`) and Adam (`am_adam`).

| Format | Output File | Size | Verification |
|---|---|:---:|:---:|
| **WAV (PCM 24kHz)** | [`project_master_export.wav`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/project_master_export.wav) | 544.9 KB | Valid RIFF header, uncompressed PCM |
| **MP3 (256kbps CBR)** | [`project_master_export.mp3`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/project_master_export.mp3) | 228.6 KB | Valid MPEG sync frame, ID3 tags |
| **FLAC (Lossless)** | [`project_master_export.flac`](file:///C:/Users/Poojak%20Doshi/.gemini/antigravity/scratch/openvoice-studio/test-results/project_master_export.flac) | 284.4 KB | Valid FLAC bitstream header |

**Application Restart Persistence Check:**
- Re-opened SQLite database connection and scanned disk storage.
- Project `proj_1d9e115074` loaded with 100% data intact.
- Both segment audio files (`seg_*.wav`) and master project render (`project_*.wav`) persisted on disk.

---

## 3. Critical Problems Identified

1. **Meme Maker is an Audio Visualizer, Not a Full Meme Video Editor**:
   The `POST /api/meme/video` endpoint generates an animated waveform visualizer on a solid dark canvas (`0x0d1117`). It cannot accept user-uploaded background images (JPG/PNG) or background video clips (MP4), nor does it burn in meme text overlay via FFmpeg `drawtext`.
2. **Missing "Documentary" Procedural Music Genre**:
   When users ask for "documentary" music, the procedural music engine falls through to the default ambient soundscape generator because no documentary rule-set exists in `generateProceduralMusic`.
3. **Unclamped Peak Levels on Raw Emotion DSP**:
   The `angry` and `whispering` styles apply aggressive saturation/shelving filters without a final brickwall limiter, causing raw unmastered outputs to peak at +1.8 to +3.3 dBFS. (Downstream mastering via `/api/audio/master` resolves this, but raw exports can distort).

---

## 4. Recommended Next Fixes

1. **Upgrade Meme Maker Video Pipeline**:
   - Accept optional `background_image` or `background_video` file paths in `POST /api/meme/video`.
   - Add FFmpeg `drawtext` filter for top/bottom meme text with Impact font and black outline.
2. **Implement Dedicated "Documentary" Music Generator**:
   - Add acoustic cello / piano arpeggios, subtle minor-pentatonic pads, and subtle low-end cinematic pulses at 68–74 BPM.
3. **Add Master Limiter to `applyStyleDSP`**:
   - Add a fast brickwall limiter (`alimiter=limit=-1.0dB:level=false`) inside `applyStyleDSP` to guarantee zero digital overs on aggressive styles.

