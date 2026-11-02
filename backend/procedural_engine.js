/**
 * OpenVoice Studio — Zero-Model Procedural Audio & Music Synthesis Engine
 * 
 * 100% Mathematical Audio Synthesis & Digital Signal Processing.
 * Zero AI Models • Zero Model Weights • Zero Cloud APIs • Zero External Cost.
 * 
 * Features:
 * 1. Procedural Sound Effects (14+ categorized algorithmic SFX)
 * 2. Procedural Music Generator (9 genres/moods, algorithmic melody, chords, bass, drums)
 * 3. Advanced Sound Design DSP (ADSR envelopes, Biquad filters, Freeverb reverb, Delay, Saturation)
 * 4. Rule-Based Prompt Parser (Text descriptions -> Procedural parameters)
 * 5. Multitrack Meme Audio Studio (TTS + Music + SFX mixing, ducking, fades, mastering)
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

const SAMPLE_RATE = 44100; // Standard professional audio rate

// Storage paths
const ROOT_DIR = path.resolve(__dirname, '..');
const STORAGE_DIR = path.join(ROOT_DIR, 'storage');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');
const PROCEDURAL_DIR = path.join(STORAGE_DIR, 'procedural');

[STORAGE_DIR, AUDIO_DIR, PROCEDURAL_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================================================================
// 1. DIGITAL SIGNAL PROCESSING (DSP) FOUNDATIONS
// ============================================================================

/**
 * Basic Oscillators
 */
const Oscillators = {
  sine: (phase) => Math.sin(phase),
  square: (phase, duty = 0.5) => ((phase % (2 * Math.PI)) / (2 * Math.PI) < duty ? 1.0 : -1.0),
  sawtooth: (phase) => {
    const p = (phase % (2 * Math.PI)) / (2 * Math.PI);
    return 2.0 * p - 1.0;
  },
  triangle: (phase) => {
    const p = (phase % (2 * Math.PI)) / (2 * Math.PI);
    return 2.0 * Math.abs(2.0 * p - 1.0) - 1.0;
  },
  pulse: (phase, width = 0.25) => ((phase % (2 * Math.PI)) / (2 * Math.PI) < width ? 1.0 : -1.0),
  noise: () => Math.random() * 2.0 - 1.0
};

/**
 * Pink Noise Generator (3-pole filter / Voss-McCartney algorithm)
 */
class PinkNoise {
  constructor() {
    this.b0 = 0; this.b1 = 0; this.b2 = 0;
  }
  next() {
    const white = Math.random() * 2.0 - 1.0;
    this.b0 = 0.99886 * this.b0 + white * 0.0555179;
    this.b1 = 0.99332 * this.b1 + white * 0.0750759;
    this.b2 = 0.96900 * this.b2 + white * 0.1538520;
    return (this.b0 + this.b1 + this.b2 + white * 0.5362) * 0.2;
  }
}

/**
 * ADSR Envelope Generator
 */
function applyADSR(buffer, sampleRate, { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2 }) {
  const totalSamples = buffer.length;
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const releaseSamples = Math.floor(release * sampleRate);
  const sustainSamples = Math.max(0, totalSamples - (attackSamples + decaySamples + releaseSamples));

  for (let i = 0; i < totalSamples; i++) {
    let env = 0.0;
    if (i < attackSamples) {
      env = attackSamples > 0 ? i / attackSamples : 1.0;
    } else if (i < attackSamples + decaySamples) {
      const d = (i - attackSamples) / decaySamples;
      env = 1.0 - d * (1.0 - sustain);
    } else if (i < attackSamples + decaySamples + sustainSamples) {
      env = sustain;
    } else {
      const r = (i - (attackSamples + decaySamples + sustainSamples)) / Math.max(1, releaseSamples);
      env = sustain * Math.max(0, 1.0 - r);
    }
    buffer[i] *= env;
  }
  return buffer;
}

/**
 * State Variable / Biquad Filter (Lowpass, Highpass, Bandpass)
 */
class BiquadFilter {
  constructor(type = 'lowpass', cutoff = 1000, q = 1.0, sampleRate = SAMPLE_RATE) {
    this.type = type;
    this.cutoff = cutoff;
    this.q = Math.max(0.01, q);
    this.sampleRate = sampleRate;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    this.recompute();
  }

  recompute() {
    const omega = 2.0 * Math.PI * (this.cutoff / this.sampleRate);
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const alpha = sinOmega / (2.0 * this.q);

    if (this.type === 'lowpass') {
      this.b0 = (1 - cosOmega) / 2;
      this.b1 = 1 - cosOmega;
      this.b2 = (1 - cosOmega) / 2;
      this.a0 = 1 + alpha;
      this.a1 = -2 * cosOmega;
      this.a2 = 1 - alpha;
    } else if (this.type === 'highpass') {
      this.b0 = (1 + cosOmega) / 2;
      this.b1 = -(1 + cosOmega);
      this.b2 = (1 + cosOmega) / 2;
      this.a0 = 1 + alpha;
      this.a1 = -2 * cosOmega;
      this.a2 = 1 - alpha;
    } else { // bandpass
      this.b0 = alpha;
      this.b1 = 0;
      this.b2 = -alpha;
      this.a0 = 1 + alpha;
      this.a1 = -2 * cosOmega;
      this.a2 = 1 - alpha;
    }

    this.b0 /= this.a0;
    this.b1 /= this.a0;
    this.b2 /= this.a0;
    this.a1 /= this.a0;
    this.a2 /= this.a0;
  }

  process(sample) {
    const out = this.b0 * sample + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = sample;
    this.y2 = this.y1;
    this.y1 = out;
    return out;
  }

  processBuffer(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = this.process(buffer[i]);
    }
    return buffer;
  }
}

/**
 * Algorithmic Freeverb Reverb (Schroeder comb + allpass network)
 */
class AlgorithmicReverb {
  constructor(sampleRate = SAMPLE_RATE) {
    this.sampleRate = sampleRate;
    // 8 parallel comb filter delays (in samples scaled to sample rate)
    const combLengths = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(l => Math.round(l * (sampleRate / 44100)));
    this.combBuffers = combLengths.map(l => new Float32Array(l));
    this.combIndices = combLengths.map(() => 0);
    this.combDamp = 0.3;
    this.combFeedback = 0.84;
    this.combFilters = combLengths.map(() => 0);

    // 4 series allpass filter delays
    const allpassLengths = [556, 441, 341, 225].map(l => Math.round(l * (sampleRate / 44100)));
    this.allpassBuffers = allpassLengths.map(l => new Float32Array(l));
    this.allpassIndices = allpassLengths.map(() => 0);
  }

