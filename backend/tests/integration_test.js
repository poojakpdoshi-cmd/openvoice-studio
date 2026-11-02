/**
 * OpenVoice Studio — Comprehensive Integration Test
 * Verifies all API endpoints and end-to-end audio pipelines.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Spin up server in-process
process.env.PORT = 8001;
process.env.HOST = '127.0.0.1';

// Require server
require('../server.js');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 8001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('[Test] Waiting 1s for server socket initialization...');
  await new Promise(r => setTimeout(r, 1000));

  console.log('[Test 1] Testing Health Endpoint...');
  const health = await request('GET', '/api/health');
  console.log('-> Health Status:', health.data.status, 'Version:', health.data.version);
  if (health.data.status !== 'healthy') throw new Error('Health check failed');

  console.log('[Test 2] Testing Hardware Detection...');
  const hw = await request('GET', '/api/hardware');
  console.log('-> CPUs:', hw.data.cpu_count, 'OS:', hw.data.os, 'Tier:', hw.data.performance_tier);
  if (!hw.data.cpu_count) throw new Error('Hardware detection failed');

  console.log('[Test 3] Testing Voice Library Catalog (100+ voices requirement)...');
  const voices = await request('GET', '/api/voices');
  console.log('-> Total catalog voices in database:', voices.data.count);
  if (voices.data.count < 100) throw new Error(`Voice catalog too small: ${voices.data.count}`);

  console.log('[Test 4] Testing Text Chunking & Pause Token Parser...');
  const chunkRes = await request('POST', '/api/tts/chunk', {
    text: "Sentence one. [pause:500ms] Sentence two is longer and should be chunked properly.",
    max_chars: 50
  });
  console.log('-> Chunks produced:', chunkRes.data.chunk_count, 'Words:', chunkRes.data.stats.words);
  if (chunkRes.data.chunk_count < 2) throw new Error('Chunking failed');

  console.log('[Test 5] Testing Speech Synthesis Generation (/api/tts/generate)...');
  const genRes = await request('POST', '/api/tts/generate', {
    text: "Welcome to OpenVoice Studio. This is genuine local synthetic speech generated without paid APIs.",
    voice_id: "af_heart",
    speed: 1.0,
    pitch: 0.0,
    format: "wav"
  });
  console.log('-> Generated file:', genRes.data.file_name);
  console.log('-> Duration:', genRes.data.duration_seconds, 'seconds');
  console.log('-> Quality Rating:', genRes.data.quality?.quality_rating);
  if (!genRes.data.audio_url || genRes.data.duration_seconds <= 0) {
    throw new Error('Speech synthesis failed');
  }

  console.log('[Test 6] Testing Custom Voice Studio Validation...');
  const valRes = await request('POST', '/api/clone/validate');
  console.log('-> Acoustic Analysis Rating:', valRes.data.analysis?.quality_rating);
  console.log('-> Estimated SNR:', valRes.data.analysis?.estimated_snr_db, 'dB');
  if (!valRes.data.analysis?.is_valid) throw new Error('Voice validation failed');

  console.log('[Test 7] Testing Custom Voice Cloning with Explicit Biometric Consent...');
  const cloneRes = await request('POST', '/api/clone/create', {
    name: "Dr. Alexander Voice",
    consent_confirmed: true,
    consent_name: "Dr. Alexander Miller",
    source_language: "en",
    gender: "Male",
    description: "Personal cloned profile for scientific lectures"
  });
  console.log('-> Custom Profile Created:', cloneRes.data.id, 'Preview URL:', cloneRes.data.preview_audio_url);
  if (!cloneRes.data.id || !cloneRes.data.consent_record?.confirmed) {
    throw new Error('Voice cloning creation failed');
  }

  console.log('[Test 8] Testing Multi-Voice Dialogue Studio...');
  const projRes = await request('POST', '/api/projects', {
    title: "AI Dialogue Project",
    description: "Two-speaker demonstration"
  });
  const projId = projRes.data.id;
  await request('POST', `/api/projects/${projId}/segments`, {
    speaker_label: "Narrator",
    voice_id: "af_heart",
    text_content: "Welcome to the debate.",
    pause_after_ms: 300
  });
  await request('POST', `/api/projects/${projId}/segments`, {
    speaker_label: "Guest",
    voice_id: "am_adam",
    text_content: "Thank you for having me.",
    pause_after_ms: 400
  });
  const renderRes = await request('POST', `/api/projects/${projId}/render`);
  console.log('-> Multi-Voice Continuous Audio Rendered:', renderRes.data.audio_url);
  console.log('-> Duration:', renderRes.data.duration_seconds, 'seconds, Segments:', renderRes.data.segment_count);
  if (!renderRes.data.audio_url) throw new Error('Multi-voice render failed');

  console.log('[Test 9] Testing Audio Workspace Trimming & Export...');
  const trimRes = await request('POST', '/api/audio/trim', {
    file_name: genRes.data.file_name,
    start_time: 0.5,
    end_time: 2.5
  });
  console.log('-> Trimmed File:', trimRes.data.file_name, 'New Duration:', trimRes.data.duration);
  if (!trimRes.data.audio_url) throw new Error('Audio trimming failed');

  const exportRes = await request('POST', '/api/audio/export', {
    file_name: genRes.data.file_name,
    format: "mp3",
    sample_rate: 24000
  });
  console.log('-> Exported Broadcast MP3:', exportRes.data.file_name, 'Format:', exportRes.data.format);
  if (!exportRes.data.export_url) throw new Error('Audio export failed');

  console.log('========================================================');
  console.log('  🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

