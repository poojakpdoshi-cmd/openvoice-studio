"""
OpenVoice Studio — Multi-Voice Dialogue Studio Engine
Manages multi-character scripts, speaker voice assignments, segment-level rendering,
inter-speaker pauses, and final combined audio export.
"""
import uuid
import time
from pathlib import Path
from typing import Dict, Any, List

from ..core.config import AUDIO_DIR, DEFAULT_SAMPLE_RATE
from ..core.database import get_db
from .audio_dsp import AudioDSPService
from .tts_orchestrator import tts_orchestrator

class ProjectManager:
    @staticmethod
    def create_project(title: str, description: str = "") -> Dict[str, Any]:
        project_id = f"proj_{uuid.uuid4().hex[:10]}"
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO projects (id, title, description) VALUES (?, ?, ?)",
            (project_id, title.strip(), description.strip())
        )
        conn.commit()
        conn.close()
        return {"id": project_id, "title": title, "description": description}

    @staticmethod
    def get_project(project_id: str) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        proj = cursor.fetchone()
        if not proj:
            conn.close()
            raise ValueError(f"Project {project_id} not found.")

        cursor.execute(
            "SELECT * FROM project_segments WHERE project_id = ? ORDER BY sequence_order ASC",
            (project_id,)
        )
        segments = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return {
            "id": proj["id"],
            "title": proj["title"],
            "description": proj["description"],
            "created_at": proj["created_at"],
            "segments": segments
        }

    @staticmethod
    def add_segment(
        project_id: str,
        speaker_label: str,
        voice_id: str,
        text_content: str,
        pause_after_ms: int = 500,
        speed: float = 1.0,
        pitch: float = 0.0,
        volume: float = 1.0
    ) -> Dict[str, Any]:
        segment_id = f"seg_{uuid.uuid4().hex[:8]}"
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM project_segments WHERE project_id = ?",
            (project_id,)
        )
        seq = cursor.fetchone()[0]

        cursor.execute(
            """INSERT INTO project_segments 
               (id, project_id, sequence_order, speaker_label, voice_id, text_content, pause_after_ms, speed, pitch, volume)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (segment_id, project_id, seq, speaker_label, voice_id, text_content, pause_after_ms, speed, pitch, volume)
        )
        conn.commit()
        conn.close()

        return {
            "id": segment_id,
            "project_id": project_id,
            "sequence_order": seq,
            "speaker_label": speaker_label,
            "voice_id": voice_id,
            "text_content": text_content,
            "pause_after_ms": pause_after_ms,
            "speed": speed,
            "pitch": pitch,
            "volume": volume
        }

    @staticmethod
    def render_project(project_id: str, format_type: str = "wav") -> Dict[str, Any]:
        """
        Render all dialogue segments and combine them into a single continuous master track.
        """
        proj = ProjectManager.get_project(project_id)
        segments = proj["segments"]
        if not segments:
            raise ValueError("Cannot render an empty project. Add dialogue segments first.")

        temp_dir = AUDIO_DIR / f"temp_proj_{project_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)

        segment_audio_paths = []
        pauses = []

        try:
            for seg in segments:
                seg_out = temp_dir / f"{seg['id']}.wav"
                tts_orchestrator.generate_speech(
                    text=seg["text_content"],
                    voice_id=seg["voice_id"],
                    speed=seg["speed"],
                    pitch=seg["pitch"],
                    volume=seg["volume"],
                    format_type="wav"
                )
                # Find the generated file from orchestrator or re-render chunk
                # For direct guarantee, synthesize directly to seg_out
                adapter = tts_orchestrator.adapters.get("flite")
                adapter.synthesize_chunk(
                    text=seg["text_content"],
                    voice_id=seg["voice_id"],
                    output_path=str(seg_out),
                    speed=seg["speed"],
                    pitch=seg["pitch"],
                    volume=seg["volume"]
                )
                segment_audio_paths.append(str(seg_out))
                pauses.append(seg["pause_after_ms"])

            # Combine all speakers into continuous dialogue
            master_file = AUDIO_DIR / f"project_{project_id}.{format_type}"
            AudioDSPService.concatenate_segments(
                input_paths=segment_audio_paths,
                pauses_ms=pauses,
                output_path=str(master_file),
                sample_rate=DEFAULT_SAMPLE_RATE
            )

            audio_info = AudioDSPService.analyze_audio_quality(str(master_file))
            return {
                "project_id": project_id,
                "audio_url": f"/api/audio/file/{master_file.name}",
                "duration_seconds": audio_info["duration_seconds"],
                "segment_count": len(segments),
                "quality": audio_info
            }
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