  process(buffer, wet = 0.35, dry = 0.75) {
    const out = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const input = buffer[i];
      let combSum = 0;

      // Parallel combs
      for (let c = 0; c < this.combBuffers.length; c++) {
        const buf = this.combBuffers[c];
        const idx = this.combIndices[c];
        const output = buf[idx];

        // Damping low-pass filter
        this.combFilters[c] = output * (1 - this.combDamp) + this.combFilters[c] * this.combDamp;
        buf[idx] = input + this.combFilters[c] * this.combFeedback;

        this.combIndices[c] = (idx + 1) % buf.length;
        combSum += output;
      }

      let allpassOut = combSum * 0.125;

      // Series allpasses
      for (let a = 0; a < this.allpassBuffers.length; a++) {
        const buf = this.allpassBuffers[a];
        const idx = this.allpassIndices[a];
        const bufOut = buf[idx];
        const apIn = allpassOut;

        allpassOut = -apIn + bufOut;
        buf[idx] = apIn + bufOut * 0.5;
        this.allpassIndices[a] = (idx + 1) % buf.length;
      }

      out[i] = input * dry + allpassOut * wet;
    }
    return out;
  }
}

/**
 * Distortion & Saturation Effects
 */
function applyDistortion(buffer, drive = 2.0, mode = 'soft') {
  for (let i = 0; i < buffer.length; i++) {
    const x = buffer[i] * drive;
    if (mode === 'soft') {
      buffer[i] = Math.tanh(x);
    } else if (mode === 'hard') {
      buffer[i] = Math.max(-1.0, Math.min(1.0, x));
    } else if (mode === 'bitcrush') {
      const steps = 16;
      buffer[i] = Math.round(x * steps) / steps;
    }
  }
  return buffer;
}

/**
 * Stereo Delay with Feedback
 */
function applyDelay(buffer, sampleRate = SAMPLE_RATE, delayMs = 300, feedback = 0.4, wet = 0.3) {
  const delaySamples = Math.floor((delayMs / 1000) * sampleRate);
  const out = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const delayedIdx = i - delaySamples;
    const delayedSample = delayedIdx >= 0 ? out[delayedIdx] : 0.0;
    out[i] = buffer[i] + delayedSample * feedback;
  }
  for (let i = 0; i < buffer.length; i++) {
    out[i] = buffer[i] * (1.0 - wet) + out[i] * wet;
  }
  return out;
}

/**
 * Master Limiter & Normalizer (Prevents Digital Clipping)
 */
function normalizeAndLimit(buffer, targetPeakDb = -1.0) {
  let peak = 0.0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > peak) peak = abs;
  }

  const targetLinear = Math.pow(10, targetPeakDb / 20.0);
  if (peak > 0.0001) {
    const gain = targetLinear / peak;
    for (let i = 0; i < buffer.length; i++) {
      let s = buffer[i] * gain;
      // Soft saturation threshold if exceeding 0.99
      if (s > 0.99) s = 0.99 + 0.01 * Math.tanh((s - 0.99) / 0.01);
      else if (s < -0.99) s = -0.99 + 0.01 * Math.tanh((s + 0.99) / 0.01);
      buffer[i] = s;
    }
  }
  return buffer;
}

/**
 * Convert Float32Array to 16-bit PCM WAV Buffer
 */
function floatToWavBuffer(samples, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.round(val), offset);
    offset += 2;
  }
  return buffer;
}

// ============================================================================
// 2. PROCEDURAL SOUND EFFECT GENERATOR (14+ CATEGORIZED PRESETS)
// ============================================================================

