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
  noise: (rng = null) => ((rng ? rng() : Math.random()) * 2.0 - 1.0)
};

/**
 * Pink Noise Generator (3-pole filter / Voss-McCartney algorithm)
 * Supports deterministic PRNG injection.
 */
class PinkNoise {
  constructor(rng = null) {
    this.rng = rng;
    this.b0 = 0; this.b1 = 0; this.b2 = 0;
  }
  next() {
    const white = (this.rng ? this.rng() : Math.random()) * 2.0 - 1.0;
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
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Supports numerical seeds or string seeds via Fowler-Noll-Vo 32-bit hash.
 */
function hashStringSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let s = (typeof seed === 'string')
    ? hashStringSeed(seed)
    : ((typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : Math.floor(Math.random() * 0xFFFFFFFF));
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Rich Physical & Synthesizer Instrument Timbres
 */
const SynthInstruments = {
  /**
   * FM Electric Piano / Bell Synthesizer (Chime, Rhodes, Mallet)
   */
  fmNote: (freq, duration, sampleRate = SAMPLE_RATE, { modRatio = 2.0, modIndex = 2.4, decay = 2.8 } = {}) => {
    const numSamples = Math.floor(duration * sampleRate);
    const buf = new Float32Array(numSamples);
    let pCarrier = 0;
    let pMod = 0;
    const modFreq = freq * modRatio;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * decay);
      pMod += (2 * Math.PI * modFreq) / sampleRate;
      const modSignal = Math.sin(pMod) * (modIndex * env);
      pCarrier += (2 * Math.PI * freq) / sampleRate;
      buf[i] = Math.sin(pCarrier + modSignal) * env;
    }
    return buf;
  },

  /**
   * Karplus-Strong Plucked String (Acoustic guitar / harp / pizzicato strings)
   */
  pluckedString: (freq, duration, sampleRate = SAMPLE_RATE, { damping = 0.985, rng = null } = {}) => {
    const numSamples = Math.floor(duration * sampleRate);
    const buf = new Float32Array(numSamples);
    const delayLength = Math.max(2, Math.round(sampleRate / Math.max(20, freq)));
    const delayBuffer = new Float32Array(delayLength);
    for (let i = 0; i < delayLength; i++) {
      const rand = (rng ? rng() : Math.random());
      delayBuffer[i] = rand * 2.0 - 1.0;
    }
    let ptr = 0;
    let prev = 0;
    for (let i = 0; i < numSamples; i++) {
      const val = delayBuffer[ptr];
      const filtered = 0.5 * (val + prev) * damping;
      prev = val;
      delayBuffer[ptr] = filtered;
      ptr = (ptr + 1) % delayLength;
      buf[i] = val;
    }
    return buf;
  },

  /**
   * Supersaw Lead (Detuned unison oscillators with lowpass filter)
   */
  supersawLead: (freq, duration, sampleRate = SAMPLE_RATE, { detuneCents = 14, numOsc = 3, cutoff = 2800 } = {}) => {
    const numSamples = Math.floor(duration * sampleRate);
    const buf = new Float32Array(numSamples);
    const phases = new Float32Array(numOsc);
    const freqs = new Float32Array(numOsc);
    for (let o = 0; o < numOsc; o++) {
      const centOffset = (o - (numOsc - 1) / 2) * detuneCents;
      freqs[o] = freq * Math.pow(2, centOffset / 1200);
    }
    const filter = new BiquadFilter('lowpass', cutoff, 1.2, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sum = 0;
      for (let o = 0; o < numOsc; o++) {
        phases[o] += (2 * Math.PI * freqs[o]) / sampleRate;
        sum += Oscillators.sawtooth(phases[o]);
      }
      buf[i] = filter.process(sum / numOsc) * Math.exp(-t * 2.2);
    }
    return normalizeAndLimit(buf, -1.0);
  }
};

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
  punch_impact: ({ duration = 0.45, rng = null, seed = null } = {}) => {
    const actualRng = rng || (seed !== null && seed !== undefined ? createRng(seed) : null);
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
      const rand = actualRng ? actualRng() : Math.random();
      const noise = (rand * 2.0 - 1.0) * Math.exp(-t * 28.0) * 1.4;
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
  record_scratch: ({ duration = 0.5, rng = null, seed = null } = {}) => {
    const actualRng = rng || (seed !== null && seed !== undefined ? createRng(seed) : null);
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    const bp = new BiquadFilter('bandpass', 1400, 3.0);
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      // Scrub curve back-and-forth
      const scrubSpeed = Math.sin(t * Math.PI * 4) * 600 + 750;
      phase += (2 * Math.PI * scrubSpeed) / SAMPLE_RATE;
      const rand = actualRng ? actualRng() : Math.random();
      const noise = (rand * 2.0 - 1.0);
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
  glitch: ({ duration = 0.7, rng = null, seed = null } = {}) => {
    const actualRng = rng || (seed !== null && seed !== undefined ? createRng(seed) : null);
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    let stepFreq = 440;
    for (let i = 0; i < numSamples; i++) {
      // Step frequency randomly every 800 samples
      if (i % 800 === 0) {
        const rand = actualRng ? actualRng() : Math.random();
        stepFreq = 150 + Math.floor(rand * 2000);
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
  },

  /**
   * 15. Rain Ambience (Pink noise bed + randomized resonant droplet impulses)
   */
  rain_ambience: ({ duration = 3.0, rng = null, seed = null } = {}) => {
    const actualRng = rng || (seed !== null && seed !== undefined ? createRng(seed) : null);
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    const pink = new PinkNoise(actualRng);
    const filter = new BiquadFilter('bandpass', 1800, 1.2);
    const dropFilter = new BiquadFilter('highpass', 2400, 2.0);

    for (let i = 0; i < numSamples; i++) {
      const p = pink.next();
      const baseRain = filter.process(p) * 0.45;
      
      // Random droplet pings
      const randVal = actualRng ? actualRng() : Math.random();
      let drop = 0;
      if (randVal < 0.003) {
        const dropFreq = 2200 + (actualRng ? actualRng() : Math.random()) * 2000;
        drop = Math.sin((i / SAMPLE_RATE) * 2 * Math.PI * dropFreq) * 0.7;
      }
      buf[i] = baseRain + dropFilter.process(drop);
    }
    return applyADSR(buf, SAMPLE_RATE, { attack: 0.1, decay: 0.1, sustain: 0.9, release: 0.2 });
  },

  /**
   * 16. Wind Gust (Swept bandpass filtered pink noise with dynamic air turbulence)
   */
  wind_gust: ({ duration = 3.5, rng = null, seed = null } = {}) => {
    const actualRng = rng || (seed !== null && seed !== undefined ? createRng(seed) : null);
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    const pink = new PinkNoise(actualRng);

    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const gustEnv = Math.sin((i / numSamples) * Math.PI);
      const lfo = 0.5 + 0.5 * Math.sin(t * 1.8 * Math.PI);
      const centerFreq = 300 + gustEnv * 650 + lfo * 200;
      
      const filter = new BiquadFilter('bandpass', centerFreq, 2.0);
      const rawNoise = pink.next();
      buf[i] = filter.process(rawNoise) * (gustEnv * 0.9 + 0.1);
    }
    return applyADSR(buf, SAMPLE_RATE, { attack: 0.4, decay: 0.2, sustain: 0.8, release: 0.5 });
  },

  /**
   * 17. Thunder Clap (Explosive lowpass impact followed by long sub-bass decay)
   */
  thunder_clap: ({ duration = 4.0, rng = null, seed = null } = {}) => {
    const actualRng = rng || (seed !== null && seed !== undefined ? createRng(seed) : null);
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    const pink = new PinkNoise(actualRng);
    const subFilter = new BiquadFilter('lowpass', 180, 2.5);
    const snapFilter = new BiquadFilter('bandpass', 1200, 1.5);

    let subPhase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const crackleEnv = Math.exp(-t * 25.0);
      const rand = actualRng ? actualRng() : Math.random();
      const crackle = snapFilter.process((rand * 2 - 1) * crackleEnv * 1.5);

      const rumbleEnv = Math.exp(-t * 1.2) * (1.0 + 0.3 * Math.sin(t * 8.0));
      const p = pink.next();
      const filteredPink = subFilter.process(p) * rumbleEnv * 1.8;

      const subFreq = 55 * Math.exp(-t * 0.8) + 30;
      subPhase += (2 * Math.PI * subFreq) / SAMPLE_RATE;
      const subTone = Math.sin(subPhase) * rumbleEnv * 0.7;

      buf[i] = crackle + filteredPink + subTone;
    }
    return applyDistortion(buf, 1.6, 'soft');
  },

  /**
   * 18. Mechanical Hum (60 Hz AC electrical grid hum with rich harmonic overtones)
   */
  mechanical_hum: ({ duration = 2.5, baseFreq = 60 } = {}) => {
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const buf = new Float32Array(numSamples);
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    for (let i = 0; i < numSamples; i++) {
      p1 += (2 * Math.PI * baseFreq) / SAMPLE_RATE;
      p2 += (2 * Math.PI * baseFreq * 2) / SAMPLE_RATE;
      p3 += (2 * Math.PI * baseFreq * 3) / SAMPLE_RATE;
      p4 += (2 * Math.PI * baseFreq * 5) / SAMPLE_RATE;
      
      const wave = (
        Math.sin(p1) * 0.7 +
        Math.sin(p2) * 0.35 +
        Math.sin(p3) * 0.2 +
        Math.sin(p4) * 0.1
      );
      buf[i] = wave;
    }
    return applyADSR(buf, SAMPLE_RATE, { attack: 0.05, decay: 0.05, sustain: 0.95, release: 0.1 });
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
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  blues: [0, 3, 5, 6, 7, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  pentatonic: [0, 2, 4, 7, 9]
};

const NOTE_MAP = {
  'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3,
  'E': 4, 'F': 5, 'F#': 6, 'GB': 6, 'G': 7, 'G#': 8,
  'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToFreq(midiNote) {
  return 440.0 * Math.pow(2.0, (midiNote - 69) / 12.0);
}

function getMidiRoot(keyName = 'C', octave = 4) {
  const norm = (keyName || 'C').toUpperCase().trim();
  const index = NOTE_MAP[norm] !== undefined ? NOTE_MAP[norm] : 0;
  return 12 * (octave + 1) + index;
}

/**
 * Parse custom progression from string or array (e.g. ['I', 'V', 'vi', 'IV'] or [0, 7, 9, 5])
 */
function parseProgression(progInput, rootMidi) {
  if (!progInput) return null;
  if (Array.isArray(progInput) && typeof progInput[0] === 'number') {
    return progInput.map(offset => rootMidi + offset);
  }
  const progStr = Array.isArray(progInput) ? progInput.join(',') : String(progInput);
  const tokens = progStr.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  const romanMap = {
    'i': 0, 'I': 0,
    'ii': 2, 'II': 2,
    'iii': 4, 'III': 4,
    'iv': 5, 'IV': 5,
    'v': 7, 'V': 7,
    'vi': 8, 'VI': 8,
    'vii': 10, 'VII': 10
  };
  const results = [];
  for (const tok of tokens) {
    if (romanMap[tok] !== undefined) {
      results.push(rootMidi + romanMap[tok]);
    } else {
      const match = tok.match(/^([a-gA-G][#b]?)/);
      if (match && NOTE_MAP[match[1].toUpperCase()] !== undefined) {
        results.push(12 * (Math.floor(rootMidi / 12)) + NOTE_MAP[match[1].toUpperCase()]);
      } else {
        const num = parseInt(tok, 10);
        if (!isNaN(num)) results.push(rootMidi + num);
      }
    }
  }
  return results.length > 0 ? results : null;
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

  snare: (sampleRate = SAMPLE_RATE, { rng = null } = {}) => {
    const numSamples = Math.floor(0.22 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('bandpass', 1800, 1.8, sampleRate);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      phase += (2 * Math.PI * 185) / sampleRate;
      const tone = Oscillators.sine(phase) * Math.exp(-t * 22.0);
      const rand = (rng ? rng() : Math.random());
      const noise = (rand * 2.0 - 1.0) * Math.exp(-t * 14.0);
      buf[i] = tone * 0.4 + filter.process(noise) * 0.8;
    }
    return buf;
  },

  hihat_closed: (sampleRate = SAMPLE_RATE, { rng = null } = {}) => {
    const numSamples = Math.floor(0.05 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('highpass', 7000, 1.5, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const rand = (rng ? rng() : Math.random());
      buf[i] = filter.process(rand * 2.0 - 1.0) * (1.0 - t);
    }
    return buf;
  },

  hihat_open: (sampleRate = SAMPLE_RATE, { rng = null } = {}) => {
    const numSamples = Math.floor(0.25 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('highpass', 6500, 1.5, sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const rand = (rng ? rng() : Math.random());
      buf[i] = filter.process(rand * 2.0 - 1.0) * Math.exp(-t * 12.0);
    }
    return buf;
  },

  crash: (sampleRate = SAMPLE_RATE, { rng = null } = {}) => {
    const numSamples = Math.floor(1.4 * sampleRate);
    const buf = new Float32Array(numSamples);
    const filter = new BiquadFilter('highpass', 5000, 1.2, sampleRate);
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      p1 += (2 * Math.PI * 342) / sampleRate;
      p2 += (2 * Math.PI * 521) / sampleRate;
      p3 += (2 * Math.PI * 789) / sampleRate;
      p4 += (2 * Math.PI * 1042) / sampleRate;
      const metallic = (Oscillators.square(p1, 0.4) + Oscillators.square(p2, 0.3) + Oscillators.square(p3, 0.2) + Oscillators.square(p4, 0.5)) * 0.25;
      const rand = (rng ? rng() : Math.random());
      const noise = (rand * 2.0 - 1.0) * 0.75;
      buf[i] = filter.process(metallic + noise) * Math.exp(-t * 2.8);
    }
    return buf;
  },

  tom: (sampleRate = SAMPLE_RATE, startFreq = 160, endFreq = 65, { rng = null } = {}) => {
    const numSamples = Math.floor(0.22 * sampleRate);
    const buf = new Float32Array(numSamples);
    let phase = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = startFreq * Math.exp(-t * 14.0) + endFreq;
      phase += (2 * Math.PI * freq) / sampleRate;
      buf[i] = Oscillators.sine(phase) * Math.exp(-t * 7.5);
    }
    return buf;
  }
};

/**
 * Procedural Music Composition Generator with Deterministic Seed & Section Transitions
 */
function generateProceduralMusic({
  genre = '8bit_retro',
  bpm = 120,
  durationSeconds = 12.0,
  key = 'C',
  scale = null,
  progression = null,
  seed = null,
  loop = true,
  sampleRate = SAMPLE_RATE
} = {}) {
  const safeBpm = Math.max(40, Math.min(240, parseInt(bpm || 120, 10)));
  const safeDur = Math.max(1.0, Math.min(120.0, parseFloat(durationSeconds || 12.0)));
  const totalSamples = Math.floor(safeDur * sampleRate);
  const masterBuffer = new Float32Array(totalSamples);
  const beatDuration = 60.0 / safeBpm;
  const samplesPerBeat = Math.floor(beatDuration * sampleRate);
  const totalBeats = Math.floor(safeDur / beatDuration);

  // Deterministic PRNG initialization
  const actualSeed = (seed !== null && seed !== undefined) ? seed : 1337;
  const rng = createRng(actualSeed);

  // Musical Scale Selection
  let activeScale = SCALES.minor;
  let scaleName = 'minor';
  if (scale) {
    if (typeof scale === 'string' && SCALES[scale.toLowerCase()]) {
      activeScale = SCALES[scale.toLowerCase()];
      scaleName = scale.toLowerCase();
    } else if (Array.isArray(scale)) {
      activeScale = scale;
      scaleName = 'custom';
    }
  } else if (genre === 'happy' || genre === 'comedy') {
    activeScale = SCALES.major;
    scaleName = 'major';
  } else if (genre === 'dramatic') {
    activeScale = SCALES.harmonic_minor;
    scaleName = 'harmonic_minor';
  }

  const rootMidi = getMidiRoot(key, 3);
  const customChords = parseProgression(progression, rootMidi);
  const reverb = new AlgorithmicReverb(sampleRate);

  // 1. CHIPTUNE / 8-BIT RETRO
  if (genre === '8bit_retro') {
    const root = getMidiRoot(key, 4);
    const chords = customChords || [root, root + 7, root + 9, root + 5];
    const motifPool = [
      [0, 4, 7, 12, 11, 7, 4, 2],
      [0, 3, 7, 12, 10, 7, 3, 2],
      [0, 7, 4, 12, 7, 4, 2, 0],
      [0, 5, 7, 12, 11, 9, 7, 4]
    ];
    const motif = motifPool[Math.floor(rng() * motifPool.length)];

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const barIdx = Math.floor(b / 4);
      const isTransition = (b % 8 === 7);
      const isSectionStart = (b % 8 === 0 && b > 0);
      const chordRoot = chords[barIdx % chords.length];

      // Drums
      if (beatInBar === 0 || beatInBar === 2) {
        mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.7);
      }
      if (beatInBar === 1 || beatInBar === 3) {
        mixClip(masterBuffer, SynthDrums.snare(sampleRate, { rng }), beatStart, 0.6);
      }
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate, { rng }), beatStart, 0.4);
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.3);

      // Transition Fill (Toms on beat 4 of transition bar)
      if (isTransition && beatInBar === 3) {
        mixClip(masterBuffer, SynthDrums.tom(sampleRate, 190, 80, { rng }), beatStart, 0.6);
        mixClip(masterBuffer, SynthDrums.tom(sampleRate, 140, 55, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.6);
      }
      // Section Start Crash Cymbal
      if (isSectionStart && beatInBar === 0) {
        mixClip(masterBuffer, reverb.process(SynthDrums.crash(sampleRate, { rng }), 0.4, 0.6), beatStart, 0.6);
      }

      // Fast 16th-note Chiptune Arpeggios (Pulse wave 25% duty)
      const sixteenths = 4;
      const samplesPer16th = Math.floor(samplesPerBeat / sixteenths);
      for (let s = 0; s < sixteenths; s++) {
        const step = (b * 4 + s) % motif.length;
        const noteMidi = chordRoot + motif[step];
        const freq = noteToFreq(noteMidi);
        const noteBuf = new Float32Array(samplesPer16th);
        let phase = 0;
        for (let i = 0; i < samplesPer16th; i++) {
          phase += (2 * Math.PI * freq) / sampleRate;
          noteBuf[i] = Oscillators.square(phase, 0.25) * Math.exp(-(i / samplesPer16th) * 2.5);
        }
        mixClip(masterBuffer, noteBuf, beatStart + s * samplesPer16th, 0.35);
      }

      // Triangle Bassline
      const bassMidi = chordRoot - 12 + ((b % 2 === 1) ? 7 : 0);
      const bassFreq = noteToFreq(bassMidi);
      const bassBuf = new Float32Array(samplesPerBeat);
      let bPhase = 0;
      for (let i = 0; i < samplesPerBeat; i++) {
        bPhase += (2 * Math.PI * bassFreq) / sampleRate;
        bassBuf[i] = Oscillators.triangle(bPhase) * Math.exp(-(i / samplesPerBeat) * 2.0);
      }
      mixClip(masterBuffer, bassBuf, beatStart, 0.65);
    }
  }

  // 2. ELECTRONIC / SYNTHWAVE
  else if (genre === 'electronic') {
    const root = getMidiRoot(key, 3);
    const chords = customChords || [root, root - 4, root - 2, root - 5];
    const leadPool = [
      [0, 3, 7, 10, 12, 10, 7, 3],
      [0, 7, 10, 12, 14, 12, 10, 7],
      [0, 3, 7, 12, 15, 12, 7, 3],
      [0, 2, 7, 10, 12, 7, 10, 2]
    ];
    const motifIntervals = leadPool[Math.floor(rng() * leadPool.length)];

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const barIdx = Math.floor(b / 4) % chords.length;
      const chordRoot = chords[barIdx];
      const isTransition = (b % 8 === 7);
      const isSectionStart = (b % 8 === 0 && b > 0);

      // 4-on-the-floor kick
      mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.85);
      // Snare on 2 and 4
      if (b % 2 === 1) mixClip(masterBuffer, SynthDrums.snare(sampleRate, { rng }), beatStart, 0.7);
      // Offbeat open hi-hat
      mixClip(masterBuffer, SynthDrums.hihat_open(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.45);

      // Transition fill
      if (isTransition && (b % 4 === 3)) {
        mixClip(masterBuffer, SynthDrums.snare(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 4), 0.5);
        mixClip(masterBuffer, SynthDrums.snare(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.65);
        mixClip(masterBuffer, SynthDrums.tom(sampleRate, 180, 60, { rng }), beatStart + Math.floor(samplesPerBeat * 0.75), 0.7);
      }
      if (isSectionStart && (b % 4 === 0)) {
        mixClip(masterBuffer, reverb.process(SynthDrums.crash(sampleRate, { rng }), 0.45, 0.6), beatStart, 0.75);
      }

      // Driving 16th Sawtooth Bassline
      const bassBuf = new Float32Array(Math.floor(samplesPerBeat / 2));
      const bFreq = noteToFreq(chordRoot - 12);
      let p = 0;
      for (let i = 0; i < bassBuf.length; i++) {
        p += (2 * Math.PI * bFreq) / sampleRate;
        bassBuf[i] = Oscillators.sawtooth(p) * Math.exp(-(i / bassBuf.length) * 2.2);
      }
      mixClip(masterBuffer, bassBuf, beatStart, 0.55);
      mixClip(masterBuffer, bassBuf, beatStart + Math.floor(samplesPerBeat / 2), 0.55);

      // Rich Supersaw Lead Pluck with Motif Variation
      const noteMidi = chordRoot + 12 + motifIntervals[(b * 2) % motifIntervals.length];
      const leadNote = SynthInstruments.supersawLead(noteToFreq(noteMidi), beatDuration * 0.9, sampleRate, {
        detuneCents: 16,
        numOsc: 3,
        cutoff: 3200
      });
      mixClip(masterBuffer, leadNote, beatStart, 0.45);
    }
  }

  // 3. COMEDY / OOMPAH BOUNCE
  else if (genre === 'comedy') {
    const root = getMidiRoot(key, 3);
    const chords = customChords || [root, root + 5, root + 7, root];
    const inversion = Math.floor(rng() * 2);

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const barIdx = Math.floor(b / 4) % chords.length;
      const chordRoot = chords[barIdx];

      // Oompah Bass: Root on 1, 3; Fifth on 2, 4
      const bassMidi = chordRoot - 12 + ((beatInBar % 2 === 0) ? 0 : 7);
      const bFreq = noteToFreq(bassMidi);
      const bBuf = new Float32Array(samplesPerBeat);
      let bp = 0;
      for (let i = 0; i < samplesPerBeat; i++) {
        bp += (2 * Math.PI * bFreq) / sampleRate;
        bBuf[i] = (Oscillators.sine(bp) + Oscillators.triangle(bp)) * Math.exp(-(i / samplesPerBeat) * 4.0);
      }
      mixClip(masterBuffer, bBuf, beatStart, 0.7);

      // Ragtime FM Piano Chords on offbeats (2 and 4) with seeded voicing
      if (beatInBar === 1 || beatInBar === 3) {
        const triad = (inversion === 0)
          ? [chordRoot + 12, chordRoot + 16, chordRoot + 19]
          : [chordRoot + 16, chordRoot + 19, chordRoot + 24];
        triad.forEach(m => {
          const pianoNote = SynthInstruments.fmNote(noteToFreq(m), beatDuration * 0.6, sampleRate, {
            modRatio: 2.0, modIndex: 1.8, decay: 6.0
          });
          mixClip(masterBuffer, pianoNote, beatStart, 0.25);
        });
        mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.25);
      }
      if (b % 8 === 7 && beatInBar === 3) {
        mixClip(masterBuffer, SynthDrums.tom(sampleRate, 200, 75, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.5);
      }
    }
  }

  // 4. SUSPENSE / TENSION
  else if (genre === 'suspense') {
    const root = getMidiRoot(key, 2);
    const bellIntervals = [1, 3, 6, 8, 11];
    const eerieOffset = bellIntervals[Math.floor(rng() * bellIntervals.length)];

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

      // Eerie high cluster FM bell ping on beat 3
      if (b % 8 === 4) {
        const pMidi = root + 36 + eerieOffset;
        const bell = SynthInstruments.fmNote(noteToFreq(pMidi), beatDuration * 2.5, sampleRate, {
          modRatio: 3.5, modIndex: 3.0, decay: 1.8
        });
        mixClip(masterBuffer, reverb.process(bell, 0.6, 0.4), beatStart, 0.5);
      }
      if (b % 4 === 2) {
        mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.2);
      }
    }
  }

