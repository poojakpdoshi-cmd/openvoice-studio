"""
OpenVoice Studio — SQLite Database & 110+ Voice Catalog Initializer
"""
import sqlite3
import json
from pathlib import Path
from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    language TEXT NOT NULL,
    accent TEXT NOT NULL,
    gender TEXT NOT NULL,
    category TEXT NOT NULL,
    engine TEXT NOT NULL,
    model_id TEXT NOT NULL,
    sample_rate INTEGER DEFAULT 24000,
    license_type TEXT NOT NULL,
    is_installed INTEGER DEFAULT 1,
    is_custom INTEGER DEFAULT 0,
    traits_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    text_content TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    engine TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    file_path TEXT NOT NULL,
    format TEXT NOT NULL,
    sample_rate INTEGER NOT NULL,
    settings_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_segments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    speaker_label TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    text_content TEXT NOT NULL,
    pause_after_ms INTEGER DEFAULT 400,
    speed REAL DEFAULT 1.0,
    pitch REAL DEFAULT 0.0,
    volume REAL DEFAULT 1.0,
    generated_audio_path TEXT,
    duration_seconds REAL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS pronunciations (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    replacement TEXT NOT NULL,
    language TEXT DEFAULT 'en'
);
"""

# Complete 110+ Genuine Voice Library Data
VOICE_CATALOG = [
    # 1. Built-in Instant DSP Voices (Flite)
    ("flite-kal16", "Kevin (16kHz)", "Standard American English male speaker, crisp and clear.", "en", "American", "Male", "narration", "flite", "flite-cmu", 16000, "BSD (CMU)", 1, 0, '{"speed_supported":true,"pitch_supported":true}'),
    ("flite-awb", "Alistair", "Scottish-accented male voice with rhythmic prosody.", "en", "Scottish", "Male", "storytelling", "flite", "flite-cmu", 16000, "BSD (CMU)", 1, 0, '{"speed_supported":true,"pitch_supported":true}'),
    ("flite-rms", "Richard", "Mid-register American male documentary narration tone.", "en", "American", "Male", "documentary", "flite", "flite-cmu", 16000, "BSD (CMU)", 1, 0, '{"speed_supported":true,"pitch_supported":true}'),
    ("flite-slt", "Samantha", "Soft American female voice with high phonetic clarity.", "en", "American", "Female", "conversational", "flite", "flite-cmu", 16000, "BSD (CMU)", 1, 0, '{"speed_supported":true,"pitch_supported":true}'),

    # 2. Kokoro-82M Voices (Apache 2.0) — American English
    ("af_heart", "Heart (Default)", "Warm, polished American female narrator. Industry standard for audiobooks.", "en-US", "American", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["calm","narration"]}'),
    ("af_alloy", "Alloy", "Bright, energetic modern conversational female voice.", "en-US", "American", "Female", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["energetic","friendly"]}'),
    ("af_aoede", "Aoede", "Serene, gentle cadence, perfect for meditation and calm narration.", "en-US", "American", "Female", "calm", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["calm"]}'),
    ("af_bella", "Bella", "Expressive, approachable female voice for assistants and dialogue.", "en-US", "American", "Female", "friendly", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["friendly"]}'),
    ("af_jessica", "Jessica", "Dynamic emotional delivery with natural pitch inflections.", "en-US", "American", "Female", "expressive", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["expressive"]}'),
    ("af_kore", "Kore", "Clear enunciation, measured pacing, ideal for tutorials and lectures.", "en-US", "American", "Female", "educational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["educational"]}'),
    ("af_nicole", "Nicole", "Soft, intimate storytelling voice with subtle whisper nuances.", "en-US", "American", "Female", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),
    ("af_nova", "Nova", "Authoritative, commanding presence for science and history documentaries.", "en-US", "American", "Female", "documentary", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["documentary"]}'),
    ("af_river", "River", "Balanced, mid-tone, neutral American female cadence.", "en-US", "American", "Female", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),
    ("af_sarah", "Sarah", "Professional corporate presentations and executive training.", "en-US", "American", "Female", "professional", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["professional"]}'),
    ("af_sky", "Sky", "Bright, youthful, optimistic delivery for podcasts and creative media.", "en-US", "American", "Female", "energetic", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["energetic"]}'),
    ("am_adam", "Adam", "Deep, resonant, classic American commercial and corporate baritone.", "en-US", "American", "Male", "professional", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["professional"]}'),
    ("am_echo", "Echo", "Warm, commanding bass profile for science and nature documentaries.", "en-US", "American", "Male", "documentary", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["documentary"]}'),
    ("am_eric", "Eric", "Everyday conversational American male speaker, relaxed and natural.", "en-US", "American", "Male", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),
    ("am_fenrir", "Fenrir", "Gravelly, intense, cinematic baritone for dramatic delivery.", "en-US", "American", "Male", "dramatic", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["dramatic"]}'),
    ("am_liam", "Liam", "Casual, warm, engaging voice for interactive dialogues.", "en-US", "American", "Male", "friendly", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["friendly"]}'),
    ("am_michael", "Michael", "Nuanced pacing and character clarity for literature audiobooks.", "en-US", "American", "Male", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),
    ("am_onyx", "Onyx", "Crisply articulated, objective broadcast journalism style.", "en-US", "American", "Male", "news", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["news"]}'),
    ("am_puck", "Puck", "Playful, animated character narration for youth content.", "en-US", "American", "Male", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),
    ("am_santa", "Nicholas", "Rich, grandfatherly warmth with rich vocal body.", "en-US", "American", "Male", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),

    # Kokoro-82M Voices — British English
    ("bf_alice", "Alice (UK)", "Received Pronunciation (RP) British English, literary clarity.", "en-GB", "British", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("bf_emma", "Emma (UK)", "Oxford-accented educational lecturer with crisp diction.", "en-GB", "British", "Female", "educational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["educational"]}'),
    ("bf_isabella", "Isabella (UK)", "Warm London-accented narration with gentle emotion.", "en-GB", "British", "Female", "expressive", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["expressive"]}'),
    ("bf_lily", "Lily (UK)", "Approachable, contemporary British female voice.", "en-GB", "British", "Female", "friendly", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["friendly"]}'),
    ("bm_daniel", "Daniel (UK)", "BBC broadcast cadence, authoritative and measured.", "en-GB", "British", "Male", "news", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["news"]}'),
    ("bm_fable", "Fable (UK)", "Theatrical British narrator with rich baritone resonance.", "en-GB", "British", "Male", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),
    ("bm_george", "George (UK)", "Sophisticated historical and documentary presenter.", "en-GB", "British", "Male", "documentary", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["documentary"]}'),
    ("bm_lewis", "Lewis (UK)", "Modern urban British male conversational tone.", "en-GB", "British", "Male", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),

    # Kokoro-82M Voices — European Languages
    ("ef_dora", "Dora (ES)", "Castilian Spanish female voice with natural rhythm.", "es-ES", "Castilian", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("em_alex", "Alex (ES)", "Castilian Spanish male voice with balanced cadence.", "es-ES", "Castilian", "Male", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),
    ("em_santa", "Santiago (ES)", "Expressive Spanish baritone for audiobooks.", "es-ES", "Castilian", "Male", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),
    ("ff_siwis", "Chloé (FR)", "Standard Metropolitan French with clear phonetic precision.", "fr-FR", "Metropolitan", "Female", "educational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["educational"]}'),
    ("fm_siwis", "Julien (FR)", "Melodic French male narration for literature.", "fr-FR", "Metropolitan", "Male", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("if_sara", "Sara (IT)", "Expressive Italian female voice with natural prosody.", "it-IT", "Standard", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("im_nicola", "Nicola (IT)", "Fluid Italian male conversational speaker.", "it-IT", "Standard", "Male", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),
    ("pf_dora", "Camila (PT-BR)", "Brazilian Portuguese female voice with warm cadence.", "pt-BR", "Brazilian", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("pm_alex", "Rafael (PT-BR)", "Brazilian Portuguese male conversational speaker.", "pt-BR", "Brazilian", "Male", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),

    # Kokoro-82M Voices — Asian Languages
    ("hf_alpha", "Ananya (Hindi)", "Modern standard Hindi female narrator for business and audiobooks.", "hi-IN", "Standard", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("hf_beta", "Diya (Hindi)", "Warm conversational Hindi female voice.", "hi-IN", "Standard", "Female", "friendly", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["friendly"]}'),
    ("hm_omega", "Aarav (Hindi)", "Clear, formal Hindi male broadcast speaker for news.", "hi-IN", "Standard", "Male", "news", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["news"]}'),
    ("hm_psi", "Rohan (Hindi)", "Deep Hindi documentary narrator.", "hi-IN", "Standard", "Male", "documentary", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["documentary"]}'),
    ("jf_alpha", "Sakura (Japanese)", "Standard Tokyo dialect Japanese female speaker.", "ja-JP", "Tokyo", "Female", "narration", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["narration"]}'),
    ("jf_gongitsune", "Hanako (Japanese)", "Traditional Japanese folktale storytelling tone.", "ja-JP", "Tokyo", "Female", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),
    ("jf_nezumi", "Aoi (Japanese)", "Friendly, natural Japanese conversational voice.", "ja-JP", "Tokyo", "Female", "friendly", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["friendly"]}'),
    ("jm_kumo", "Kenji (Japanese)", "Resonant Japanese male documentary narrator.", "ja-JP", "Tokyo", "Male", "documentary", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["documentary"]}'),
    ("zf_xiaobei", "Xiaobei (Mandarin)", "Standard Putonghua female narrator with clear tone contours.", "zh-CN", "Standard", "Female", "educational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["educational"]}'),
    ("zf_xiaoni", "Xiaoni (Mandarin)", "Lively Mandarin Chinese conversational voice.", "zh-CN", "Standard", "Female", "conversational", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["conversational"]}'),
    ("zm_yunjian", "Yunjian (Mandarin)", "Authoritative Mandarin male documentary presenter.", "zh-CN", "Standard", "Male", "documentary", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["documentary"]}'),
    ("zm_yunxi", "Yunxi (Mandarin)", "Expressive Mandarin male audiobook narrator.", "zh-CN", "Standard", "Male", "storytelling", "kokoro", "kokoro-82m", 24000, "Apache 2.0", 1, 0, '{"emotions":["storytelling"]}'),

    # 3. Piper TTS Multi-Language Catalog (MIT / CC-BY / OFL)
    ("piper-en-lessac", "Lessac (US)", "Reference standard English corpus. Highly legible and crisp.", "en-US", "American", "Female", "educational", "piper", "piper-en-lessac", 22050, "BSD-3-Clause", 1, 0, '{}'),
    ("piper-en-libritts", "LibriTTS High", "High-fidelity LibriTTS multi-speaker synthesis.", "en-US", "American", "Male", "narration", "piper", "piper-en-libritts", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-en-ryan", "Ryan (US)", "Clear, public domain American male voice.", "en-US", "American", "Male", "conversational", "piper", "piper-en-ryan", 22050, "CC0", 1, 0, '{}'),
    ("piper-en-amy", "Amy (US)", "Crisp, bright American female narrator.", "en-US", "American", "Female", "narration", "piper", "piper-en-amy", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-en-danny", "Danny (US)", "Fast-inference American male voice for assistants.", "en-US", "American", "Male", "friendly", "piper", "piper-en-danny", 22050, "CC0", 1, 0, '{}'),
    ("piper-en-kathleen", "Kathleen (US)", "Ultra-lightweight conversational female voice.", "en-US", "American", "Female", "conversational", "piper", "piper-en-kathleen", 22050, "CC0", 1, 0, '{}'),
    ("piper-en-kristin", "Kristin (US)", "Friendly podcast-style speaker.", "en-US", "American", "Female", "conversational", "piper", "piper-en-kristin", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-en-alan", "Alan (UK)", "Northern England regional accent narrator.", "en-GB", "British", "Male", "documentary", "piper", "piper-en-alan", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-en-alba", "Alba (UK)", "Scottish English female voice with natural lilt.", "en-GB", "Scottish", "Female", "narration", "piper", "piper-en-alba", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-en-jenny", "Jenny (UK)", "Irish-English inflected narration voice.", "en-GB", "Irish", "Female", "storytelling", "piper", "piper-en-jenny", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-en-semaine", "Semaine (UK)", "Conversational dialogue specialist voice.", "en-GB", "British", "Female", "friendly", "piper", "piper-en-semaine", 22050, "CC-BY-NC", 1, 0, '{}'),

    # Regional Indian Languages
    ("piper-gu-cmu", "CMU Gujarati", "Native Gujarati phonetic corpus from CMU Indic speech repository.", "gu-IN", "Gujarati", "Female", "educational", "piper", "piper-gu-cmu", 22050, "BSD-3-Clause", 1, 0, '{}'),
    ("piper-hi-cmu", "CMU Hindi", "Devanagari script phoneme mapping from CMU Indic.", "hi-IN", "Hindi", "Female", "narration", "piper", "piper-hi-cmu", 22050, "BSD-3-Clause", 1, 0, '{}'),
    ("piper-hi-female", "Swara Hindi", "High-clarity modern Hindi speech model.", "hi-IN", "Hindi", "Female", "conversational", "piper", "piper-hi-female", 22050, "CC-BY-4.0", 1, 0, '{}'),

    # Asian & Middle Eastern Languages
    ("piper-ja-kokoro", "Piper Kokoro (JA)", "Morpheme-aligned Japanese VITS voice.", "ja-JP", "Tokyo", "Female", "narration", "piper", "piper-ja-kokoro", 22050, "MIT", 1, 0, '{}'),
    ("piper-ko-kss", "KSS Korean", "Professional Korean audio studio recordings.", "ko-KR", "Seoul", "Female", "educational", "piper", "piper-ko-kss", 22050, "CC-BY-NC", 1, 0, '{}'),
    ("piper-ar-kareem-med", "Kareem (Arabic)", "Modern Standard Arabic with full Tashkeel diacritics.", "ar-JO", "Standard", "Male", "news", "piper", "piper-ar-kareem", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-ar-kareem-low", "Kareem Fast (AR)", "Low-resource Arabic streaming voice.", "ar-JO", "Standard", "Male", "conversational", "piper", "piper-ar-kareem-low", 22050, "CC-BY-4.0", 1, 0, '{}'),

    # Romance Languages
    ("piper-es-carlfm", "Carlos (ES)", "Spanish narrator with natural rhythmic phrasing.", "es-ES", "Castilian", "Male", "narration", "piper", "piper-es-carlfm", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-es-davefx", "David (ES)", "Expressive public-domain Spanish male voice.", "es-ES", "Castilian", "Male", "friendly", "piper", "piper-es-davefx", 22050, "CC0", 1, 0, '{}'),
    ("piper-es-sharvard", "Sherezade (ES)", "Castilian female speaker with precise articulation.", "es-ES", "Castilian", "Female", "educational", "piper", "piper-es-sharvard", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-es-ald", "Aldair (MX)", "Latin American (Mexican) Spanish male speaker.", "es-MX", "Mexican", "Male", "conversational", "piper", "piper-es-ald", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-fr-siwis", "Siwis Medium (FR)", "Clean French academic corpus.", "fr-FR", "Metropolitan", "Female", "educational", "piper", "piper-fr-siwis", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-fr-upmc", "UPMC French", "Parisian university research corpus.", "fr-FR", "Metropolitan", "Male", "narration", "piper", "piper-fr-upmc", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-fr-gilles", "Gilles Low (FR)", "Fast-inference French male voice.", "fr-FR", "Metropolitan", "Male", "conversational", "piper", "piper-fr-gilles", 22050, "CC0", 1, 0, '{}'),
    ("piper-fr-mls", "MLS French", "Multilingual LibriSpeech French partition.", "fr-FR", "Metropolitan", "Female", "storytelling", "piper", "piper-fr-mls", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-pt-edresson", "Edresson (BR)", "Brazilian Portuguese academic corpus voice.", "pt-BR", "Brazilian", "Male", "educational", "piper", "piper-pt-edresson", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-pt-faber", "Faber (BR)", "Clean Brazilian storytelling male voice.", "pt-BR", "Brazilian", "Male", "storytelling", "piper", "piper-pt-faber", 22050, "CC0", 1, 0, '{}'),
    ("piper-pt-tuatara", "Tuatara (PT)", "European Portuguese pronunciation voice.", "pt-PT", "European", "Female", "narration", "piper", "piper-pt-tuatara", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-it-riccardo", "Riccardo (IT)", "Warm Italian male narrator.", "it-IT", "Standard", "Male", "narration", "piper", "piper-it-riccardo", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-it-paola", "Paola (IT)", "Expressive Italian female speaker.", "it-IT", "Standard", "Female", "conversational", "piper", "piper-it-paola", 22050, "CC-BY-4.0", 1, 0, '{}'),

    # Germanic & Northern Languages
    ("piper-de-thorsten", "Thorsten High (DE)", "Acclaimed public-domain German male voice.", "de-DE", "Standard", "Male", "narration", "piper", "piper-de-thorsten", 22050, "CC0", 1, 0, '{}'),
    ("piper-de-eva", "Eva Medium (DE)", "Clear High German female narrator.", "de-DE", "Standard", "Female", "educational", "piper", "piper-de-eva", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-de-karlsson", "Karlsson Low (DE)", "Fast German audio engine voice.", "de-DE", "Standard", "Male", "friendly", "piper", "piper-de-karlsson", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-de-pavoque", "Pavoque (DE)", "Nuanced German conversational voice.", "de-DE", "Standard", "Male", "conversational", "piper", "piper-de-pavoque", 22050, "CC-BY-NC", 1, 0, '{}'),
    ("piper-de-ramona", "Ramona (DE)", "Approachable German female speaker.", "de-DE", "Standard", "Female", "friendly", "piper", "piper-de-ramona", 22050, "CC0", 1, 0, '{}'),
    ("piper-nl-nathalie", "Nathalie (BE)", "Flemish Dutch female voice.", "nl-BE", "Flemish", "Female", "narration", "piper", "piper-nl-nathalie", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-nl-mls", "MLS Dutch (NL)", "Netherlands standard Dutch male speaker.", "nl-NL", "Standard", "Male", "educational", "piper", "piper-nl-mls", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-sv-nst", "NST Swedish", "Nordic standard Swedish recording.", "sv-SE", "Standard", "Female", "narration", "piper", "piper-sv-nst", 22050, "CC-BY-4.0", 1, 0, '{}'),

    # Slavic, Eastern European & Other Languages
    ("piper-pl-darkman", "Darkman (PL)", "Deep Polish male voice.", "pl-PL", "Standard", "Male", "documentary", "piper", "piper-pl-darkman", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-pl-gosia", "Gosia (PL)", "Warm Polish female speaker.", "pl-PL", "Standard", "Female", "conversational", "piper", "piper-pl-gosia", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-ru-denis", "Denis (RU)", "Standard Russian male narrator.", "ru-RU", "Standard", "Male", "narration", "piper", "piper-ru-denis", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-ru-irina", "Irina (RU)", "Expressive Russian female voice.", "ru-RU", "Standard", "Female", "storytelling", "piper", "piper-ru-irina", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-ru-ruslan", "Ruslan (RU)", "Clear broadcast Russian speaker.", "ru-RU", "Standard", "Male", "news", "piper", "piper-ru-ruslan", 22050, "CC0", 1, 0, '{}'),
    ("piper-uk-lada", "Lada (UKR)", "Ukrainian literary female narrator.", "uk-UA", "Standard", "Female", "narration", "piper", "piper-uk-lada", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-uk-tts", "Ukrainian TTS", "Contemporary Ukrainian male speech model.", "uk-UA", "Standard", "Male", "conversational", "piper", "piper-uk-tts", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-tr-dfki", "DFKI Turkish", "Turkish university speech laboratory model.", "tr-TR", "Standard", "Male", "educational", "piper", "piper-tr-dfki", 22050, "CC-BY-4.0", 1, 0, '{}'),
    ("piper-tr-fettah", "Fettah (TR)", "Clear Turkish conversational speaker.", "tr-TR", "Standard", "Male", "friendly", "piper", "piper-tr-fettah", 22050, "CC0", 1, 0, '{}'),

    # Downloadable Voice Packs (Cataloged for on-demand installation)
    ("pack-en-glados", "GLaDOS Persona", "Iconic robotic female voice model.", "en-US", "Synthetic", "Female", "storytelling", "piper", "piper-glados", 22050, "Community", 0, 0, '{}'),
    ("pack-en-hfc-female", "HF Studio Female", "Studio narration female voice.", "en-US", "American", "Female", "narration", "piper", "piper-hfc-f", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-en-hfc-male", "HF Studio Male", "Studio narration male voice.", "en-US", "American", "Male", "narration", "piper", "piper-hfc-m", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-es-miguel", "Miguel Audiobooks", "Spanish literary narrator.", "es-ES", "Castilian", "Male", "storytelling", "piper", "piper-miguel", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-fr-bernard", "Bernard Documentary", "Classic French documentary narrator.", "fr-FR", "Metropolitan", "Male", "documentary", "piper", "piper-bernard", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-de-claudia", "Claudia Professional", "Corporate German female voice.", "de-DE", "Standard", "Female", "professional", "piper", "piper-claudia", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-hi-shreya", "Shreya Broadcast", "Formal Hindi broadcast news presenter.", "hi-IN", "Standard", "Female", "news", "piper", "piper-shreya", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-gu-aarav", "Aarav Gujarati", "Expressive male Gujarati narrator.", "gu-IN", "Gujarati", "Male", "storytelling", "piper", "piper-gu-aarav", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-ar-layla", "Layla Arabic", "Literary Arabic female speaker.", "ar-EG", "Egyptian", "Female", "narration", "piper", "piper-layla", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-pt-tiago", "Tiago Documentary", "Deep Brazilian documentary speaker.", "pt-BR", "Brazilian", "Male", "documentary", "piper", "piper-tiago", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-it-giovanni", "Giovanni Audiobooks", "Classic Italian fiction narrator.", "it-IT", "Standard", "Male", "storytelling", "piper", "piper-giovanni", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-ja-ryo", "Ryo Anime", "Animated character Japanese voice.", "ja-JP", "Tokyo", "Male", "storytelling", "piper", "piper-ryo", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-ko-minho", "Minho News", "Seoul broadcast Korean male voice.", "ko-KR", "Seoul", "Male", "news", "piper", "piper-minho", 22050, "CC-BY-4.0", 0, 0, '{}'),
    ("pack-zh-lin", "Teacher Lin", "Mandarin educational instructor.", "zh-CN", "Standard", "Female", "educational", "piper", "piper-lin", 22050, "CC-BY-4.0", 0, 0, '{}')
]

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.executescript(SCHEMA)

    # Check if voices table has records
    cursor.execute("SELECT COUNT(*) FROM voices")
    count = cursor.fetchone()[0]
    if count == 0:
        cursor.executemany(
            """INSERT OR REPLACE INTO voices 
               (id, name, description, language, accent, gender, category, engine, model_id, sample_rate, license_type, is_installed, is_custom, traits_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            VOICE_CATALOG
        )
        conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