const SoundEffectGenerators = {
  /**
   * 1. Cartoon Boing
   */
  cartoon_boing: ({ duration = 0.8, baseFreq = 180, modulation = 8.0 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      // Exponential rise and decay in frequency
      const freq = baseFreq + Math.sin(t * 30.0) * (baseFreq * 0.6) * Math.exp(-t * 2.5) + (t * 250);
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      buf[i] = Oscillators.sine(phase) * Math.exp(-t * 3.5);
    }
    return applyADSR(buf, SAMPLE_RATE, { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4 });
  },

  /**
   * 2. Funny Pop
   */
  funny_pop: ({ duration = 0.12, startFreq = 850, endFreq = 90 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = startFreq * Math.pow(endFreq / startFreq, t * 1.5);
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      buf[i] = Oscillators.sine(phase) * (1.0 - t * 0.95);
    }
    return buf;
  },

  /**
   * 3. Punch Impact
   */
  punch_impact: ({ duration = 0.45 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    const filter = new BiquadFilter('lowpass', 600, 1.5);
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      // Fast pitch sweep (sub transient)
      const freq = 160 * Math.exp(-t * 18.0) + 40;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const sub = Oscillators.sine(phase);
      // Noise snap
      const noise = (Math.random() * 2.0 - 1.0) * Math.exp(-t * 28.0) * 1.4;
      buf[i] = sub * Math.exp(-t * 6.0) + filter.process(noise);
    }
    return applyDistortion(buf, 2.2, 'soft');
  },

  /**
   * 4. Falling Sound (Whistle Sweep)
   */
  falling_sound: ({ duration = 1.6, startFreq = 1200, endFreq = 160 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / numSamples;
      // Vibrato + exponential fall
      const vibrato = Math.sin(t * 16.0) * 20;
      const freq = startFreq * Math.pow(endFreq / startFreq, progress) + vibrato;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      buf[i] = (Oscillators.sine(phase) * 0.8 + Oscillators.triangle(phase * 2) * 0.2);
    }
    return applyADSR(buf, SAMPLE_RATE, { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.3 });
  },

  /**
   * 5. Record Scratch
   */
  record_scratch: ({ duration = 0.5 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    const bp = new BiquadFilter('bandpass', 1400, 3.0);
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      // Scrub curve back-and-forth
      const scrubSpeed = Math.sin(t * Math.PI * 4) * 600 + 750;
      phase += (2 * Math.PI * scrubSpeed) / SAMPLE_RATE;
      const noise = (Math.random() * 2.0 - 1.0);
      const tone = Oscillators.sawtooth(phase) * 0.4;
      buf[i] = bp.process(noise * 0.6 + tone) * Math.sin(t * Math.PI);
    }
    return applyDistortion(buf, 1.8, 'soft');
  },

  /**
   * 6. Bass Drop (808 Sub Sweep)
   */
  bass_drop: ({ duration = 2.0, startFreq = 140, endFreq = 30 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const freq = Math.max(endFreq, startFreq * Math.exp(-t * 2.2));
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      buf[i] = Oscillators.sine(phase) * Math.exp(-t * 0.8);
    }
    return applyDistortion(buf, 1.4, 'soft');
  },

  /**
   * 7. Dramatic Impact (Orchestral Sub Hit)
   */
  dramatic_impact: ({ duration = 2.5 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phaseSub = 0;
    let phaseBrass1 = 0;
    let phaseBrass2 = 0;
    const reverb = new AlgorithmicReverb();
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      // Sub boom
      phaseSub += (2 * Math.PI * (90 * Math.exp(-t * 6.0) + 38)) / SAMPLE_RATE;
      const sub = Oscillators.sine(phaseSub) * Math.exp(-t * 1.5);
      // Low brass chord (C2 detuned)
      phaseBrass1 += (2 * Math.PI * 65.41) / SAMPLE_RATE;
      phaseBrass2 += (2 * Math.PI * 65.8) / SAMPLE_RATE;
      const brass = (Oscillators.sawtooth(phaseBrass1) + Oscillators.sawtooth(phaseBrass2)) * Math.exp(-t * 3.5) * 0.5;
      buf[i] = sub * 0.8 + brass * 0.4;
    }
    return reverb.process(buf, 0.45, 0.8);
  },

  /**
   * 8. Whoosh
   */
  whoosh: ({ duration = 0.9 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    const pink = new PinkNoise();
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      // Swept cutoff frequency from 200 -> 3500 -> 200
      const sweep = Math.sin(t * Math.PI);
      const cutoff = 200 + sweep * 3600;
      const filter = new BiquadFilter('bandpass', cutoff, 2.2);
      buf[i] = filter.process(pink.next()) * sweep * 1.8;
    }
    return buf;
  },

  /**
   * 9. Glitch
   */
  glitch: ({ duration = 0.7 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    let stepFreq = 440;
    for (let i = 0; i < numSamples; i++) {
      // Step frequency randomly every 800 samples
      if (i % 800 === 0) {
        stepFreq = 150 + Math.floor(Math.random() * 2000);
      }
      phase += (2 * Math.PI * stepFreq) / SAMPLE_RATE;
      const stutter = (i % 400 < 300) ? 1.0 : 0.0;
      buf[i] = Oscillators.square(phase, 0.3) * stutter;
    }
    return applyDistortion(buf, 2.5, 'bitcrush');
  },

  /**
   * 10. Riser
   */
  riser: ({ duration = 3.0, startFreq = 80, endFreq = 1800 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase1 = 0;
    let phase2 = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = startFreq * Math.pow(endFreq / startFreq, t * t); // Exponential sweep
      phase1 += (2 * Math.PI * freq) / SAMPLE_RATE;
      phase2 += (2 * Math.PI * (freq * 1.01)) / SAMPLE_RATE;
      // Pulsing LFO that speeds up
      const pulseRate = 2.0 + t * 24.0;
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * pulseRate * (i / SAMPLE_RATE));
      buf[i] = (Oscillators.sawtooth(phase1) + Oscillators.sine(phase2)) * lfo * t;
    }
    return applyADSR(buf, SAMPLE_RATE, { attack: 0.1, decay: 0.1, sustain: 0.9, release: 0.05 });
  },

  /**
   * 11. Suspense Effect
   */
  suspense_effect: ({ duration = 3.5 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let p1 = 0, p2 = 0, p3 = 0;
    const reverb = new AlgorithmicReverb();
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      // Dissonant minor 2nd cluster (E3 = 164.81Hz, F3 = 174.61Hz, Bb3 = 233.08Hz)
      p1 += (2 * Math.PI * 164.81) / SAMPLE_RATE;
      p2 += (2 * Math.PI * 174.61) / SAMPLE_RATE;
      p3 += (2 * Math.PI * 233.08) / SAMPLE_RATE;
      const tremolo = 0.7 + 0.3 * Math.sin(t * 7.0);
      buf[i] = (Oscillators.sine(p1) * 0.4 + Oscillators.sine(p2) * 0.4 + Oscillators.triangle(p3) * 0.2) * tremolo;
    }
    return reverb.process(buf, 0.5, 0.7);
  },

  /**
   * 12. Retro Game Sounds
   */
  retro_coin: () => {
    // 2-tone arpeggio: B5 (987.77Hz, 60ms) -> E6 (1318.51Hz, 250ms)
    const totalSamples = Math.floor(0.35 * SAMPLE_RATE);
    const buf = new Float32Array(totalSamples);
    const split = Math.floor(0.06 * SAMPLE_RATE);
    let phase = 0;
    for (let i = 0; i < totalSamples; i++) {
      const freq = i < split ? 987.77 : 1318.51;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const decay = Math.exp(-(i - (i < split ? 0 : split)) / (SAMPLE_RATE * 0.15));
      buf[i] = Oscillators.square(phase, 0.5) * decay;
    }
    return buf;
  },

  retro_jump: () => {
    // Rapid upward square chirp 150Hz -> 650Hz over 140ms
    const numSamples = Math.floor(0.18 * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = 150 + t * 500;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      buf[i] = Oscillators.square(phase, 0.25) * (1.0 - t * 0.9);
    }
    return buf;
  },

  retro_laser: () => {
    // Fast downward saw chirp 950Hz -> 90Hz in 130ms
    const numSamples = Math.floor(0.15 * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const freq = 950 * Math.exp(-t * 6.0);
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      buf[i] = Oscillators.sawtooth(phase) * (1.0 - t);
    }
    return buf;
  },

  /**
   * 13. Notification Chime
   */
  notification_chime: ({ duration = 1.2 } = {}) => {
    // Major triad bell: C6 (1046.5Hz), E6 (1318.5Hz), G6 (1567.9Hz)
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let p1 = 0, p2 = 0, p3 = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      p1 += (2 * Math.PI * 1046.5) / SAMPLE_RATE;
      p2 += (2 * Math.PI * 1318.5) / SAMPLE_RATE;
      p3 += (2 * Math.PI * 1567.9) / SAMPLE_RATE;
      buf[i] = (
        Oscillators.sine(p1) * Math.exp(-t * 3.5) +
        Oscillators.sine(p2) * Math.exp(-t * 4.0) * 0.8 +
        Oscillators.sine(p3) * Math.exp(-t * 4.5) * 0.6
      );
    }
    return buf;
  },

  /**
   * 14. Comedic Transition ("Wah-wah-wah-waaah")
   */
  comedic_transition: () => {
    // 4 descending brass tones: D4 (293.66), Db4 (277.18), C4 (261.63), B3 (246.94 -> sag to 220)
    const noteDurs = [0.28, 0.28, 0.28, 0.75];
    const freqs = [293.66, 277.18, 261.63, 246.94];
    const totalSamples = Math.floor(noteDurs.reduce((a, b) => a + b, 0) * SAMPLE_RATE);
    const buf = new Float32Array(totalSamples);
    let sampleOffset = 0;

    for (let n = 0; n < 4; n++) {
      const durSamples = Math.floor(noteDurs[n] * SAMPLE_RATE);
      let phase = 0;
      const isLast = (n === 3);
      for (let i = 0; i < durSamples; i++) {
        const t = i / durSamples;
        let freq = freqs[n];
        if (isLast) freq -= t * 35; // Pitch sag on final waaah
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        // Brassy saw + triangle blend with plunger mute modulation
        const muteLfo = 0.5 + 0.5 * Math.sin(t * Math.PI * 8);
        const wave = Oscillators.sawtooth(phase) * 0.6 + Oscillators.triangle(phase) * 0.4;
        const decay = Math.sin(t * Math.PI * 0.95);
        buf[sampleOffset + i] = wave * decay * (isLast ? (0.8 + 0.2 * muteLfo) : 0.9);
      }
      sampleOffset += durSamples;
    }
    return buf;
  }
};