  // 5. CINEMATIC / EPIC ORCHESTRAL
  else if (genre === 'cinematic') {
    const root = getMidiRoot(key, 2);
    const chords = customChords || [root, root + 3, root + 7, root + 5];
    const ostinatoPool = [
      [0, 0, 3, 0, 7, 0, 5, 0],
      [0, 3, 7, 3, 8, 7, 5, 3],
      [0, 0, 7, 0, 3, 0, 5, 0]
    ];
    const ostinato = ostinatoPool[Math.floor(rng() * ostinatoPool.length)];

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const barIdx = Math.floor(b / 4) % chords.length;
      const chordRoot = chords[barIdx];

      // Heavy Taiko Boom on 1 and 3
      if (beatInBar === 0 || beatInBar === 2) {
        mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.85);
      }
      // Marching snare on 2 and 4
      if (beatInBar === 1 || beatInBar === 3) {
        mixClip(masterBuffer, SynthDrums.snare(sampleRate, { rng }), beatStart, 0.6);
        if (b % 8 === 7) {
          mixClip(masterBuffer, SynthDrums.tom(sampleRate, 170, 70, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.55);
        }
      }
      if (b % 8 === 0 && b > 0) {
        mixClip(masterBuffer, reverb.process(SynthDrums.crash(sampleRate, { rng }), 0.5, 0.5), beatStart, 0.7);
      }

      // Driving Staccato Strings Ostinato (8ths)
      const halfBeat = Math.floor(samplesPerBeat / 2);
      for (let s = 0; s < 2; s++) {
        const step = (b * 2 + s) % ostinato.length;
        const noteMidi = chordRoot + 12 + ostinato[step];
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
        const chordNotes = [chordRoot, chordRoot + 7, chordRoot + 15];
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
    const chords = customChords || [root, root + 7, root + 9, root + 5]; // I - V - vi - IV
    const melodyPool = [
      [0, 4, 7, 9, 12, 9, 7, 4],
      [0, 2, 4, 7, 9, 12, 11, 7],
      [0, 7, 9, 12, 14, 12, 9, 7]
    ];
    const melodySteps = melodyPool[Math.floor(rng() * melodyPool.length)];

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const chordIdx = Math.floor(b / 4) % chords.length;
      const currentRoot = chords[chordIdx];

      if (beatInBar === 0 || beatInBar === 2) mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.7);
      if (beatInBar === 1 || beatInBar === 3) mixClip(masterBuffer, SynthDrums.snare(sampleRate, { rng }), beatStart, 0.65);
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate, { rng }), beatStart, 0.35);
      mixClip(masterBuffer, SynthDrums.hihat_closed(sampleRate, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.3);

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

      // Plucked Acoustic String Melody (Karplus-Strong physical modeling seeded with PRNG)
      const melIdx = (b * 2) % melodySteps.length;
      const melFreq = noteToFreq(currentRoot + 12 + melodySteps[melIdx]);
      const plucked = SynthInstruments.pluckedString(melFreq, beatDuration * 0.85, sampleRate, { damping: 0.982, rng });
      mixClip(masterBuffer, plucked, beatStart, 0.45);
    }
  }

  // 7. DRAMATIC / INTENSE CRESCENDO
  else if (genre === 'dramatic') {
    const root = getMidiRoot(key, 2);
    const chords = customChords || [root, root + 3, root + 8, root + 7];
    const harmPool = [
      [0, 3, 7, 8, 11, 12, 11, 8],
      [0, 7, 8, 11, 12, 11, 8, 3],
      [0, 3, 7, 11, 12, 14, 12, 11]
    ];
    const harmMinor = harmPool[Math.floor(rng() * harmPool.length)];

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const barIdx = Math.floor(b / 4) % chords.length;
      const currentRoot = chords[barIdx];

      if (beatInBar === 0) {
        mixClip(masterBuffer, SynthDrums.kick(sampleRate), beatStart, 0.85);
      }

      // Fast Harmonic Minor Supersaw Arpeggio
      const samplesPer16th = Math.floor(samplesPerBeat / 4);
      for (let s = 0; s < 4; s++) {
        const step = (b * 4 + s) % harmMinor.length;
        const arpMidi = currentRoot + 24 + harmMinor[step];
        const aFreq = noteToFreq(arpMidi);
        const aBuf = new Float32Array(samplesPer16th);
        let ap = 0;
        for (let i = 0; i < samplesPer16th; i++) {
          ap += (2 * Math.PI * aFreq) / sampleRate;
          aBuf[i] = Oscillators.sawtooth(ap) * Math.exp(-(i / samplesPer16th) * 2.8);
        }
        mixClip(masterBuffer, aBuf, beatStart + s * samplesPer16th, 0.35);
      }

      // Timpani roll fill on transition bars
      if (b % 4 === 3) {
        mixClip(masterBuffer, SynthDrums.tom(sampleRate, 140, 50, { rng }), beatStart + Math.floor(samplesPerBeat / 2), 0.65);
      }
      if (b % 8 === 0 && b > 0) {
        mixClip(masterBuffer, reverb.process(SynthDrums.crash(sampleRate, { rng }), 0.5, 0.5), beatStart, 0.8);
      }
    }
  }

  // 8. MINIMAL BACKGROUND / LO-FI BLIPS
  else if (genre === 'minimal') {
    const root = getMidiRoot(key, 3);
    const chords = customChords || [root, root + 5, root + 7, root];
    const chordInversions = [
      [root, root + 7, root + 10],
      [root + 3, root + 7, root + 10],
      [root - 5, root + 2, root + 7]
    ];
    const inversionOffset = Math.floor(rng() * chordInversions.length);

    for (let b = 0; b < totalBeats; b++) {
      const beatStart = b * samplesPerBeat;
      const beatInBar = b % 4;
      const barIdx = Math.floor(b / 4) % chords.length;
      const chordRoot = chords[barIdx];

      // Soft Sub Pulse on 1
      if (beatInBar === 0) {
        const subLen = Math.floor(samplesPerBeat * 1.5);
        const subBuf = new Float32Array(subLen);
        const sFreq = noteToFreq(chordRoot - 12);
        let sp = 0;
        for (let i = 0; i < subLen; i++) {
          sp += (2 * Math.PI * sFreq) / sampleRate;
          subBuf[i] = Oscillators.sine(sp) * Math.exp(-(i / subLen) * 3.0);
        }
        mixClip(masterBuffer, subBuf, beatStart, 0.6);
      }

      // Rhodes-like FM Electric Piano Triad on beat 2
      if (beatInBar === 1) {
        const triad = chordInversions[(barIdx + inversionOffset) % chordInversions.length];
        triad.forEach(m => {
          const rhodes = SynthInstruments.fmNote(noteToFreq(m), beatDuration * 1.8, sampleRate, {
            modRatio: 2.0, modIndex: 1.5, decay: 2.5
          });
          mixClip(masterBuffer, rhodes, beatStart, 0.25);
        });
      }

      // Micro Percussion Click on offbeat (Using deterministic PRNG)
      const clickBuf = new Float32Array(Math.floor(0.015 * sampleRate));
      for (let i = 0; i < clickBuf.length; i++) {
        clickBuf[i] = (rng() * 2.0 - 1.0) * Math.exp(-i / (0.003 * sampleRate));
      }
      mixClip(masterBuffer, clickBuf, beatStart + Math.floor(samplesPerBeat * 0.75), 0.25);
    }
  }

  // 9. AMBIENT / CHILL SOUNDSCAPE (DEFAULT)
  else {
    const root = getMidiRoot(key, 3);
    const chords = customChords || [root, root + 5, root - 2, root];
    const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16];

    // Soft warm pad chord
    const padChord = [root, root + 4, root + 7, root + 11];
    const padLength = totalSamples;
    const padBuf = new Float32Array(padLength);
    padChord.forEach(m => {
      const f = noteToFreq(m);
      let p = 0;
      for (let i = 0; i < padLength; i++) {
        p += (2 * Math.PI * f) / sampleRate;
        const swell = 0.5 + 0.5 * Math.sin((i / sampleRate) * 0.5);
        padBuf[i] += Oscillators.sine(p) * swell * 0.15;
      }
    });
    mixClip(masterBuffer, padBuf, 0, 0.6);

    // Generative sparse FM bell chimes
    for (let b = 0; b < totalBeats; b += 2) {
      if (rng() > 0.35) {
        const chimeMidi = root + 12 + pentatonic[Math.floor(rng() * pentatonic.length)];
        const bell = SynthInstruments.fmNote(noteToFreq(chimeMidi), beatDuration * 2.2, sampleRate, {
          modRatio: 2.5, modIndex: 2.2, decay: 3.5
        });
        mixClip(masterBuffer, reverb.process(bell, 0.55, 0.5), b * samplesPerBeat, 0.35);
      }
    }
  }

  const output = normalizeAndLimit(masterBuffer);
  // Attach reproducible metadata
  output.seed = actualSeed;
  output.bpm = safeBpm;
  output.durationSeconds = safeDur;
  output.genre = genre;
  output.key = key;
  output.scale = scaleName;

  return output;
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

