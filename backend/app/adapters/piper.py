"""
OpenVoice Studio — Piper TTS Adapter
VITS ONNX-based ultra-fast multi-language model adapter.
"""
import shutil
import subprocess
from pathlib import Path
from .base import BaseTTSAdapter, ModelCapabilities
from ..core.config import MODELS_DIR
from ..services.audio_dsp import AudioDSPService

class PiperAdapter(BaseTTSAdapter):
    def __init__(self):
        self.piper_bin = shutil.which("piper")

    @property
    def name(self) -> str:
        return "piper"

    def get_capabilities(self) -> ModelCapabilities:
        return ModelCapabilities(
            supports_cloning=False,
            supports_streaming=True,
            supports_speed=True,
            supports_pitch=False,
            supports_volume=True,
            supports_emotions=False,
            supported_emotions=[],
            supported_languages=[
                "en", "en-US", "en-GB", "es", "fr", "de", "hi", "gu",
                "pt", "it", "ja", "ko", "ar", "nl", "pl", "ru", "tr", "sv", "uk"
            ],
            min_speed=0.5,
            max_speed=2.0,
            native_sample_rate=22050,
            hardware_accelerated=False
        )

    def is_available(self) -> bool:
        return self.piper_bin is not None or (MODELS_DIR / "piper").exists()

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
        # Check if local piper executable and voice onnx exist
        voice_model_path = MODELS_DIR / "piper" / f"{voice_id}.onnx"
        if self.piper_bin and voice_model_path.exists():
            cmd = [
                self.piper_bin,
                "--model", str(voice_model_path),
                "--output_file", output_path,
                "--length_scale", str(1.0 / max(0.2, speed))
            ]
            p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            p.communicate(input=text)
            if pitch != 0.0 or volume != 1.0:
                AudioDSPService.apply_speech_fx(output_path, output_path, speed=1.0, pitch_shift_semitones=pitch, volume=volume, sample_rate=22050)
            return output_path
        else:
            # Fallback to high-speed synthesizer
            from .flite import FliteDSPAdapter
            flite = FliteDSPAdapter()
            base_voice = "slt" if "female" in voice_id or "amy" in voice_id or "eva" in voice_id else "kal16"
            return flite.synthesize_chunk(text, base_voice, output_path, speed=speed, pitch=pitch, volume=volume, language=language)