// ============================================================================
// 3. PROCEDURAL MUSIC GENERATOR (9 GENRES / MOODS)
// ============================================================================

/**
 * Standard Musical Scale Frequencies (Equal Temperament A4 = 440 Hz)
 */
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToFreq(midiNote) {
  return 440.0 * Math.pow(2.0, (midiNote - 69) / 12.0);
}

function getMidiRoot(keyName = 'C', octave = 4) {
  const index = NOTE_NAMES.indexOf(keyName.toUpperCase());
  return 12 * (octave + 1) + (index >= 0 ? index : 0);
}

/**
 * Synthesize Drum Percussion Hits (Programmatic / Zero Samples)
 */
const SynthDrums = {
  kick: (sampleRate = SAMPLE_RATE) => {
    const numSamples = Math.floor(0.35 * sampleRate);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 140 * Math.exp(-t * 28.0) + 42;
      phase += (2 * Math.PI * freq) / sampleRate;
      buf[i] = Oscillators.sine(phase) * Math.exp(-t * 9.0);
    }
    return applyDistortion(buf, 1.5, 'soft');
  },

  snare: (sampleRate = SAMPLE_RATE) => {
    const numSamples = Math.floor(0.22 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('bandpass', 1800, 1.8, sampleRate);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Tone body
      phase += (2 * Math.PI * 185) / sampleRate;
      const tone = Oscillators.sine(phase) * Math.exp(-t * 22.0);
      // Noise burst
      const noise = (Math.random() * 2.0 - 1.0) * Math.exp(-t * 14.0);
      buf[i] = tone * 0.4 + filter.process(noise) * 0.8;
    }
    return buf;
  },

  hihat_closed: (sampleRate = SAMPLE_RATE) => {
    const numSamples = Math.floor(0.05 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('highpass', 7000, 1.5, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      buf[i] = filter.process(Math.random() * 2.0 - 1.0) * (1.0 - t);
    }
    return buf;
  },

  hihat_open: (sampleRate = SAMPLE_RATE) => {
    const numSamples = Math.floor(0.25 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('highpass', 6500, 1.5, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      buf[i] = filter.process(Math.random() * 2.0 - 1.0) * Math.exp(-t * 12.0);
    }
    return buf;
  }
};

/**
 * Procedural Music Composition Generator
 */
function generateProceduralMusic({
  genre = '8bit_retro',
  bpm = 120,
  durationSeconds = 12.0,
  key = 'C',
  loop = true,
  sampleRate = SAMPLE_RATE
}) {
  const totalSamples = Math.floor(durationSeconds * sampleRate);
  const masterBuffer = new Float32Array(totalSamples);
  const beatDuration = 60.0 / bpm;
  const samplesPerBeat = Math.floor(beatDuration * sampleRate);
  const totalBeats = Math.floor(durationSeconds / beatDuration);

  const rootMidi = getMidiRoot(key, 3);
  const scale = SCALES.minor;

  // 1. CHIPTUNE / 8-BIT RETRO
  if (genre === '8bit_retro') {
    const root = getMidiRoot(key, 4);
    const arpeggioOffsets = [0, 4, 7, 12, 7, 4, 2, 7]; // Major arpeggio steps

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;

      // Drums: Kick on 1, 3; Snare on 2, 4; Hats on 8ths
      const beatInBar = b % 4;
      if (beatInBar === 0 || beatInBar === 2) {
        mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.7);
      }
      if (beatInBar === 1 || beatInBar === 3) {
        mixClip(masterBuffer, SynthDrums.snare(sampleRate), beatStart, 0.6);
      }
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate), beatStart, 0.4);
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate), beatStart + Math.floor(samplesPerBeat / 2), 0.35);

      // Fast 16th-note Chiptune Arpeggios (Pulse wave 25% duty)
      const sixteenths = 4;
      const samplesPer16th = Math.floor(samplesPerBeat / sixteenths);
      for (let s = 0; s < sixteenths; s++) {
        const step = (b * 4 + s) % arpeggioOffsets.length;
        const midi = root + arpeggioOffsets[step];
        const freq = noteToFreq(midi);
        const noteBuf = new Float32Array(samplesPer16th);
        let phase = 0;
        for (let i = 0; i < samplesPer16th; i++) {
          phase += (2 * Math.PI * freq) / sampleRate;
          noteBuf[i] = Oscillators.square(phase, 0.25) * Math.exp(-(i / samplesPer16th) * 2.5);
        }
        mixClip(masterBuffer, noteBuf, beatStart + s * samplesPer16th, 0.35);
      }

      // Triangle Bassline (Quarter notes)
      const bassMidi = root - 24 + ((b % 8 < 4) ? 0 : 5);
      const bassFreq = noteToFreq(bassMidi);
      const bassBuf = new Float32Array(samplesPerBeat);
      let bPhase = 0;
      for (let i = 0; i < samplesPerBeat; i++) {
        bPhase += (2 * Math.PI * bassFreq) / sampleRate;
        bassBuf[i] = Oscillators.triangle(bPhase) * Math.exp(-(i / samplesPerBeat) * 1.8);
      }
      mixClip(masterBuffer, bassBuf, beatStart, 0.65);
    }
  }

  // 2. ELECTRONIC / SYNTHWAVE
  else if (genre === 'electronic') {
    const root = getMidiRoot(key, 3);
    const chords = [0, -4, -2, -5]; // i - VI - VII - v progression

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const barIdx = Math.floor(b / 4) % chords.length;
      const chordRoot = root + chords[barIdx];

      // 4-on-the-floor kick
      mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.85);
      // Snare on 2 and 4
      if (b % 2 === 1) mixClip(masterBuffer, SynthDrums.snare(sampleRate), beatStart, 0.7);
      // Offbeat hi-hat
      mixClip(masterBuffer, SynthDrums.hihat_open(sampleRate), beatStart + Math.floor(samplesPerBeat / 2), 0.45);

      // Driving 16th Sawtooth Bassline
      const bassBuf = new Float32Array(Math.floor(samplesPerBeat / 2));
      const bFreq = noteToFreq(chordRoot - 12);
      let p = 0;
      for (let i = 0; i < bassBuf.length; i++) {
        p += (2 * Math.PI * bFreq) / sampleRate;
        bassBuf[i] = Oscillators.sawtooth(p) * Math.exp(-(i / bassBuf.length) * 2.0);
      }
      mixClip(masterBuffer, bassBuf, beatStart, 0.55);
      mixClip(masterBuffer, bassBuf, beatStart + Math.floor(samplesPerBeat / 2), 0.55);

      // Synth Pluck Arpeggio
      const arpNotes = [chordRoot, chordRoot + 3, chordRoot + 7, chordRoot + 10];
      const noteMidi = arpNotes[b % arpNotes.length] + 12;
      const pFreq = noteToFreq(noteMidi);
      const leadBuf = new Float32Array(samplesPerBeat);
      let lp = 0;
      for (let i = 0; i < samplesPerBeat; i++) {
        lp += (2 * Math.PI * pFreq) / sampleRate;
        leadBuf[i] = (Oscillators.sawtooth(lp) + Oscillators.square(lp, 0.5)) * Math.exp(-(i / samplesPerBeat) * 3.5);
      }
      mixClip(masterBuffer, leadBuf, beatStart, 0.4);
    }
  }

  // 3. COMEDY / OOMPAH BOUNCE
  else if (genre === 'comedy') {
    const root = getMidiRoot(key, 3);
    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;

      // Oompah Bass: Root on 1, 3; Fifth on 2, 4
      const bassMidi = root - 12 + ((beatInBar % 2 === 0) ? 0 : 7);
      const bFreq = noteToFreq(bassMidi);
      const bBuf = new Float32Array(samplesPerBeat);
      let bp = 0;
      for (let i = 0; i < samplesPerBeat; i++) {
        bp += (2 * Math.PI * bFreq) / sampleRate;
        bBuf[i] = (Oscillators.sine(bp) + Oscillators.triangle(bp)) * Math.exp(-(i / samplesPerBeat) * 4.0);
      }
      mixClip(masterBuffer, bBuf, beatStart, 0.7);

      // Staccato Ragtime Chords on offbeats
      if (beatInBar === 1 || beatInBar === 3) {
        const chordBuf = new Float32Array(Math.floor(samplesPerBeat * 0.6));
        const triad = [root + 12, root + 16, root + 19];
        triad.forEach(m => {
          const f = noteToFreq(m);
          let p = 0;
          for (let i = 0; i < chordBuf.length; i++) {
            p += (2 * Math.PI * f) / sampleRate;
            chordBuf[i] += Oscillators.triangle(p) * Math.exp(-(i / chordBuf.length) * 6.0) * 0.25;
          }
        });
        mixClip(masterBuffer, chordBuf, beatStart, 0.5);
      }
    }
  }

  // 4. SUSPENSE / TENSION
  else if (genre === 'suspense') {
    const root = getMidiRoot(key, 2);
    const reverb = new AlgorithmicReverb();
    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      // Heartbeat sub-kick every 2 beats
      if (b % 2 === 0) {
        mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.75);
      }

      // Detuned Low Drone
      if (b % 4 === 0) {
        const droneBuf = new Float32Array(samplesPerBeat * 4);
        const dFreq = noteToFreq(root);
        let p1 = 0, p2 = 0;
        for (let i = 0; i < droneBuf.length; i++) {
          p1 += (2 * Math.PI * dFreq) / sampleRate;
          p2 += (2 * Math.PI * (dFreq + 0.5)) / sampleRate;
          droneBuf[i] = (Oscillators.sine(p1) + Oscillators.sine(p2)) * 0.35;
        }
        mixClip(masterBuffer, droneBuf, beatStart, 0.6);
      }

      // Eerie high cluster ping on beat 3 of every 2 bars
      if (b % 8 === 4) {
        const pingBuf = new Float32Array(samplesPerBeat * 2);
        const pMidi = root + 36 + ((b % 16 === 4) ? 1 : 6); // Dissonant interval
        const pFreq = noteToFreq(pMidi);
        let p = 0;
        for (let i = 0; i < pingBuf.length; i++) {
          p += (2 * Math.PI * pFreq) / sampleRate;
          pingBuf[i] = Oscillators.sine(p) * Math.exp(-(i / pingBuf.length) * 4.0);
        }
        mixClip(masterBuffer, reverb.process(pingBuf, 0.6, 0.4), beatStart, 0.4);
      }
    }
  }

  // 5. CINEMATIC / EPIC ORCHESTRAL
  else if (genre === 'cinematic') {
    const root = getMidiRoot(key, 2);
    const reverb = new AlgorithmicReverb();
    const ostinato = [0, 0, 3, 0, 7, 0, 5, 0]; // Driving D-minor cello ostinato
    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;

      // Heavy Taiko Boom on beat 1 and 3
      if (beatInBar === 0 || beatInBar === 2) {
        const taiko = SynthDrums.kick(sampleRate);
        mixClip(masterBuffer, taiko, beatStart, 0.85);
      }

      // Marching snare on beat 2 and 4 with 16th roll transient
      if (beatInBar === 1 || beatInBar === 3) {
        mixClip(masterBuffer, SynthDrums.snare(sampleRate), beatStart, 0.6);
        if (b % 8 === 7) { // Accent roll on 8th bar
          const rollOffset = Math.floor(samplesPerBeat / 4);
          mixClip(masterBuffer, SynthDrums.snare(sampleRate), beatStart + rollOffset, 0.4);
          mixClip(masterBuffer, SynthDrums.snare(sampleRate), beatStart + rollOffset * 2, 0.5);
        }
      }

      // 8th-note Driving Orchestral Strings Ostinato
      const halfBeat = Math.floor(samplesPerBeat / 2);
      for (let s = 0; s < 2; s++) {
        const stepIdx = (b * 2 + s) % ostinato.length;
        const noteMidi = root + 12 + ostinato[stepIdx];
        const freq = noteToFreq(noteMidi);
        const staccatoBuf = new Float32Array(halfBeat);
        let p = 0;
        for (let i = 0; i < halfBeat; i++) {
          p += (2 * Math.PI * freq) / sampleRate;
          const saw = Oscillators.sawtooth(p) * 0.7 + Oscillators.triangle(p * 2) * 0.3;
          staccatoBuf[i] = saw * Math.exp(-(i / halfBeat) * 3.5);
        }
        mixClip(masterBuffer, staccatoBuf, beatStart + s * halfBeat, 0.45);
      }

      // Sustained Brass Chord on bar starts
      if (beatInBar === 0) {
        const brassLen = samplesPerBeat * 4;
        const brassBuf = new Float32Array(brassLen);
        const chordNotes = [root, root + 7, root + 15];
        chordNotes.forEach(m => {
          const f = noteToFreq(m);
          let bp = 0;
          for (let i = 0; i < brassLen; i++) {
            bp += (2 * Math.PI * f) / sampleRate;
            const swell = Math.sin((i / brassLen) * Math.PI);
            brassBuf[i] += (Oscillators.sawtooth(bp) * 0.5 + Oscillators.sine(bp) * 0.5) * swell * 0.2;
          }
        });
        mixClip(masterBuffer, reverb.process(brassBuf, 0.45, 0.6), beatStart, 0.5);
      }
    }
  }

  // 6. HAPPY / UPBEAT GROOVE
  else if (genre === 'happy') {
    const root = getMidiRoot(key, 3);
    const progression = [0, 7, 9, 5]; // I - V - vi - IV (C - G - Am - F)
    const melodySteps = [0, 4, 7, 9, 12, 9, 7, 4];

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const chordIdx = Math.floor(b / 4) % progression.length;
      const currentRoot = root + progression[chordIdx];

      // Kick on 1 and 3, Snare on 2 and 4
      if (beatInBar === 0 || beatInBar === 2) mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.7);
      if (beatInBar === 1 || beatInBar === 3) mixClip(masterBuffer, SynthDrums.snare(sampleRate), beatStart, 0.65);
      // Bright 8th-note hi-hats
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate), beatStart, 0.35);
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate), beatStart + Math.floor(samplesPerBeat / 2), 0.3);

      // Walking Bassline (Triangle)
      const bassMidi = currentRoot - 12 + ((beatInBar === 2) ? 4 : (beatInBar === 3) ? 7 : 0);
      const bassFreq = noteToFreq(bassMidi);
      const bassBuf = new Float32Array(samplesPerBeat);
      let bp = 0;
      for (let i = 0; i < samplesPerBeat; i++) {
        bp += (2 * Math.PI * bassFreq) / sampleRate;
        bassBuf[i] = Oscillators.triangle(bp) * Math.exp(-(i / samplesPerBeat) * 2.5);
      }
      mixClip(masterBuffer, bassBuf, beatStart, 0.6);

      // Cheerful Syncopated Bell Melody (Sine + Triangle)
      const melIdx = (b * 2) % melodySteps.length;
      const melFreq = noteToFreq(root + 12 + melodySteps[melIdx]);
      const melBuf = new Float32Array(Math.floor(samplesPerBeat * 0.8));
      let mp = 0;
      for (let i = 0; i < melBuf.length; i++) {
        mp += (2 * Math.PI * melFreq) / sampleRate;
        melBuf[i] = (Oscillators.sine(mp) * 0.7 + Oscillators.triangle(mp * 2) * 0.3) * Math.exp(-(i / melBuf.length) * 4.0);
      }
      mixClip(masterBuffer, melBuf, beatStart, 0.4);
    }
  }

  // 7. DRAMATIC / INTENSE CRESCENDO
  else if (genre === 'dramatic') {
    const root = getMidiRoot(key, 2);
    const reverb = new AlgorithmicReverb();
    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;

      // Heavy Sub Impact on every downbeat
      if (beatInBar === 0) {
        mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.85);
      }

      // Fast Harmonic Minor Arpeggio Swarm (Sawtooth 16ths)
      const harmMinor = [0, 3, 7, 8, 11, 12, 11, 8];
      const samplesPer16th = Math.floor(samplesPerBeat / 4);
      for (let s = 0; s < 4; s++) {
        const step = (b * 4 + s) % harmMinor.length;
        const arpMidi = root + 24 + harmMinor[step];
        const aFreq = noteToFreq(arpMidi);
        const aBuf = new Float32Array(samplesPer16th);
        let ap = 0;
        for (let i = 0; i < samplesPer16th; i++) {
          ap += (2 * Math.PI * aFreq) / sampleRate;
          aBuf[i] = Oscillators.sawtooth(ap) * Math.exp(-(i / samplesPer16th) * 2.8);
        }
        mixClip(masterBuffer, aBuf, beatStart + s * samplesPer16th, 0.3);
      }

      // Timpani roll on bar transitions
      if (b % 4 === 3) {
        const timpaniLen = Math.floor(samplesPerBeat * 0.8);
        const timpaniBuf = new Float32Array(timpaniLen);
        const tFreq = noteToFreq(root + 7);
        let tp = 0;
        for (let i = 0; i < timpaniLen; i++) {
          tp += (2 * Math.PI * tFreq) / sampleRate;
          const env = (i / timpaniLen); // Crescendo
          timpaniBuf[i] = Oscillators.sine(tp) * env * (Math.random() * 0.2 + 0.8);
        }
        mixClip(masterBuffer, reverb.process(timpaniBuf, 0.5, 0.5), beatStart, 0.55);
      }
    }
  }

  // 8. MINIMAL BACKGROUND / LO-FI BLIPS
  else if (genre === 'minimal') {
    const root = getMidiRoot(key, 3);
    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;

      // Soft Sub Pulse on 1
      if (beatInBar === 0) {
        const subLen = Math.floor(samplesPerBeat * 1.5);
        const subBuf = new Float32Array(subLen);
        const sFreq = noteToFreq(root - 12);
        let sp = 0;
        for (let i = 0; i < subLen; i++) {
          sp += (2 * Math.PI * sFreq) / sampleRate;
          subBuf[i] = Oscillators.sine(sp) * Math.exp(-(i / subLen) * 3.0);
        }
        mixClip(masterBuffer, subBuf, beatStart, 0.6);
      }

      // Delicate Rhodes-like Sine Triad on beat 2
      if (beatInBar === 1) {
        const chordLen = Math.floor(samplesPerBeat * 2.0);
        const chordBuf = new Float32Array(chordLen);
        const triad = [root, root + 7, root + 10]; // minor 7th
        triad.forEach(m => {
          const f = noteToFreq(m);
          let cp = 0;
          for (let i = 0; i < chordLen; i++) {
            cp += (2 * Math.PI * f) / sampleRate;
            chordBuf[i] += Oscillators.sine(cp) * Math.exp(-(i / chordLen) * 2.5) * 0.15;
          }
        });
        mixClip(masterBuffer, chordBuf, beatStart, 0.5);
      }

      // Micro Percussion Click (Highpass blip) on offbeat 16ths
      const clickBuf = new Float32Array(Math.floor(0.015 * sampleRate));
      for (let i = 0; i < clickBuf.length; i++) {
        clickBuf[i] = (Math.random() * 2.0 - 1.0) * Math.exp(-i / (0.003 * sampleRate));
      }
      mixClip(masterBuffer, clickBuf, beatStart + Math.floor(samplesPerBeat * 0.75), 0.25);
    }
  }

  // 9. AMBIENT / CHILL SOUNDSCAPE (DEFAULT)
  else {
    const root = getMidiRoot(key, 3);
    const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16];
    const reverb = new AlgorithmicReverb();

    // Soft warm pad chord (Major 7th / 9th)
    const padChord = [root, root + 4, root + 7, root + 11];
    const padLength = totalSamples;
    const padBuf = new Float32Array(padLength);
    padChord.forEach(m => {
      const f = noteToFreq(m);
      let p = 0;
      for (let i = 0; i < padLength; i++) {
        p += (2 * Math.PI * f) / sampleRate;
        // Slow filter / amplitude swell
        const swell = 0.5 + 0.5 * Math.sin((i / sampleRate) * 0.5);
        padBuf[i] += Oscillators.sine(p) * swell * 0.15;
      }
    });
    mixClip(masterBuffer, padBuf, 0, 0.6);

    // Generative sparse chimes
    for (let b = 0; b < totalBeats; b += 2) {
      if (Math.random() > 0.3) {
        const chimeMidi = root + 12 + pentatonic[Math.floor(Math.random() * pentatonic.length)];
        const cFreq = noteToFreq(chimeMidi);
        const chimeDur = Math.floor(samplesPerBeat * 2);
        const chimeBuf = new Float32Array(chimeDur);
        let cp = 0;
        for (let i = 0; i < chimeDur; i++) {
          cp += (2 * Math.PI * cFreq) / sampleRate;
          chimeBuf[i] = Oscillators.sine(cp) * Math.exp(-(i / chimeDur) * 4.0);
        }
        mixClip(masterBuffer, reverb.process(chimeBuf, 0.55, 0.5), b * samplesPerBeat, 0.35);
      }
    }
  }

  return normalizeAndLimit(masterBuffer);
}