/**
 * Parses user prompt to extract audio parameters (duration, BPM, mood, key, scale, genre, seed).
 * Honest rule-based extraction without neural models or random silent fallbacks.
 */
function parseProceduralPrompt(promptText) {
  const text = (promptText || '').toLowerCase().trim();
  if (!text) {
    return {
      error: 'UNSUPPORTED_PROMPT',
      supported: false,
      detail: 'Prompt string is empty. Please provide descriptive audio instructions.',
      method: 'rule_based_procedural_dsp',
      label: 'Rule-Based Procedural DSP Engine'
    };
  }

  // --- PARAMETER EXTRACTION ---

  // 1. Duration Extraction
  let extractedDur = null;
  const durMatch = text.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/);
  if (durMatch) {
    extractedDur = Math.max(1.0, Math.min(120.0, parseFloat(durMatch[1])));
  } else if (text.includes('half minute') || text.includes('30s')) {
    extractedDur = 30.0;
  } else if (text.includes('one minute') || text.includes('1 minute') || text.includes('60s')) {
    extractedDur = 60.0;
  }

  // 2. BPM / Tempo Extraction
  let extractedBpm = null;
  const bpmMatch = text.match(/(\d{2,3})\s*bpm\b/) || text.match(/tempo\s*(?:of\s*)?(\d{2,3})\b/);
  if (bpmMatch) {
    extractedBpm = Math.max(40, Math.min(240, parseInt(bpmMatch[1], 10)));
  } else if (text.includes('very fast') || text.includes('rapid') || text.includes('frantic')) {
    extractedBpm = 160;
  } else if (text.includes('fast') || text.includes('upbeat') || text.includes('energetic')) {
    extractedBpm = 135;
  } else if (text.includes('slow') || text.includes('relaxed') || text.includes('chill')) {
    extractedBpm = 75;
  } else if (text.includes('very slow')) {
    extractedBpm = 60;
  }

  // 3. Musical Key & Tonic Extraction
  let extractedKey = null;
  const keyMatch = text.match(/(?:in the key of|in key of|key of|in)\s+([a-gA-G][#b]?)\s*(major|minor)?\b/) || text.match(/\b([a-gA-G][#b]?)\s+(major|minor)\b/);
  if (keyMatch) {
    const rawKey = keyMatch[1].toUpperCase();
    if (NOTE_MAP[rawKey] !== undefined) {
      extractedKey = (rawKey === 'DB') ? 'C#' : (rawKey === 'EB') ? 'D#' : (rawKey === 'GB') ? 'F#' : (rawKey === 'AB') ? 'G#' : (rawKey === 'BB') ? 'A#' : rawKey;
    }
  }

  // 4. Scale Extraction
  let extractedScale = null;
  const scaleKeywords = [
    { key: 'harmonic minor', scale: 'harmonic_minor' },
    { key: 'melodic minor', scale: 'melodic_minor' },
    { key: 'pentatonic major', scale: 'pentatonic_major' },
    { key: 'pentatonic minor', scale: 'pentatonic_minor' },
    { key: 'pentatonic', scale: 'pentatonic' },
    { key: 'dorian', scale: 'dorian' },
    { key: 'phrygian', scale: 'phrygian' },
    { key: 'lydian', scale: 'lydian' },
    { key: 'mixolydian', scale: 'mixolydian' },
    { key: 'blues', scale: 'blues' },
    { key: 'minor', scale: 'minor' },
    { key: 'major', scale: 'major' }
  ];
  for (const item of scaleKeywords) {
    if (text.includes(item.key)) {
      extractedScale = item.scale;
      break;
    }
  }

  // 5. Mood Extraction
  let extractedMood = null;
  const moodKeywords = ['dark', 'happy', 'sad', 'mysterious', 'tense', 'relaxed', 'energetic', 'melancholy', 'epic', 'creepy', 'peaceful', 'aggressive', 'playful', 'funny', 'dramatic'];
  for (const m of moodKeywords) {
    if (text.includes(m)) {
      extractedMood = m;
      break;
    }
  }

  // 6. Seed Extraction
  let extractedSeed = null;
  const seedMatch = text.match(/seed\s*[:=]?\s*([a-zA-Z0-9_-]+)/);
  if (seedMatch) {
    extractedSeed = seedMatch[1];
  }

  // --- SOUND EFFECT DETECTION ---
  const sfxCategories = [
    { preset: 'cartoon_boing', category: 'comedy', keys: ['boing', 'spring', 'bounce', 'cartoon bounce'] },
    { preset: 'funny_pop', category: 'comedy', keys: ['pop', 'plop', 'bubble pop', 'bubble'] },
    { preset: 'punch_impact', category: 'action', keys: ['punch', 'impact hit', 'smack', 'slap', 'hit sound', 'fist'] },
    { preset: 'falling_sound', category: 'comedy', keys: ['fall', 'falling', 'whistle down', 'slide down', 'drop whistle'] },
    { preset: 'record_scratch', category: 'hiphop', keys: ['record scratch', 'scratch sound', 'turntable scratch', 'dj scratch', 'scratch'] },
    { preset: 'bass_drop', category: 'electronic', keys: ['bass drop', 'sub drop', '808 drop', '808 bass', 'sub boom drop'] },
    { preset: 'dramatic_impact', category: 'cinematic', keys: ['dramatic impact', 'dramatic reveal', 'reveal sound', 'braam', 'cinematic boom', 'orchestral hit', 'reveal', 'impact'] },
    { preset: 'whoosh', category: 'transition', keys: ['whoosh', 'swoosh', 'swish', 'flyby', 'pass by'] },
    { preset: 'glitch', category: 'retro', keys: ['digital glitch', 'stutter', 'static noise', 'digital error', 'glitch'] },
    { preset: 'riser', category: 'buildup', keys: ['riser', 'buildup riser', 'sweep up', 'pitch rise'] },
    { preset: 'suspense_effect', category: 'horror', keys: ['suspense effect', 'suspense sound', 'creepy cue', 'eerie ping', 'horror sting'] },
    { preset: 'retro_coin', category: 'gaming', keys: ['retro coin', 'pickup sound', 'coin sound', 'collect coin', 'coin'] },
    { preset: 'retro_jump', category: 'gaming', keys: ['retro jump', 'jump sound', '8-bit jump', '8bit jump', 'jump'] },
    { preset: 'retro_laser', category: 'gaming', keys: ['laser zap', 'phaser', 'pew pew', 'arcade zap', 'laser'] },
    { preset: 'notification_chime', category: 'ui', keys: ['bell chime', 'notification sound', 'ui ding', 'alert chime', 'chime', 'notification'] },
    { preset: 'comedic_transition', category: 'comedy', keys: ['wah wah', 'fail sound', 'failure trombone', 'sad trombone', 'comedic transition', 'fail'] },
    { preset: 'rain_ambience', category: 'environmental', keys: ['rain', 'rainfall', 'storm rain', 'water drops', 'raining'] },
    { preset: 'wind_gust', category: 'environmental', keys: ['wind', 'wind gust', 'breeze', 'gale', 'howling wind'] },
    { preset: 'thunder_clap', category: 'environmental', keys: ['thunder', 'thunder clap', 'lightning strike', 'thunderstorm', 'rumble'] },
    { preset: 'mechanical_hum', category: 'sci-fi', keys: ['mechanical hum', 'electrical hum', '60hz', 'generator hum', 'engine hum', 'drone hum'] }
  ];

  const isExplicitMusic = text.includes('music') || text.includes('song') || text.includes('theme') || text.includes('beat') || text.includes('track') || text.includes('groove');
  const isExplicitSfx = text.includes('sfx') || text.includes('sound effect') || text.includes('sound') || text.includes('fx');

  // Try matching SFX first if not explicitly marked as music
  if (!isExplicitMusic || isExplicitSfx) {
    for (const item of sfxCategories) {
      if (item.keys.some(k => text.includes(k))) {
        return {
          type: 'sfx',
          preset: item.preset,
          category: item.category,
          durationSeconds: extractedDur || 1.0,
          mood: extractedMood,
          seed: extractedSeed,
          extracted_params: {
            durationSeconds: extractedDur,
            mood: extractedMood,
            seed: extractedSeed
          },
          prompt: promptText,
          method: 'rule_based_procedural_dsp',
          label: 'Rule-Based Procedural DSP Engine',
          description: `Procedurally synthesized sound effect: ${item.preset}`
        };
      }
    }
  }

  // --- MUSIC DETECTION ---
  const musicDefinitions = [
    { genre: '8bit_retro', default_bpm: 136, default_key: 'C', keys: ['8bit', '8-bit', 'chiptune', 'retro game', 'retro', 'arcade'] },
    { genre: 'electronic', default_bpm: 124, default_key: 'F', keys: ['electronic', 'edm', 'synthwave', 'techno', 'house'] },
    { genre: 'comedy', default_bpm: 120, default_key: 'C', keys: ['comedy', 'funny', 'cartoon music', 'ragtime', 'polka', 'oompah'] },
    { genre: 'suspense', default_bpm: 72, default_key: 'D', keys: ['suspense', 'dark', 'horror', 'creepy', 'tension', 'spooky'] },
    { genre: 'cinematic', default_bpm: 90, default_key: 'D', keys: ['cinematic', 'epic', 'orchestral', 'movie', 'soundtrack', 'trailer'] },
    { genre: 'happy', default_bpm: 128, default_key: 'C', keys: ['happy', 'upbeat', 'cheerful', 'joyful', 'bouncy'] },
    { genre: 'dramatic', default_bpm: 80, default_key: 'C', keys: ['dramatic', 'drama', 'intense', 'crescendo'] },
    { genre: 'minimal', default_bpm: 88, default_key: 'C', keys: ['minimal', 'minimalist', 'lofi', 'lo-fi'] },
    { genre: 'ambient', default_bpm: 60, default_key: 'C', keys: ['ambient', 'chill', 'meditation', 'drone', 'soundscape', 'peaceful'] }
  ];

  for (const item of musicDefinitions) {
    if (item.keys.some(k => text.includes(k))) {
      const finalBpm = extractedBpm || item.default_bpm;
      const finalKey = extractedKey || item.default_key;
      const finalDur = extractedDur || 12.0;
      return {
        type: 'music',
        genre: item.genre,
        bpm: finalBpm,
        key: finalKey,
        scale: extractedScale || (item.genre === 'happy' ? 'major' : 'minor'),
        durationSeconds: finalDur,
        mood: extractedMood,
        seed: extractedSeed,
        extracted_params: {
          bpm: extractedBpm,
          key: extractedKey,
          scale: extractedScale,
          durationSeconds: extractedDur,
          mood: extractedMood,
          genre: item.genre,
          seed: extractedSeed
        },
        prompt: promptText,
        method: 'rule_based_procedural_dsp',
        label: 'Rule-Based Procedural DSP Engine',
        description: `Procedurally composed music track: ${item.genre} (${finalBpm} BPM, Key of ${finalKey})`
      };
    }
  }

  // Generic fallback if user explicitly mentions "background music" or "music"
  if (text.includes('background') || text.includes('music') || text.includes('melody') || text.includes('song')) {
    const finalBpm = extractedBpm || 88;
    const finalKey = extractedKey || 'C';
    const finalDur = extractedDur || 12.0;
    return {
      type: 'music',
      genre: 'minimal',
      bpm: finalBpm,
      key: finalKey,
      scale: extractedScale || 'minor',
      durationSeconds: finalDur,
      mood: extractedMood,
      seed: extractedSeed,
      extracted_params: {
        bpm: extractedBpm,
        key: extractedKey,
        scale: extractedScale,
        durationSeconds: extractedDur,
        mood: extractedMood,
        genre: 'minimal',
        seed: extractedSeed
      },
      prompt: promptText,
      method: 'rule_based_procedural_dsp',
      label: 'Rule-Based Procedural DSP Engine',
      description: `Procedurally composed background music (${finalBpm} BPM, Key of ${finalKey})`
    };
  }

  // Return a clear unsupported-prompt response rather than silently generating random fallback audio
  return {
    error: 'UNSUPPORTED_PROMPT',
    supported: false,
    detail: `Prompt "${promptText}" is not recognized as a procedural audio request. Please specify a sound effect (e.g. 'cartoon boing', 'laser zap', 'impact hit') or music instructions (e.g. '120 bpm synthwave in A minor for 10 seconds').`,
    method: 'rule_based_procedural_dsp',
    label: 'Rule-Based Procedural DSP Engine'
  };
}

// ============================================================================
// 5. MULTITRACK MEME AUDIO STUDIO MIXER WITH GENUINE DUCKING
// ============================================================================

/**
 * Mix Multiple Audio Tracks with Offsets, Fades, Trimming, Volume Automation, and Genuine Speech-Triggered Ducking
 */
async function renderMultitrackMix({
  tracks = [],
  outputPath,
  format = 'wav',
  sampleRate = SAMPLE_RATE
}) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('At least one track required for multitrack mixing.');
  }

  const loadedTracks = [];
  let maxSamples = 0;

  // 1. Load, trim, fade, and stage each track
  for (const tr of tracks) {
    let rawBuffer = null;

    if (tr.buffer && tr.buffer instanceof Float32Array) {
      rawBuffer = tr.buffer;
    } else if (tr.file_path && fs.existsSync(tr.file_path)) {
      const rawPcm = execFileSync('ffmpeg.exe', [
        '-i', tr.file_path,
        '-f', 'f32le',
        '-ac', '1',
        '-ar', String(sampleRate),
        '-'
      ], { maxBuffer: 100 * 1024 * 1024 });
      rawBuffer = new Float32Array(rawPcm.buffer, rawPcm.byteOffset, rawPcm.length / 4);
    } else if (tr.file_name) {
      const candidatePath = path.isAbsolute(tr.file_name) ? tr.file_name : path.join(AUDIO_DIR, path.basename(tr.file_name));
      if (fs.existsSync(candidatePath)) {
        const rawPcm = execFileSync('ffmpeg.exe', [
          '-i', candidatePath,
          '-f', 'f32le',
          '-ac', '1',
          '-ar', String(sampleRate),
          '-'
        ], { maxBuffer: 100 * 1024 * 1024 });
        rawBuffer = new Float32Array(rawPcm.buffer, rawPcm.byteOffset, rawPcm.length / 4);
      }
    } else if (tr.sfx_preset && SoundEffectGenerators[tr.sfx_preset]) {
      rawBuffer = SoundEffectGenerators[tr.sfx_preset]();
      if (rawBuffer && rawBuffer.length > 0) {
        rawBuffer = normalizeAndLimit(rawBuffer, -1.0);
      }
    } else if (tr.music_genre) {
      rawBuffer = generateProceduralMusic({
        genre: tr.music_genre,
        bpm: tr.bpm || 120,
        durationSeconds: tr.duration || 10.0,
        key: tr.key || 'C',
        seed: tr.seed !== undefined ? tr.seed : 1337,
        sampleRate
      });
    }

    if (!rawBuffer || rawBuffer.length === 0) continue;

    // A. Trimming
    const trimStartSec = Math.max(0, parseFloat(tr.trim_start || 0));
    const trimStartSamples = Math.floor(trimStartSec * sampleRate);
    let activeSamples = Math.max(0, rawBuffer.length - trimStartSamples);

    if (tr.trim_duration !== undefined || tr.duration !== undefined) {
      const durSec = parseFloat(tr.trim_duration !== undefined ? tr.trim_duration : tr.duration);
      if (durSec > 0) {
        activeSamples = Math.min(activeSamples, Math.floor(durSec * sampleRate));
      }
    }
    if (activeSamples <= 0) continue;

    const clipBuf = new Float32Array(activeSamples);
    for (let i = 0; i < activeSamples; i++) {
      clipBuf[i] = rawBuffer[trimStartSamples + i];
    }

    // B. Fades (Smooth Cosine Curves)
    const fadeInMs = parseFloat(tr.fade_in_ms || 0);
    const fadeOutMs = parseFloat(tr.fade_out_ms || 0);
    const fadeInSamples = Math.floor((fadeInMs / 1000) * sampleRate);
    const fadeOutSamples = Math.floor((fadeOutMs / 1000) * sampleRate);

    for (let i = 0; i < activeSamples; i++) {
      let g = 1.0;
      if (fadeInSamples > 0 && i < fadeInSamples) {
        g *= 0.5 * (1.0 - Math.cos((Math.PI * i) / fadeInSamples));
      }
      const fromEnd = activeSamples - 1 - i;
      if (fadeOutSamples > 0 && fromEnd < fadeOutSamples) {
        g *= 0.5 * (1.0 - Math.cos((Math.PI * fromEnd) / fadeOutSamples));
      }
      clipBuf[i] *= g;
    }

    // C. Volume & Keyframed Automation
    const baseVol = Math.max(0, Math.min(parseFloat(tr.volume !== undefined ? tr.volume : 1.0), 3.0));
    if (Array.isArray(tr.volume_automation) && tr.volume_automation.length > 0) {
      const kfs = tr.volume_automation.map(pt => ({
        time: parseFloat(pt.time !== undefined ? pt.time : (pt.time_sec !== undefined ? pt.time_sec : 0)),
        volume: Math.max(0, Math.min(3.0, parseFloat(pt.volume !== undefined ? pt.volume : (pt.gain !== undefined ? pt.gain : 1.0))))
      })).sort((a, b) => a.time - b.time);

      if (kfs.length === 1) {
        for (let i = 0; i < activeSamples; i++) {
          clipBuf[i] *= kfs[0].volume;
        }
      } else {
        for (let i = 0; i < activeSamples; i++) {
          const t = i / sampleRate;
          let volAtT = baseVol;
          if (t <= kfs[0].time) {
            volAtT = kfs[0].volume;
          } else if (t >= kfs[kfs.length - 1].time) {
            volAtT = kfs[kfs.length - 1].volume;
          } else {
            for (let k = 0; k < kfs.length - 1; k++) {
              if (t >= kfs[k].time && t <= kfs[k + 1].time) {
                const span = kfs[k + 1].time - kfs[k].time;
                const frac = span > 0.00001 ? (t - kfs[k].time) / span : 0;
                volAtT = kfs[k].volume + frac * (kfs[k + 1].volume - kfs[k].volume);
                break;
              }
            }
          }
          clipBuf[i] *= volAtT;
        }
      }
    } else {
      for (let i = 0; i < activeSamples; i++) {
        clipBuf[i] *= baseVol;
      }
    }

    // Timeline positioning
    const startSec = Math.max(0, parseFloat(tr.start_time || 0));
    const startSample = Math.floor(startSec * sampleRate);
    const endSample = startSample + clipBuf.length;
    if (endSample > maxSamples) maxSamples = endSample;

    // Track classification for speech ducking
    // Explicit user settings MUST strictly override automatic classification
    let isSpeech = false;
    if (tr.is_speech !== undefined && tr.is_speech !== null) {
      isSpeech = Boolean(tr.is_speech);
    } else {
      isSpeech = Boolean(
        tr.type === 'speech' ||
        (tr.name && /speech|voice|vocal|dialogue/i.test(tr.name))
      );
    }

    let isDucked = false;
    if (tr.is_ducked !== undefined && tr.is_ducked !== null) {
      isDucked = Boolean(tr.is_ducked);
    } else {
      isDucked = Boolean(
        tr.type === 'music' ||
        Boolean(tr.music_genre)
      );
    }

    loadedTracks.push({
      name: tr.name || 'Track',
      buffer: clipBuf,
      startSample,
      volume: baseVol,
      isSpeech,
      isDucked
    });
  }

  if (loadedTracks.length === 0) {
    throw new Error('No valid audio clips could be decoded for mixing.');
  }

  // 2. Genuine Speech-Triggered Background Music Ducking
  let duckingApplied = false;
  let maxAttenuationDb = 0;
  const speechTracks = loadedTracks.filter(t => t.isSpeech);
  const duckedTracks = loadedTracks.filter(t => t.isDucked);

  if (speechTracks.length > 0 && duckedTracks.length > 0) {
    // A. Build composite speech amplitude envelope
    const rawSpeechEnv = new Float32Array(maxSamples);
    for (const st of speechTracks) {
      const end = Math.min(maxSamples, st.startSample + st.buffer.length);
      for (let i = st.startSample, j = 0; i < end; i++, j++) {
        const abs = Math.abs(st.buffer[j]);
        if (abs > rawSpeechEnv[i]) rawSpeechEnv[i] = abs;
      }
    }

    // B. Smooth envelope follower (attack ~15ms, release ~250ms)
    const attackCoeff = Math.exp(-1.0 / (0.015 * sampleRate));
    const releaseCoeff = Math.exp(-1.0 / (0.250 * sampleRate));
    const smoothedEnv = new Float32Array(maxSamples);
    let envVal = 0.0;
    for (let i = 0; i < maxSamples; i++) {
      const s = rawSpeechEnv[i];
      if (s > envVal) {
        envVal = attackCoeff * envVal + (1.0 - attackCoeff) * s;
      } else {
        envVal = releaseCoeff * envVal + (1.0 - releaseCoeff) * s;
      }
      smoothedEnv[i] = envVal;
    }

    // C. Calculate attenuation curve (~10.5 dB ducking during speech)
    const threshold = 0.025; // -32 dBFS
    const duckDepth = 0.70;  // 70% reduction in linear amplitude
    const duckCurve = new Float32Array(maxSamples);
    let maxAtten = 0.0;

    for (let i = 0; i < maxSamples; i++) {
      const env = smoothedEnv[i];
      if (env > threshold) {
        const factor = Math.min(1.0, (env - threshold) / 0.12);
        const atten = duckDepth * factor;
        if (atten > maxAtten) maxAtten = atten;
        duckCurve[i] = 1.0 - atten;
      } else {
        duckCurve[i] = 1.0;
      }
    }

    // D. Apply ducking attenuation to background music
    if (maxAtten > 0.05) {
      duckingApplied = true;
      maxAttenuationDb = Math.round(-20 * Math.log10(Math.max(0.001, 1.0 - maxAtten)) * 10) / 10;
      for (const dt of duckedTracks) {
        const end = Math.min(maxSamples, dt.startSample + dt.buffer.length);
        for (let i = dt.startSample, j = 0; i < end; i++, j++) {
          dt.buffer[j] *= duckCurve[i];
        }
      }
    }
  }

  // 3. Mix all tracks into master buffer
  const masterMix = new Float32Array(maxSamples);
  for (const tr of loadedTracks) {
    const end = Math.min(maxSamples, tr.startSample + tr.buffer.length);
    for (let i = tr.startSample, j = 0; i < end; i++, j++) {
      masterMix[i] += tr.buffer[j];
    }
  }

  // 4. Master Normalization & Brickwall Limiting
  normalizeAndLimit(masterMix, -1.0);

  // 5. Export WAV
  const wavBuffer = floatToWavBuffer(masterMix, sampleRate);
  const tempWav = outputPath.endsWith('.wav') ? outputPath : outputPath + '.tmp.wav';
  fs.writeFileSync(tempWav, wavBuffer);

  // 6. Transcode to MP3 if requested
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
    trackCount: loadedTracks.length,
    sampleRate,
    duckingApplied,
    maxAttenuationDb
  };
}

module.exports = {
  SAMPLE_RATE,
  createRng,
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
  SynthInstruments,
  SynthDrums,
  SCALES,
  NOTE_MAP,
  parseProgression,
  generateProceduralMusic,
  parseProceduralPrompt,
  renderMultitrackMix,
  PROCEDURAL_DIR,
  AUDIO_DIR
};
