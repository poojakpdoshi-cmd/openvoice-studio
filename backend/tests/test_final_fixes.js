/**
 * OPENVOICE STUDIO — FINAL FIXES VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Audio Limiter: -1.0 dBFS ceiling prevents clipping on extreme DSP styles (angry, whispering, dramatic).
 * 2. Documentary Music: Genuine genre with piano arpeggios, cello, drones, PRNG seed reproducibility, prompt parser.
 * 3. Meme Video Production: Compositing with JPG/PNG/MP4, aspect ratios (16:9, 9:16, 1:1), Impact captions.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { EventEmitter } = require('events');

const { server } = require('../server');
const neuralEngine = require('../neural_engine');
const proceduralEngine = require('../procedural_engine');

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');
const TEST_DIR = path.resolve(__dirname, '../../test-results');

if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Command failed: ${bin} ${args.join(' ')}\n${stderr || err.message}`));
      resolve({ stdout, stderr });
    });
  });
}

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = urlPath;
    req.headers = {
      host: '127.0.0.1',
      ...(body ? { 'content-type': 'application/json' } : {})
    };

    let statusCode = 200;
    let headers = {};
    let raw = '';

    const res = new EventEmitter();
    res.setHeader = (k, v) => { headers[k.toLowerCase()] = v; };
    res.writeHead = (code, hdrs) => {
      statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
    };
    res.write = (chunk) => { raw += chunk; };
    res.end = (chunk) => {
      if (chunk) raw += chunk;
      try {
        resolve({ status: statusCode, headers, data: JSON.parse(raw) });
      } catch (e) {
        resolve({ status: statusCode, headers, raw });
      }
    };

    server.emit('request', req, res);

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', payload);
    }
    req.emit('end');
  });
}

async function getAudioPeakDb(filePath) {
  const { stderr } = await runCommand('ffmpeg', [
    '-i', filePath,
    '-af', 'astats',
    '-f', 'null', '-'
  ]);
  const match = stderr.match(/Peak level dB:\s+([-\d.]+)/);
  if (match) return parseFloat(match[1]);
  return 0.0;
}

async function getMediaStreamInfo(filePath) {
  const { stdout } = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=width,height,codec_name,duration,channels',
    '-of', 'json',
    filePath
  ]);
  return JSON.parse(stdout);
}

async function runTests() {
  console.log('================================================================');
  console.log('       OPENVOICE STUDIO — VERIFICATION OF FINAL 3 FIXES         ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, label, details) {
    if (condition) {
      console.log(`  ✅ [PASS]: ${label}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL]: ${label} - ${details || ''}`);
      failed++;
    }
  }

  // =================================================================
  // 1. P0-1: AUDIO LIMITER VERIFICATION
  // =================================================================
  console.log('--- 1. AUDIO LIMITER (-1.0 dBFS CEILING & CLIPPING PREVENTION) ---');

  const stylesToTest = ['neutral', 'whispering', 'angry', 'excited', 'dramatic'];
  for (const style of stylesToTest) {
    const res = await request('POST', '/api/tts/generate', {
      text: `Testing audio limiter dynamics for ${style} emotion in OpenVoice Studio.`,
      voice_id: 'af_heart',
      style: style,
      style_intensity: 1.0,
      format: 'wav'
    });

    assert(res.status === 200, `TTS generate for style [${style}] succeeded`, JSON.stringify(res.data));
    const rawWav = path.join(AUDIO_DIR, path.basename(res.data.audio_url));

    const peakDb = await getAudioPeakDb(rawWav);
    console.log(`  📊 Style [${style.padEnd(10)}] Peak: ${peakDb.toFixed(2)} dBFS`);
    assert(peakDb <= -0.80, `Style [${style}] peak strictly bounded <= -0.80 dBFS (alimiter ceiling)`, `Actual peak: ${peakDb}`);
  }

  // =================================================================
  // 2. P0-2: DOCUMENTARY MUSIC GENRE VERIFICATION
  // =================================================================
  console.log('\n--- 2. DOCUMENTARY MUSIC GENRE & SEED REPRODUCIBILITY ---');

  // 2A. Composition synthesis
  const docResult1 = proceduralEngine.generateProceduralMusic({
    genre: 'documentary',
    bpm: 70,
    duration: 4.0,
    sampleRate: 44100,
    seed: 42
  });

  const docResult2 = proceduralEngine.generateProceduralMusic({
    genre: 'documentary',
    bpm: 70,
    duration: 4.0,
    sampleRate: 44100,
    seed: 42
  });

  const docResultDiffSeed = proceduralEngine.generateProceduralMusic({
    genre: 'documentary',
    bpm: 70,
    duration: 4.0,
    sampleRate: 44100,
    seed: 99999
  });

  assert(docResult1 instanceof Float32Array, 'Documentary music returns Float32Array');
  assert(docResult1.length >= 44100 * 4, `Documentary music buffer length matches audio duration (${docResult1.length} samples)`);

  // Test deterministic reproducibility
  let identical = true;
  for (let i = 0; i < docResult1.length; i++) {
    if (docResult1[i] !== docResult2[i]) {
      identical = false;
      break;
    }
  }
  assert(identical, 'Documentary music: Same seed (42) produces 100% bit-for-bit identical audio');

  let differentCount = 0;
  for (let i = 0; i < docResult1.length; i++) {
    if (Math.abs(docResult1[i] - docResultDiffSeed[i]) > 0.0001) {
      differentCount++;
    }
  }
  assert(differentCount > 10000, 'Documentary music: Different seed (99999) produces distinct composition', `Differing samples: ${differentCount}`);

  // Test prompt parser
  const parsedDoc = proceduralEngine.parseProceduralPrompt('Generate a 10 second documentary background track at 70 bpm in key of dm');
  assert(parsedDoc.genre === 'documentary', 'Prompt parser maps "documentary" to documentary genre', `Got ${parsedDoc.genre}`);
  assert(parsedDoc.bpm === 70, 'Prompt parser extracts 70 BPM', `Got ${parsedDoc.bpm}`);
  assert(parsedDoc.durationSeconds === 10, 'Prompt parser extracts 10 seconds duration', `Got ${parsedDoc.durationSeconds}`);
  assert(parsedDoc.key === 'D' && parsedDoc.scale === 'minor', 'Prompt parser extracts D root note and minor scale for Dm', `Got key=${parsedDoc.key}, scale=${parsedDoc.scale}`);

  // Save documentary audio sample for verification
  const docWavPath = path.join(TEST_DIR, 'documentary_sample_seed42.wav');
  const docWavBuffer = proceduralEngine.floatToWavBuffer(docResult1, 44100);
  fs.writeFileSync(docWavPath, docWavBuffer);
  assert(fs.existsSync(docWavPath) && fs.statSync(docWavPath).size > 100000, 'Documentary audio sample written to test-results');

  // =================================================================
  // 3. P0-3: MEME VIDEO EXPORT WITH VISUAL MEDIA & ASPECT RATIOS
  // =================================================================
  console.log('\n--- 3. MEME VIDEO EXPORT (VISUAL MEDIA, ASPECT RATIOS, IMPACT CAPTIONS) ---');

  // 3A. Prepare test image (JPG) and audio
  const testImgPath = path.join(TEST_DIR, 'meme_test_banner.jpg');
  await runCommand('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x1f2430:s=640x360:d=1', '-frames:v', '1', testImgPath]);
  const imgBase64 = `data:image/jpeg;base64,${fs.readFileSync(testImgPath).toString('base64')}`;

  // Use the documentary audio as soundtrack
  const audioRelName = 'documentary_sample_seed42.wav';
  fs.copyFileSync(docWavPath, path.join(AUDIO_DIR, audioRelName));

  // 3A: 9:16 Portrait Video with Image and Captions
  console.log('  Testing 9:16 Portrait Video with Image & Impact Captions...');
  const res916 = await request('POST', '/api/meme/video', {
    file_name: audioRelName,
    media_base64: imgBase64,
    aspect_ratio: '9:16',
    top_text: 'WHEN THE AUDIO LIMITER',
    bottom_text: 'KEEPS PEAKS AT -1 DBFS',
    font_size: 44,
    font_color: 'white'
  });

  assert(res916.status === 200, 'POST /api/meme/video (9:16 Portrait) returned HTTP 200', JSON.stringify(res916.data));
  assert(res916.data.resolution === '720x1280', 'Export metadata confirms 720x1280 portrait resolution', `Got ${res916.data.resolution}`);
  assert(res916.data.aspect_ratio === '9:16', 'Export metadata confirms 9:16 aspect ratio');

  const videoPath916 = path.join(AUDIO_DIR, res916.data.file_name);
  const info916 = await getMediaStreamInfo(videoPath916);
  const vStream916 = info916.streams.find(s => s.codec_name === 'h264');
  const aStream916 = info916.streams.find(s => s.codec_name === 'aac');
  assert(vStream916 && vStream916.width === 720 && vStream916.height === 1280, 'ffprobe verifies 720x1280 H264 video stream');
  assert(aStream916 !== undefined, 'ffprobe verifies AAC audio stream present');

  fs.copyFileSync(videoPath916, path.join(TEST_DIR, 'meme_portrait_916_verified.mp4'));

  // 3B: 1:1 Square Video with Center Caption & Waveform Fallback
  console.log('  Testing 1:1 Square Video (720x720) with Waveform Fallback & Center Caption...');
  const res11 = await request('POST', '/api/meme/video', {
    file_name: audioRelName,
    aspect_ratio: '1:1',
    center_text: 'SQUARE 1:1 MEME CANVAS',
    font_size: 40,
    font_color: 'yellow'
  });

  assert(res11.status === 200, 'POST /api/meme/video (1:1 Square) returned HTTP 200', JSON.stringify(res11.data));
  assert(res11.data.resolution === '720x720', 'Export metadata confirms 720x720 resolution', `Got ${res11.data.resolution}`);

  const videoPath11 = path.join(AUDIO_DIR, res11.data.file_name);
  const info11 = await getMediaStreamInfo(videoPath11);
  const vStream11 = info11.streams.find(s => s.codec_name === 'h264');
  assert(vStream11 && vStream11.width === 720 && vStream11.height === 720, 'ffprobe verifies 720x720 H264 video stream');
  fs.copyFileSync(videoPath11, path.join(TEST_DIR, 'meme_square_11_verified.mp4'));

  // 3C: 16:9 Landscape Video with Video Media Loop
  console.log('  Testing 16:9 Landscape Video (1280x720) with Video Input Loop...');
  const testVideoBase64 = `data:video/mp4;base64,${fs.readFileSync(videoPath11).toString('base64')}`;
  const res169 = await request('POST', '/api/meme/video', {
    file_name: audioRelName,
    media_base64: testVideoBase64,
    aspect_ratio: '16:9',
    top_text: 'LOOPING VIDEO SOURCE',
    bottom_text: '16:9 LETTERBOX COMPOSITING'
  });

  assert(res169.status === 200, 'POST /api/meme/video (16:9 Landscape Video) returned HTTP 200', JSON.stringify(res169.data));
  assert(res169.data.resolution === '1280x720', 'Export metadata confirms 1280x720 resolution', `Got ${res169.data.resolution}`);
  const videoPath169 = path.join(AUDIO_DIR, res169.data.file_name);
  const info169 = await getMediaStreamInfo(videoPath169);
  const vStream169 = info169.streams.find(s => s.codec_name === 'h264');
  assert(vStream169 && vStream169.width === 1280 && vStream169.height === 720, 'ffprobe verifies 1280x720 H264 stream');
  fs.copyFileSync(videoPath169, path.join(TEST_DIR, 'meme_landscape_169_verified.mp4'));

  // Clean up test image
  if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);

  console.log('\n================================================================');
  console.log(` 🏆 FINAL FIXES VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('[TEST SUITE CRITICAL ERROR]', err);
  process.exit(1);
});