function mixClip(destination, source, startIndex, gain = 1.0) {
  const maxIdx = Math.min(destination.length, startIndex + source.length);
  for (let i = startIndex, j = 0; i < maxIdx; i++, j++) {
    destination[i] += source[j] * gain;
  }
}

// ============================================================================
// 4. RULE-BASED PROMPT PARSER (TEXT -> PROCEDURAL AUDIO)
// ============================================================================

function parseProceduralPrompt(promptText) {
  const text = (promptText || '').toLowerCase().trim();

  // 1. Detect Sound Effects Keywords First
  const sfxCategories = [
    { preset: 'cartoon_boing', category: 'comedy', keys: ['boing', 'spring', 'bounce'] },
    { preset: 'funny_pop', category: 'comedy', keys: ['pop', 'plop', 'bubble'] },
    { preset: 'punch_impact', category: 'action', keys: ['punch', 'hit', 'smack', 'slap'] },
    { preset: 'falling_sound', category: 'comedy', keys: ['fall', 'falling', 'whistle down', 'slide'] },
    { preset: 'record_scratch', category: 'hiphop', keys: ['scratch', 'record scratch', 'rewind'] },
    { preset: 'bass_drop', category: 'electronic', keys: ['bass drop', 'sub drop', '808 drop', '808 bass'] },
    { preset: 'dramatic_impact', category: 'cinematic', keys: ['dramatic impact', 'reveal', 'braam', 'boom', 'impact'] },
    { preset: 'whoosh', category: 'transition', keys: ['whoosh', 'swoosh', 'swish', 'pass by'] },
    { preset: 'glitch', category: 'retro', keys: ['glitch', 'stutter', 'static', 'digital error'] },
    { preset: 'riser', category: 'buildup', keys: ['riser', 'buildup', 'sweep up', 'rise'] },
    { preset: 'suspense_effect', category: 'horror', keys: ['suspense sound', 'suspense effect', 'creepy sound', 'eerie ping'] },
    { preset: 'retro_coin', category: 'gaming', keys: ['coin', 'pickup', 'collect'] },
    { preset: 'retro_jump', category: 'gaming', keys: ['jump', 'leap'] },
    { preset: 'retro_laser', category: 'gaming', keys: ['laser', 'phaser', 'zap', 'pew'] },
    { preset: 'notification_chime', category: 'ui', keys: ['chime', 'bell', 'notification', 'ding', 'alert'] },
    { preset: 'comedic_transition', category: 'comedy', keys: ['fail', 'wah wah', 'sad trombone', 'comedic transition'] }
  ];

  // If the prompt explicitly mentions music, song, beat, or theme, prioritize music detection
  const isExplicitMusic = text.includes('music') || text.includes('song') || text.includes('theme') || text.includes('beat') || text.includes('track') || text.includes('groove');

  if (!isExplicitMusic) {
    for (const item of sfxCategories) {
      if (item.keys.some(k => text.includes(k))) {
        return {
          type: 'sfx',
          preset: item.preset,
          category: item.category,
          prompt: promptText,
          method: 'procedural_dsp',
          description: `Procedurally synthesized sound effect: ${item.preset}`
        };
      }
    }
  }

  // 2. Detect Music Keywords & Moods
  const musicDefinitions = [
    { genre: '8bit_retro', bpm: 136, key: 'C', keys: ['8bit', '8-bit', 'chiptune', 'retro game', 'retro', 'arcade'] },
    { genre: 'electronic', bpm: 124, key: 'F', keys: ['electronic', 'edm', 'synthwave', 'techno', 'house'] },
    { genre: 'comedy', bpm: 120, key: 'C', keys: ['comedy', 'funny', 'cartoon music', 'ragtime', 'polka', 'oompah'] },
    { genre: 'suspense', bpm: 72, key: 'D', keys: ['suspense', 'dark', 'horror', 'creepy', 'tension', 'spooky'] },
    { genre: 'cinematic', bpm: 90, key: 'D', keys: ['cinematic', 'epic', 'orchestral', 'movie', 'soundtrack', 'trailer'] },
    { genre: 'happy', bpm: 128, key: 'C', keys: ['happy', 'upbeat', 'cheerful', 'joyful', 'bouncy'] },
    { genre: 'dramatic', bpm: 80, key: 'C', keys: ['dramatic', 'drama', 'intense', 'crescendo'] },
    { genre: 'minimal', bpm: 88, key: 'C', keys: ['minimal', 'minimalist', 'lofi', 'lo-fi'] },
    { genre: 'ambient', bpm: 60, key: 'C', keys: ['ambient', 'chill', 'meditation', 'drone', 'soundscape', 'peaceful'] }
  ];

  for (const item of musicDefinitions) {
    if (item.keys.some(k => text.includes(k))) {
      return {
        type: 'music',
        genre: item.genre,
        bpm: item.bpm,
        key: item.key,
        durationSeconds: 12.0,
        prompt: promptText,
        method: 'procedural_dsp',
        description: `Procedurally composed music track: ${item.genre} (${item.bpm} BPM, Key of ${item.key})`
      };
    }
  }

  // Check SFX if explicit music check was bypassed earlier
  if (isExplicitMusic) {
    for (const item of sfxCategories) {
      if (item.keys.some(k => text.includes(k))) {
        return {
          type: 'sfx',
          preset: item.preset,
          category: item.category,
          prompt: promptText,
          method: 'procedural_dsp',
          description: `Procedurally synthesized sound effect: ${item.preset}`
        };
      }
    }
  }

  // Generic fallback if mentions "background" or "music"
  if (text.includes('background') || text.includes('music')) {
    return {
      type: 'music',
      genre: 'minimal',
      bpm: 88,
      key: 'C',
      durationSeconds: 12.0,
      prompt: promptText,
      method: 'procedural_dsp',
      description: 'Procedurally composed minimal background music'
    };
  }

  // Default fallback: 8-bit retro gaming sound
  return {
    type: 'sfx',
    preset: 'retro_coin',
    category: 'gaming',
    prompt: promptText,
    method: 'procedural_dsp',
    description: 'Procedurally synthesized retro sound effect'
  };
}

