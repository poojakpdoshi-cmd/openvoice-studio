"""
OpenVoice Studio — Unified Speech Inference Orchestrator
Coordinates text chunking, pronunciation overrides, adapter selection,
multi-segment synthesis, pause concatenation, and generation history persistence.
"""
import uuid
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..core.config import AUDIO_DIR, DEFAULT_SAMPLE_RATE
from ..core.database import get_db
from .chunker import chunk_text_to_sentences, count_text_stats
from .dictionary import dictionary_service
from .audio_dsp import AudioDSPService
from ..adapters.flite import FliteDSPAdapter
from ..adapters.kokoro import KokoroAdapter
from ..adapters.piper import PiperAdapter
from ..adapters.clone_adapter import CustomVoiceCloneAdapter

class TTSOrchestrator:
    def __init__(self):
        self.adapters = {
            "flite": FliteDSPAdapter(),
            "kokoro": KokoroAdapter(),
            "piper": PiperAdapter(),
            "clone": CustomVoiceCloneAdapter()
        }

    def generate_speech(
        self,
        text: str,
        voice_id: str,
        speed: float = 1.0,
        pitch: float = 0.0,
        volume: float = 1.0,
        language: str = "en",
        format_type: str = "wav"
    ) -> Dict[str, Any]:
        """
        Full end-to-end speech synthesis pipeline.
        """
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")

        # 1. Apply pronunciation dictionary overrides
        processed_text = dictionary_service.apply(text)

        # 2. Look up voice details from DB
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM voices WHERE id = ?", (voice_id,))
        voice_row = cursor.fetchone()
        conn.close()

        engine_name = "kokoro"
        if voice_row:
            engine_name = voice_row["engine"]
            if not language or language == "en":
                language = voice_row["language"]
        elif voice_id.startswith("custom_"):
            engine_name = "clone"
        elif voice_id.startswith("flite-"):
            engine_name = "flite"
        elif voice_id.startswith("piper-"):
            engine_name = "piper"

        adapter = self.adapters.get(engine_name, self.adapters["flite"])

        # 3. Chunk text into sentences
        chunks = chunk_text_to_sentences(processed_text, max_chars=300)
        if not chunks:
            chunks = [{"index": 0, "text": processed_text, "pause_after_ms": 300}]

        # 4. Synthesize each chunk
        gen_id = f"gen_{uuid.uuid4().hex[:12]}"
        temp_dir = AUDIO_DIR / f"temp_{gen_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)

        segment_paths = []
        pauses = []

        try:
            for chunk in chunks:
                chunk_file = temp_dir / f"chunk_{chunk['index']}.wav"
                adapter.synthesize_chunk(
                    text=chunk["text"],
                    voice_id=voice_id,
                    output_path=str(chunk_file),
                    speed=speed,
                    pitch=pitch,
                    volume=volume,
                    language=language
                )
                segment_paths.append(str(chunk_file))
                pauses.append(chunk.get("pause_after_ms", 300))

            # 5. Concatenate segments with inter-sentence pauses
            master_wav = AUDIO_DIR / f"{gen_id}.wav"
            AudioDSPService.concatenate_segments(
                input_paths=segment_paths,
                pauses_ms=pauses,
                output_path=str(master_wav),
                sample_rate=DEFAULT_SAMPLE_RATE
            )

            # 6. Analyze resulting master audio
            audio_info = AudioDSPService.analyze_audio_quality(str(master_wav))
            duration = audio_info["duration_seconds"]

            # 7. Convert format if requested
            final_file = master_wav
            if format_type.lower() == "mp3":
                final_file = AUDIO_DIR / f"{gen_id}.mp3"
                from .exporter import AudioExporter
                AudioExporter.export(
                    input_path=str(master_wav),
                    output_path=str(final_file),
                    format_type="mp3",
                    sample_rate=DEFAULT_SAMPLE_RATE
                )

            # 8. Record in generations database
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO generations 
                   (id, text_content, voice_id, engine, duration_seconds, file_path, format, sample_rate, settings_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    gen_id,
                    text,
                    voice_id,
                    engine_name,
                    duration,
                    str(final_file),
                    format_type,
                    DEFAULT_SAMPLE_RATE,
                    f'{{"speed":{speed},"pitch":{pitch},"volume":{volume},"language":"{language}"}}'
                )
            )
            conn.commit()
            conn.close()

            stats = count_text_stats(text)

            return {
                "id": gen_id,
                "audio_url": f"/api/audio/file/{final_file.name}",
                "file_path": str(final_file),
                "duration_seconds": duration,
                "engine": engine_name,
                "voice_id": voice_id,
                "format": format_type,
                "sample_rate": DEFAULT_SAMPLE_RATE,
                "chunks_rendered": len(chunks),
                "stats": stats,
                "quality": audio_info
            }

        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

tts_orchestrator = TTSOrchestrator()

