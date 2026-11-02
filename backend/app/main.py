"""
OpenVoice Studio — Main Application Entrypoint (FastAPI)
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import shutil
import uuid
import json

from .core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, AUDIO_DIR, HOST, PORT
from .core.database import init_db, get_db
from .core.hardware import detect_hardware
from .services.chunker import chunk_text_to_sentences, count_text_stats
from .services.dictionary import dictionary_service
from .services.audio_dsp import AudioDSPService
from .services.voice_cloner import VoiceClonerService
from .services.tts_orchestrator import tts_orchestrator
from .services.project_manager import ProjectManager
from .services.exporter import AudioExporter

# Initialize database tables & seed 110+ genuine voices
init_db()

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Professional Open-Source AI Voice Generation, Text-to-Speech & Voice Cloning Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Health & System Status
@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "app": APP_NAME,
        "version": APP_VERSION,
        "ffmpeg_available": AudioDSPService.is_available()
    }

# 2. Hardware Detection
@app.get("/api/hardware")
def get_hardware_info():
    return detect_hardware()

# 3. Voice Library (100+ Genuine Profiles)
@app.get("/api/voices")
def list_voices(
    language: str = Query(None),
    gender: str = Query(None),
    category: str = Query(None),
    engine: str = Query(None),
    search: str = Query(None)
):
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM voices WHERE 1=1"
    params = []

    if language:
        query += " AND language LIKE ?"
        params.append(f"%{language}%")
    if gender:
        query += " AND gender = ?"
        params.append(gender)
    if category:
        query += " AND category = ?"
        params.append(category)
    if engine:
        query += " AND engine = ?"
        params.append(engine)
    if search:
        query += " AND (name LIKE ? OR description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY is_custom DESC, is_installed DESC, language ASC, name ASC"
    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Also include custom cloned voices
    custom_voices = VoiceClonerService.list_custom_voices()
    for cv in custom_voices:
        rows.insert(0, {
            "id": cv["id"],
            "name": cv["name"],
            "description": cv["description"],
            "language": cv.get("source_language", "en"),
            "accent": "Custom Cloned",
            "gender": cv.get("gender", "Neutral"),
            "category": "cloned",
            "engine": "clone",
            "model_id": "custom-clone",
            "sample_rate": 24000,
            "license_type": "User Private",
            "is_installed": 1,
            "is_custom": 1,
            "traits_json": json.dumps(cv.get("acoustic_features", {}))
        })

    return {"count": len(rows), "voices": rows}

@app.get("/api/voices/{voice_id}")
def get_voice(voice_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM voices WHERE id = ?", (voice_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Voice profile not found.")
    return dict(row)

# 4. Text Chunking & Statistics Preview
@app.post("/api/tts/chunk")
def preview_chunks(payload: dict):
    text = payload.get("text", "")
    max_chars = payload.get("max_chars", 300)
    chunks = chunk_text_to_sentences(text, max_chars=max_chars)
    stats = count_text_stats(text)
    return {
        "stats": stats,
        "chunk_count": len(chunks),
        "chunks": chunks
    }

# 5. Speech Synthesis
@app.post("/api/tts/generate")
def generate_speech(payload: dict):
    text = payload.get("text", "")
    voice_id = payload.get("voice_id", "af_heart")
    speed = float(payload.get("speed", 1.0))
    pitch = float(payload.get("pitch", 0.0))
    volume = float(payload.get("volume", 1.0))
    language = payload.get("language", "en")
    format_type = payload.get("format", "wav")

    try:
        result = tts_orchestrator.generate_speech(
            text=text,
            voice_id=voice_id,
            speed=speed,
            pitch=pitch,
            volume=volume,
            language=language,
            format_type=format_type
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. Pronunciation Dictionary
@app.get("/api/tts/pronunciations")
def get_pronunciations():
    return dictionary_service.get_all()

@app.post("/api/tts/pronunciations")
def add_pronunciation(payload: dict):
    word = payload.get("word")
    replacement = payload.get("replacement")
    if not word or not replacement:
        raise HTTPException(status_code=400, detail="Word and replacement required.")
    dictionary_service.add_override(word, replacement)
    return {"status": "ok", "word": word, "replacement": replacement}

@app.delete("/api/tts/pronunciations/{word}")
def delete_pronunciation(word: str):
    dictionary_service.remove_override(word)
    return {"status": "ok", "deleted": word}

# 7. Custom Voice Cloning Studio
@app.post("/api/clone/validate")
async def validate_voice_recording(file: UploadFile = File(...)):
    temp_path = AUDIO_DIR / f"upload_{uuid.uuid4().hex[:8]}_{file.filename}"
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        analysis = VoiceClonerService.validate_recording(str(temp_path))
        return {
            "analysis": analysis,
            "temporary_file_path": str(temp_path)
        }
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clone/create")
def create_custom_voice(payload: dict):
    name = payload.get("name")
    temp_file = payload.get("temporary_file_path")
    consent_confirmed = bool(payload.get("consent_confirmed", False))
    consent_name = payload.get("consent_name", "")
    language = payload.get("source_language", "en")
    description = payload.get("description", "")

    if not consent_confirmed:
        raise HTTPException(status_code=400, detail="Explicit biometric consent is required.")

    try:
        profile = VoiceClonerService.create_custom_voice(
            name=name,
            reference_audio_path=temp_file,
            consent_confirmed=consent_confirmed,
            consent_name=consent_name,
            source_language=language,
            description=description
        )
        return profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clone/profiles")
def list_cloned_profiles():
    return VoiceClonerService.list_custom_voices()

@app.delete("/api/clone/profiles/{voice_id}")
def delete_cloned_profile(voice_id: str):
    VoiceClonerService.delete_custom_voice(voice_id)
    return {"status": "deleted", "id": voice_id}

# 8. Multi-Voice Projects
@app.get("/api/projects")
def list_projects():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY updated_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/projects")
def create_project(payload: dict):
    title = payload.get("title", "Untitled Project")
    desc = payload.get("description", "")
    return ProjectManager.create_project(title, desc)

@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    try:
        return ProjectManager.get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/projects/{project_id}/segments")
def add_project_segment(project_id: str, payload: dict):
    return ProjectManager.add_segment(
        project_id=project_id,
        speaker_label=payload.get("speaker_label", "Speaker"),
        voice_id=payload.get("voice_id", "af_heart"),
        text_content=payload.get("text_content", ""),
        pause_after_ms=int(payload.get("pause_after_ms", 400)),
        speed=float(payload.get("speed", 1.0)),
        pitch=float(payload.get("pitch", 0.0)),
        volume=float(payload.get("volume", 1.0))
    )

@app.post("/api/projects/{project_id}/render")
def render_project(project_id: str, payload: dict = None):
    fmt = payload.get("format", "wav") if payload else "wav"
    try:
        return ProjectManager.render_project(project_id, format_type=fmt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 9. Audio Workspace Editing & Export
@app.post("/api/audio/trim")
def trim_audio(payload: dict):
    input_file = payload.get("file_name")
    start_time = float(payload.get("start_time", 0.0))
    end_time = float(payload.get("end_time", 10.0))
    in_path = AUDIO_DIR / input_file
    if not in_path.exists():
        raise HTTPException(status_code=404, detail="Source audio file not found.")

    out_name = f"trim_{uuid.uuid4().hex[:8]}.wav"
    out_path = AUDIO_DIR / out_name
    AudioDSPService.trim_audio(str(in_path), str(out_path), start_time, end_time)
    info = AudioDSPService.analyze_audio_quality(str(out_path))
    return {
        "audio_url": f"/api/audio/file/{out_name}",
        "duration": info["duration_seconds"]
    }

@app.post("/api/audio/export")
def export_audio(payload: dict):
    file_name = payload.get("file_name")
    format_type = payload.get("format", "mp3")
    sample_rate = int(payload.get("sample_rate", 24000))
    bit_depth = int(payload.get("bit_depth", 16))
    channels = int(payload.get("channels", 1))

    in_path = AUDIO_DIR / file_name
    if not in_path.exists():
        raise HTTPException(status_code=404, detail="Source audio not found.")

    out_name = f"export_{uuid.uuid4().hex[:8]}.{format_type}"
    out_path = AUDIO_DIR / out_name
    AudioExporter.export(
        input_path=str(in_path),
        output_path=str(out_path),
        format_type=format_type,
        sample_rate=sample_rate,
        bit_depth=bit_depth,
        channels=channels
    )
    return {
        "export_url": f"/api/audio/file/{out_name}",
        "file_name": out_name,
        "format": format_type,
        "sample_rate": sample_rate
    }

# 10. Generation History
@app.get("/api/generations")
def list_generations():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM generations ORDER BY created_at DESC LIMIT 50")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for r in rows:
        filename = Path(r["file_path"]).name
        r["audio_url"] = f"/api/audio/file/{filename}"
    return rows

# 11. Stream / Serve Audio Files
@app.get("/api/audio/file/{filename}")
def serve_audio_file(filename: str):
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    media_type = "audio/wav"
    if filename.endswith(".mp3"):
        media_type = "audio/mpeg"
    elif filename.endswith(".flac"):
        media_type = "audio/flac"
    return FileResponse(file_path, media_type=media_type)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=HOST, port=PORT, reload=True)
