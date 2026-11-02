/**
 * OpenVoice Studio — Audit Upgrade Verification Suite
 * Tests:
 * 1. Style & Emotion DSP Integration in TTS
 * 2. Uninstalled Voice Protection (No silent fallbacks)
 * 3. Procedural Environmental SFX Synthesis
 * 4. Autocorrelation Pitch & Voice Cloning Acoustic Features
 * 5. Segment-level Multi-Speaker Rendering
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');

const { server, db } = require('../server');
const neuralEngine = require('../neural_engine');
const proceduralEngine = require('../procedural_engine');

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
      req.emit('data', Buffer.from(JSON.stringify(body)));
    }
    req.emit('end');
  });
}

async function runAuditUpgradeTests() {
  console.log('================================================================');
  console.log('       OPENVOICE STUDIO — AUDIT UPGRADE VERIFICATION SUITE       ');
  console.log('================================================================\n');

  try {
    // 1. Speaking Styles API Check
    console.log('--- 1. SPEAKING STYLES & EMOTIONS API ---');
    const stylesRes = await request('GET', '/api/tts/styles');
    assert.strictEqual(stylesRes.status, 200);
    assert(stylesRes.data.count >= 20, 'Must have at least 20 speaking styles');
    assert(stylesRes.data.styles.whispering, 'Whispering style must exist');
    assert(stylesRes.data.styles.news, 'Broadcast news style must exist');
    console.log(`✅ [PASS] /api/tts/styles returned ${stylesRes.data.count} calibrated styles`);

    // 2. TTS Generation with Style and Intensity
    console.log('\n--- 2. STYLED NEURAL TTS GENERATION ---');
    const genRes = await request('POST', '/api/tts/generate', {
      text: 'OpenVoice Studio is now upgraded with advanced emotion modeling.',
      voice_id: 'af_heart',
      style: 'energetic',
      style_intensity: 1.5,
      format: 'wav'
    });
    assert.strictEqual(genRes.status, 200);
    assert(genRes.data.audio_url, 'Must return audio_url');
    assert.strictEqual(genRes.data.style, 'energetic');
    assert.strictEqual(genRes.data.style_intensity, 1.5);
    console.log(`✅ [PASS] Synthesized energetic style with 1.5x intensity (${genRes.data.duration_seconds}s)`);

    // 3. Uninstalled Voice Protection (Strict honest capability advertising)
    console.log('\n--- 3. UNINSTALLED MODEL SAFETY & ERROR REPORTING ---');
    const uninstalledVoice = db.prepare('SELECT id FROM voices WHERE is_installed = 0 LIMIT 1').get();
    if (uninstalledVoice) {
      const offlineRes = await request('POST', '/api/tts/generate', {
        text: 'This should not silently substitute.',
        voice_id: uninstalledVoice.id
      });
      assert.strictEqual(offlineRes.status, 400, 'Must return 400 for uninstalled voice');
      assert(offlineRes.data.detail.includes('not currently installed locally'), 'Detail must indicate model is not installed');
      console.log(`✅ [PASS] Successfully rejected uninstalled voice "${uninstalledVoice.id}" with explicit 400 error`);
    }

    // 4. Procedural Environmental SFX Synthesis
    console.log('\n--- 4. PROCEDURAL ENVIRONMENTAL SOUND SYNTHESIS ---');
    const envPresets = ['rain_ambience', 'wind_gust', 'thunder_clap', 'mechanical_hum'];
    for (const preset of envPresets) {
      assert(typeof proceduralEngine.SoundEffectGenerators[preset] === 'function', `Preset ${preset} must exist`);
      const sfxRes = await request('POST', '/api/procedural/sfx', {
        preset: preset,
        params: { duration: 1.0 }
      });
      assert.strictEqual(sfxRes.status, 200);
      assert(sfxRes.data.duration_seconds > 0.5);
      console.log(`✅ [PASS] Procedural SFX [${preset}] synthesized successfully (${sfxRes.data.duration_seconds}s)`);
    }

    // 5. Environmental SFX in Prompt Parser
    console.log('\n--- 5. ENVIRONMENTAL PROMPT PARSING ---');
    const parseRes = proceduralEngine.parseProceduralPrompt('generate realistic storm rain sound for 3 seconds');
    assert.strictEqual(parseRes.type, 'sfx');
    assert.strictEqual(parseRes.preset, 'rain_ambience');
    console.log(`✅ [PASS] Parsed "storm rain" to preset "${parseRes.preset}" with category "${parseRes.category}"`);

    // 6. Voice Cloning with Real F0 Pitch Extraction
    console.log('\n--- 6. ZERO-SHOT VOICE CLONING WITH REAL F0 EXTRACTION ---');
    const sampleRefWav = path.join(__dirname, '..', '..', 'storage', 'audio', 'test_ref_f0.wav');
    await neuralEngine.synthesizeKokoro('Acoustic pitch calibration sample.', 'am_adam', sampleRefWav);
    
    const cloneRes = await request('POST', '/api/clone/create', {
      name: 'Adam Reference Clone',
      gender: 'Male',
      consent_confirmed: true,
      consent_name: 'Lead Audio Engineer',
      reference_file: sampleRefWav
    });
    assert.strictEqual(cloneRes.status, 200);
    assert(cloneRes.data.acoustic_features, 'Acoustic features must be populated');
    assert(cloneRes.data.acoustic_features.estimated_f0_hz > 0, 'Estimated F0 must be non-zero');
    console.log(`✅ [PASS] Voice clone acoustic profile created with estimated F0: ${cloneRes.data.acoustic_features.estimated_f0_hz.toFixed(1)} Hz`);

    // Clean up temporary clone
    await request('DELETE', `/api/clone/profiles/${cloneRes.data.id}`);

    // 7. Multi-Speaker Segment-Level Rendering Endpoint
    console.log('\n--- 7. MULTI-SPEAKER SEGMENT-LEVEL RENDERING ---');
    const projRes = await request('POST', '/api/projects', { title: 'Audit Verification Project' });
    const projId = projRes.data.id;

    const segRes = await request('POST', `/api/projects/${projId}/segments`, {
      speaker_label: 'Host',
      voice_id: 'af_heart',
      text_content: 'This single sentence is rendered individually.',
      pause_after_ms: 300
    });
    const segId = segRes.data.id;

    const renderSegRes = await request('POST', `/api/projects/${projId}/segments/${segId}/render`);
    assert.strictEqual(renderSegRes.status, 200);
    assert.strictEqual(renderSegRes.data.segment_id, segId);
    assert(renderSegRes.data.segment_audio_url, 'Must return segment audio URL');
    assert(renderSegRes.data.project_audio_url, 'Must return updated project master audio URL');
    console.log(`✅ [PASS] Segment rendered independently: ${renderSegRes.data.segment_audio_url}`);

    console.log('\n================================================================');
    console.log('   🎉 ALL 7 AUDIT UPGRADE SUBSYSTEM VERIFICATIONS PASSED!       ');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    throw err;
  }
}

runAuditUpgradeTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