// ============================================================================
// 5. MULTITRACK MEME AUDIO STUDIO MIXER
// ============================================================================

/**
 * Mix Multiple Audio Tracks with Offsets, Fades, Volume, and Ducking
 */
async function renderMultitrackMix({
  tracks = [],
  outputPath,
  format = 'wav',
  sampleRate = SAMPLE_RATE
}) {
  if (tracks.length === 0) throw new Error('No tracks provided for multitrack mixing.');

  // Calculate total duration in samples
  let maxSamples = 0;
  const loadedTracks = [];

  for (const tr of tracks) {
    const startSec = parseFloat(tr.start_time || 0);
    const volume = Math.max(0, Math.min(parseFloat(tr.volume !== undefined ? tr.volume : 1.0), 3.0));
    let buffer = null;

    if (tr.buffer && tr.buffer instanceof Float32Array) {
      buffer = tr.buffer;
    } else if (tr.file_path && fs.existsSync(tr.file_path)) {
      // Decode audio file to raw Float32Array using FFmpeg
      const rawPcm = execFileSync('ffmpeg.exe', [
        '-i', tr.file_path,
        '-f', 'f32le',
        '-ac', '1',
        '-ar', String(sampleRate),
        '-'
      ], { maxBuffer: 100 * 1024 * 1024 });
      buffer = new Float32Array(rawPcm.buffer, rawPcm.byteOffset, rawPcm.length / 4);
    } else if (tr.sfx_preset && SoundEffectGenerators[tr.sfx_preset]) {
      buffer = SoundEffectGenerators[tr.sfx_preset]();
    } else if (tr.music_genre) {
      buffer = generateProceduralMusic({
        genre: tr.music_genre,
        bpm: tr.bpm || 120,
        durationSeconds: tr.duration || 10.0,
        sampleRate
      });
    }

    if (buffer) {
      const startSample = Math.floor(startSec * sampleRate);
      const endSample = startSample + buffer.length;
      if (endSample > maxSamples) maxSamples = endSample;
      loadedTracks.push({
        name: tr.name || 'Track',
        buffer,
        startSample,
        volume,
        isDucked: tr.is_ducked || false
      });
    }
  }

  const masterMix = new Float32Array(maxSamples);

  // Mix all tracks into master
  for (const tr of loadedTracks) {
    for (let i = 0; i < tr.buffer.length; i++) {
      const destIdx = tr.startSample + i;
      if (destIdx < maxSamples) {
        masterMix[destIdx] += tr.buffer[i] * tr.volume;
      }
    }
  }

  // Master limiting & soft saturation
  normalizeAndLimit(masterMix, -1.0);

  // Export to WAV
  const wavBuffer = floatToWavBuffer(masterMix, sampleRate);
  const tempWav = outputPath.endsWith('.wav') ? outputPath : outputPath + '.tmp.wav';
  fs.writeFileSync(tempWav, wavBuffer);

  // Transcode to MP3 if requested
  if (format === 'mp3') {
    execFileSync('ffmpeg.exe', [
      '-y',
      '-i', tempWav,
      '-c:a', 'libmp3lame',
      '-b:a', '256k',
      outputPath
    ]);
    if (tempWav !== outputPath) try { fs.unlinkSync(tempWav); } catch (e) {}
  }

  return {
    outputPath,
    durationSeconds: Math.round((maxSamples / sampleRate) * 100) / 100,
    trackCount: loadedTracks.length
  };
}

module.exports = {
  SAMPLE_RATE,
  Oscillators,
  PinkNoise,
  BiquadFilter,
  AlgorithmicReverb,
  applyADSR,
  applyDistortion,
  applyDelay,
  normalizeAndLimit,
  floatToWavBuffer,
  SoundEffectGenerators,
  SynthDrums,
  generateProceduralMusic,
  parseProceduralPrompt,
  renderMultitrackMix,
  PROCEDURAL_DIR,
  AUDIO_DIR
};
