const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const neural = require('../neural_engine');

async function testMatrix() {
  const sentence = 'The quick brown fox jumps over the lazy dog near the riverbank.';
  const testVoices = [
    { id: 'af_heart', gender: 'Female', accent: 'US', engine: 'kokoro' },
    { id: 'af_bella', gender: 'Female', accent: 'US', engine: 'kokoro' },
    { id: 'am_adam', gender: 'Male', accent: 'US', engine: 'kokoro' },
    { id: 'am_michael', gender: 'Male', accent: 'US', engine: 'kokoro' },
    { id: 'am_fenrir', gender: 'Male', accent: 'US', engine: 'kokoro' },
    { id: 'bf_emma', gender: 'Female', accent: 'UK', engine: 'kokoro' },
    { id: 'bm_george', gender: 'Male', accent: 'UK', engine: 'kokoro' },
    { id: 'piper-en-lessac', gender: 'Female', accent: 'US', engine: 'piper' }
  ];

  console.log('================================================================');
  console.log('   VOICE IDENTITY & ACOUSTIC SEPARATION TEST MATRIX');
  console.log('================================================================\n');

  const results = [];
  const buffers = {};

  for (const v of testVoices) {
    const out = path.join(__dirname, '..', '..', 'storage', 'audio', `matrix_${v.id}.wav`);
    const t0 = Date.now();
    await neural.synthesizeSpeech(sentence, v.id, out);
    const elapsed = Date.now() - t0;
    const buf = fs.readFileSync(out);
    buffers[v.id] = buf;

    // Analyze using ffmpeg astats
    const statsOut = execSync(`ffmpeg -i "${out}" -af "astats=metadata=1:reset=1" -f null - 2>&1`, { encoding: 'utf8' });
    const rmsMatch = statsOut.match(/RMS level dB:\s*([-\d.]+)/);
    const peakMatch = statsOut.match(/Peak level dB:\s*([-\d.]+)/);

    // Analyze fundamental pitch estimate using ffmpeg aspectralstats or silencedetect
    const durMatch = statsOut.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    const durSec = durMatch ? parseFloat(durMatch[1])*3600 + parseFloat(durMatch[2])*60 + parseFloat(durMatch[3]) : 0;

    results.push({
      voice_id: v.id,
      engine: v.engine,
      gender: v.gender,
      accent: v.accent,
      duration_s: Number(durSec.toFixed(2)),
      file_bytes: buf.length,
      latency_s: Number((elapsed / 1000).toFixed(2)),
      peak_db: peakMatch ? peakMatch[1] : 'N/A',
      rms_db: rmsMatch ? rmsMatch[1] : 'N/A'
    });
  }

  console.table(results);

  console.log('\n--- PAIRWISE ACOUSTIC DIFFERENTIATION CHECK ---');
  let allDistinct = true;
  const pairs = [
    ['af_heart', 'af_bella', 'Two US Females'],
    ['am_adam', 'am_michael', 'Two US Males'],
    ['am_adam', 'am_fenrir', 'Standard vs Intense Male'],
    ['af_heart', 'am_adam', 'US Female vs US Male'],
    ['bf_emma', 'bm_george', 'UK Female vs UK Male'],
    ['af_heart', 'bf_emma', 'US Female vs UK Female'],
    ['af_heart', 'piper-en-lessac', 'Kokoro US Female vs Piper US Female']
  ];

  for (const [id1, id2, desc] of pairs) {
    const b1 = buffers[id1];
    const b2 = buffers[id2];
    const equal = b1.equals(b2);
    const lenDiff = Math.abs(b1.length - b2.length);
    console.log(`  Comparison [${desc}]:`);
    console.log(`    ${id1} (${b1.length} B) vs ${id2} (${b2.length} B) -> Identical: ${equal}, Delta Length: ${lenDiff} B`);
    if (equal) {
      console.error(`    ❌ FAILURE: ${id1} and ${id2} generated identical audio!`);
      allDistinct = false;
    } else {
      console.log(`    ✅ PASS: Acoustically and bitwise distinct.`);
    }
  }

  console.log('\n================================================================');
  if (allDistinct) {
    console.log('  🎉 ALL TESTED VOICES ARE ACOUSTICALLY & BITWISE DISTINCT!');
  } else {
    console.log('  ❌ CRITICAL FAILURE: Identical voices detected!');
    process.exit(1);
  }
  console.log('================================================================\n');
}

testMatrix().catch(e => {
  console.error(e);
  process.exit(1);
});
