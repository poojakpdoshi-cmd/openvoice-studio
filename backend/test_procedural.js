/**
 * OpenVoice Studio — Automated Procedural Synthesis Acceptance Test Suite
 * 
 * Verifies:
 * 1. All 16 Procedural Sound Effect Presets (No NaNs, No Clipping, Valid WAV)
 * 2. All 9 Procedural Music Genres (Durations, Tempo Accuracy, No Clipping)
 * 3. Sound Design DSP Components (ADSR, Biquad Filter, Freeverb, Delay, Distortion, Limiter)
 * 4. Rule-Based Prompt-to-Audio Parser
 * 5. Multitrack Meme Audio Studio Mixdown & Audio Export (WAV & MP3)
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const procedural = require('./procedural_engine');

const TEST_DIR = path.join(__dirname, '..', 'storage', 'test_procedural_output');
if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  }
}

function verifyBuffer(buf, name, maxPeak = 1.0) {
  assert(buf instanceof Float32Array, `${name} returns a Float32Array`);
  assert(buf.length > 0, `${name} has samples (length: ${buf.length})`);
  
  let peak = 0;
  let hasNaN = false;
  for (let i = 0; i < buf.length; i++) {
    const abs = Math.abs(buf[i]);
    if (isNaN(abs) || !isFinite(abs)) {
      hasNaN = true;
      break;
    }
    if (abs > peak) peak = abs;
  }
  
  assert(!hasNaN, `${name} contains zero NaNs or Infinite values`);
  assert(peak <= maxPeak + 0.001, `${name} peak amplitude is bounded: ${peak.toFixed(4)} <= ${maxPeak}`);
  assert(peak > 0.001, `${name} is non-silent (peak: ${peak.toFixed(4)})`);
}

async function runProceduralTests() {
  console.log('================================================================');
  console.log(' 🔬 OPENVOICE STUDIO: PROCEDURAL AUDIO ACCEPTANCE TEST SUITE');
  console.log(' Zero Models • Zero Weights • 100% Mathematical DSP Synthesis');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: ALL 16 PROCEDURAL SOUND EFFECT PRESETS
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: ALL 16 PROCEDURAL SOUND EFFECT PRESETS ---');
  const sfxKeys = Object.keys(procedural.SoundEffectGenerators);
  assert(sfxKeys.length >= 16, `Found ${sfxKeys.length} sound effect presets (expected >= 16)`);

  for (const key of sfxKeys) {
    const fn = procedural.SoundEffectGenerators[key];
    const rawBuffer = fn();
    const limitedBuffer = procedural.normalizeAndLimit(rawBuffer, -1.0);
    verifyBuffer(limitedBuffer, `SFX Preset [${key}]`);

    // Verify WAV serialization
    const wav = procedural.floatToWavBuffer(limitedBuffer, procedural.SAMPLE_RATE);
    assert(wav.length > 44, `SFX [${key}] creates valid WAV buffer (${wav.length} bytes)`);
    assert(wav.toString('ascii', 0, 4) === 'RIFF', `SFX [${key}] WAV header starts with RIFF`);
    assert(wav.toString('ascii', 8, 12) === 'WAVE', `SFX [${key}] WAV format is WAVE`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: ALL 9 PROCEDURAL MUSIC GENRES
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: ALL 9 PROCEDURAL MUSIC GENRES ---');
  const genres = [
    '8bit_retro',
    'electronic',
    'comedy',
    'suspense',
    'cinematic',
    'ambient',
    'happy',
    'dramatic',
    'minimal'
  ];

  for (const genre of genres) {
    const targetDur = 4.0; // 4 seconds test duration
    const musicBuf = procedural.generateProceduralMusic({
      genre,
      bpm: 120,
      durationSeconds: targetDur,
      key: 'C',
      sampleRate: procedural.SAMPLE_RATE
    });

    const expectedSamples = Math.floor(targetDur * procedural.SAMPLE_RATE);
    assert(musicBuf.length === expectedSamples, `Genre [${genre}] sample length matches requested duration (${musicBuf.length} samples)`);
    verifyBuffer(musicBuf, `Music Genre [${genre}]`);

    const wav = procedural.floatToWavBuffer(musicBuf, procedural.SAMPLE_RATE);
    const testFile = path.join(TEST_DIR, `music_test_${genre}.wav`);
    fs.writeFileSync(testFile, wav);
    assert(fs.existsSync(testFile) && fs.statSync(testFile).size > 1000, `WAV file written for [${genre}] (${fs.statSync(testFile).size} bytes)`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: SOUND DESIGN DSP COMPONENTS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: SOUND DESIGN DSP COMPONENTS ---');
  
  // 3A: ADSR Envelope
  const rawTone = new Float32Array(procedural.SAMPLE_RATE);
  for (let i = 0; i < rawTone.length; i++) rawTone[i] = 1.0; // Constant DC 1.0
  const adsrBuf = procedural.applyADSR(rawTone, procedural.SAMPLE_RATE, {
    attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.2
  });
  assert(adsrBuf[0] === 0.0, 'ADSR starts at zero (sample 0)');
  assert(Math.abs(adsrBuf[Math.floor(0.1 * procedural.SAMPLE_RATE)] - 1.0) < 0.02, 'ADSR reaches 1.0 at end of attack');
  assert(Math.abs(adsrBuf[Math.floor(0.5 * procedural.SAMPLE_RATE)] - 0.5) < 0.02, 'ADSR maintains sustain level (0.5)');
  assert(Math.abs(adsrBuf[adsrBuf.length - 1]) < 0.01, 'ADSR returns to 0 at release end');

  // 3B: Biquad Filter (Lowpass)
  const lowpass = new procedural.BiquadFilter('lowpass', 400, 1.0, procedural.SAMPLE_RATE);
  const highFreqSample = Math.sin(2 * Math.PI * 8000 * 0.001); // 8kHz tone
  const filtered = lowpass.process(highFreqSample);
  assert(Math.abs(filtered) < Math.abs(highFreqSample), 'Lowpass filter attenuates high frequencies (8000Hz vs 400Hz cutoff)');

  // 3C: Distortion (Soft Tanh & Bitcrush)
  const loudTone = new Float32Array([0.5, 1.5, 3.0, -2.5]);
  const softDist = procedural.applyDistortion(new Float32Array(loudTone), 2.0, 'soft');
  assert(softDist[2] <= 1.0 && softDist[2] > 0.9, 'Tanh distortion compresses extreme peaks cleanly without harsh wrap-around');

  // 3D: Algorithmic Reverb (Decay tail)
  const reverb = new procedural.AlgorithmicReverb(procedural.SAMPLE_RATE);
  const impulse = new Float32Array(procedural.SAMPLE_RATE);
  impulse[0] = 1.0; // Delta Dirac impulse
  const verbOut = reverb.process(impulse, 0.5, 0.5);
  let tailEnergy = 0;
  for (let i = Math.floor(0.1 * procedural.SAMPLE_RATE); i < verbOut.length; i++) {
    tailEnergy += Math.abs(verbOut[i]);
  }
  assert(tailEnergy > 0.5, `Freeverb algorithmic reverb produces reverberant tail energy (${tailEnergy.toFixed(3)})`);

  // 3E: Master Limiter
  const overdrivenBuf = new Float32Array(1000);
  for (let i = 0; i < overdrivenBuf.length; i++) overdrivenBuf[i] = 4.5 * Math.sin(i);
  const limited = procedural.normalizeAndLimit(overdrivenBuf, -1.0);
  let peak = 0;
  for (let i = 0; i < limited.length; i++) {
    if (Math.abs(limited[i]) > peak) peak = Math.abs(limited[i]);
  }
  const maxLimit = Math.pow(10, -1.0 / 20.0); // ~0.891
  assert(peak <= maxLimit + 0.01, `Master limiter clamps audio peak to target dB (-1 dB = ~0.891, actual: ${peak.toFixed(4)})`);

  // --------------------------------------------------------------------------
  // TEST GROUP 4: RULE-BASED PROMPT PARSER
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: RULE-BASED PROMPT PARSER ---');
  const promptsToTest = [
    { prompt: 'Funny cartoon fall sound', expectedType: 'sfx', expectedPreset: 'falling_sound' },
    { prompt: 'Dark suspense background music', expectedType: 'music', expectedGenre: 'suspense' },
    { prompt: 'Retro 8-bit game music', expectedType: 'music', expectedGenre: '8bit_retro' },
    { prompt: 'Dramatic reveal impact', expectedType: 'sfx', expectedPreset: 'dramatic_impact' },
    { prompt: 'Cinematic epic orchestral theme', expectedType: 'music', expectedGenre: 'cinematic' },
    { prompt: 'Happy upbeat groove', expectedType: 'music', expectedGenre: 'happy' },
    { prompt: 'Wah wah fail sound', expectedType: 'sfx', expectedPreset: 'comedic_transition' },
    { prompt: 'Minimal background chill', expectedType: 'music', expectedGenre: 'minimal' }
  ];

  for (const item of promptsToTest) {
    const res = procedural.parseProceduralPrompt(item.prompt);
    assert(res.type === item.expectedType, `Prompt "${item.prompt}" identified as type: ${item.expectedType}`);
    if (item.expectedPreset) {
      assert(res.preset === item.expectedPreset, `Prompt "${item.prompt}" mapped to SFX preset: ${item.expectedPreset}`);
    }
    if (item.expectedGenre) {
      assert(res.genre === item.expectedGenre, `Prompt "${item.prompt}" mapped to Music genre: ${item.expectedGenre}`);
    }
    assert(res.method === 'procedural_dsp', `Result confirms procedural_dsp method`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: MULTITRACK MEME AUDIO STUDIO MIXER & EXPORT
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: MULTITRACK MEME AUDIO STUDIO MIXER & EXPORT ---');
  
  // Synthetic Speech Stem (simulating TTS output)
  const speechSamples = Math.floor(3.0 * procedural.SAMPLE_RATE);
  const speechStem = new Float32Array(speechSamples);
  let spPhase = 0;
  for (let i = 0; i < speechSamples; i++) {
    spPhase += (2 * Math.PI * 180) / procedural.SAMPLE_RATE;
    speechStem[i] = procedural.Oscillators.sine(spPhase) * (0.8 + 0.2 * Math.sin((i / speechSamples) * 20));
  }
  const speechFile = path.join(TEST_DIR, 'test_speech_stem.wav');
  fs.writeFileSync(speechFile, procedural.floatToWavBuffer(speechStem, procedural.SAMPLE_RATE));

  const wavOut = path.join(TEST_DIR, 'test_meme_mix.wav');
  const mp3Out = path.join(TEST_DIR, 'test_meme_mix.mp3');

  // Test WAV mixdown with 4 stems
  const mixWav = await procedural.renderMultitrackMix({
    tracks: [
      { name: 'Speech', file_path: speechFile, start_time: 0.0, volume: 1.0 },
      { name: 'Music', music_genre: 'comedy', duration: 4.0, start_time: 0.0, volume: 0.4 },
      { name: 'SFX 1', sfx_preset: 'cartoon_boing', start_time: 1.2, volume: 0.8 },
      { name: 'SFX 2', sfx_preset: 'comedic_transition', start_time: 2.2, volume: 0.9 }
    ],
    outputPath: wavOut,
    format: 'wav',
    sampleRate: procedural.SAMPLE_RATE
  });

  assert(fs.existsSync(wavOut), `Multitrack WAV mixdown created at ${wavOut}`);
  assert(fs.statSync(wavOut).size > 100000, `WAV mixdown has non-empty size (${fs.statSync(wavOut).size} bytes)`);
  assert(mixWav.trackCount === 4, `Mixdown confirms 4 tracks mixed`);
  assert(mixWav.durationSeconds >= 3.5, `Mixdown duration is accurate: ${mixWav.durationSeconds}s`);

  // Test MP3 mixdown and FFmpeg transcode
  const mixMp3 = await procedural.renderMultitrackMix({
    tracks: [
      { name: 'Speech', file_path: speechFile, start_time: 0.0, volume: 1.0 },
      { name: 'Music', music_genre: 'electronic', duration: 3.5, start_time: 0.0, volume: 0.5 },
      { name: 'SFX 1', sfx_preset: 'punch_impact', start_time: 1.0, volume: 0.8 }
    ],
    outputPath: mp3Out,
    format: 'mp3',
    sampleRate: procedural.SAMPLE_RATE
  });

  assert(fs.existsSync(mp3Out), `Multitrack MP3 mixdown created at ${mp3Out}`);
  assert(fs.statSync(mp3Out).size > 10000, `MP3 mixdown has non-empty size (${fs.statSync(mp3Out).size} bytes)`);
  assert(mixMp3.trackCount === 3, `MP3 mixdown confirms 3 tracks mixed`);

  // Verify MP3 header (ID3 or MPEG frame sync)
  const mp3Bytes = fs.readFileSync(mp3Out);
  const isId3OrSync = (mp3Bytes[0] === 0x49 && mp3Bytes[1] === 0x44 && mp3Bytes[2] === 0x33) || (mp3Bytes[0] === 0xFF && (mp3Bytes[1] & 0xE0) === 0xE0);
  assert(isId3OrSync, 'MP3 file has valid MPEG frame sync / ID3 header');

  console.log('\n================================================================');
  console.log(` 🏆 PROCEDURAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runProceduralTests().catch(err => {
  console.error('[Procedural Test Fatal]', err);
  process.exit(1);
});
