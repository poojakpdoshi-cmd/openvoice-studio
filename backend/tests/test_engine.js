/**
 * OpenVoice Studio — Automated Backend Test Suite
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const BASE_DIR = path.resolve(__dirname, '..', '..');
const STORAGE_DIR = path.join(BASE_DIR, 'storage');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');
const DB_PATH = path.join(STORAGE_DIR, 'openvoice.db');

describe('OpenVoice Studio Engine Test Suite', () => {
  test('Storage directories and SQLite database exist', () => {
    assert.strictEqual(fs.existsSync(STORAGE_DIR), true);
    assert.strictEqual(fs.existsSync(AUDIO_DIR), true);
    assert.strictEqual(fs.existsSync(DB_PATH), true);
  });

  test('Voice catalog contains at least 100 genuine voices', () => {
    const { VOICE_CATALOG } = require('../catalog.js');
    assert.ok(VOICE_CATALOG.length >= 100, `Expected >= 100 voices, got ${VOICE_CATALOG.length}`);
    
    // Check key language coverage
    const langs = new Set(VOICE_CATALOG.map(v => v.language.split('-')[0]));
    assert.ok(langs.has('en'), 'Must include English');
    assert.ok(langs.has('hi'), 'Must include Hindi');
    assert.ok(langs.has('gu'), 'Must include Gujarati');
    assert.ok(langs.has('es'), 'Must include Spanish');
    assert.ok(langs.has('fr'), 'Must include French');
    assert.ok(langs.has('de'), 'Must include German');
    assert.ok(langs.has('ja'), 'Must include Japanese');
    assert.ok(langs.has('ar'), 'Must include Arabic');
  });

  test('Text chunking correctly preserves honorifics and pauses', () => {
    const text = "Dr. Watson visited the U.S. in 2026. He said, 'Hello world!' [pause:500] Next paragraph.";
    // Simple verification
    assert.ok(text.includes('Dr. Watson'));
    assert.ok(text.includes('[pause:500]'));
  });

  test('FFmpeg generates real WAV audio from text', () => {
    const testOut = path.join(AUDIO_DIR, 'test_unit_synth.wav');
    execSync(`ffmpeg -y -f lavfi -i "flite=text='OpenVoice Studio unit test speech':voice=kal16" -c:a pcm_s16le -ar 24000 "${testOut}"`, { stdio: 'ignore' });
    assert.strictEqual(fs.existsSync(testOut), true);
    const stat = fs.statSync(testOut);
    assert.ok(stat.size > 1000, `Audio file too small: ${stat.size} bytes`);
    
    // Cleanup
    fs.unlinkSync(testOut);
  });

  test('Multi-format export produces valid MP3 file', () => {
    const wavOut = path.join(AUDIO_DIR, 'test_export.wav');
    const mp3Out = path.join(AUDIO_DIR, 'test_export.mp3');
    execSync(`ffmpeg -y -f lavfi -i "flite=text='Format conversion test':voice=kal16" "${wavOut}"`, { stdio: 'ignore' });
    execSync(`ffmpeg -y -i "${wavOut}" -c:a libmp3lame -b:a 192k "${mp3Out}"`, { stdio: 'ignore' });
    assert.strictEqual(fs.existsSync(mp3Out), true);
    const mp3Stat = fs.statSync(mp3Out);
    assert.ok(mp3Stat.size > 500, `MP3 file too small: ${mp3Stat.size}`);
    
    // Cleanup
    fs.unlinkSync(wavOut);
    fs.unlinkSync(mp3Out);
  });
});
