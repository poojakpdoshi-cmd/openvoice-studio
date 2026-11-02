"""
OpenVoice Studio — Flite DSP Speech Adapter
Built-in, zero-dependency, ultra-fast speech synthesis via FFmpeg libflite filter.
"""
import subprocess
import shutil
import re
from pathlib import Path
from .base import BaseTTSAdapter, ModelCapabilities
from ..services.audio_dsp import AudioDSPService

class FliteDSPAdapter(BaseTTSAdapter):
    @property
    def name(self) -> str:
        return "flite"

    def get_capabilities(self) -> ModelCapabilities:
        return ModelCapabilities(
            supports_cloning=False,
            supports_streaming=True,
            supports_speed=True,
            supports_pitch=True,
            supports_volume=True,
            supports_emotions=False,
            supported_emotions=[],
            supported_languages=["en", "en-US", "en-GB"],
            min_speed=0.5,
            max_speed=2.0,
            native_sample_rate=16000,
            hardware_accelerated=False
        )

    def is_available(self) -> bool:
        return AudioDSPService.is_available()

    def synthesize_chunk(
        self,
        text: str,
        voice_id: str,
        output_path: str,
        speed: float = 1.0,
        pitch: float = 0.0,
        volume: float = 1.0,
        language: str = "en"
    ) -> str:
        flite_voice = "kal16"
        if "awb" in voice_id:
            flite_voice = "awb"
        elif "rms" in voice_id:
            flite_voice = "rms"
        elif "slt" in voice_id:
            flite_voice = "slt"

        # Sanitize text for flite filter (escape single quotes and colons)
        safe_text = text.replace("'", "").replace(":", " - ").replace('"', '')
        if not safe_text.strip():
            safe_text = "..."

        temp_raw = Path(output_path).with_suffix(".raw.wav")
        ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
        
        cmd = [
            ffmpeg_bin, "-y",
            "-f", "lavfi",
            "-i", f"flite=text='{safe_text}':voice={flite_voice}",
            "-c:a", "pcm_s16le",
            "-ar", "16000",
            str(temp_raw)
        ]
        
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

        # Apply DSP FX (pitch shifting, speed, volume)
        try:
            AudioDSPService.apply_speech_fx(
                input_path=str(temp_raw),
                output_path=output_path,
                speed=speed,
                pitch_shift_semitones=pitch,
                volume=volume,
                sample_rate=16000
            )
        finally:
            if temp_raw.exists():
                temp_raw.unlink(missing_ok=True)

        return output_path
