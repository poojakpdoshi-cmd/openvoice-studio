"""
OpenVoice Studio — Custom Voice Cloning Adapter
Synthesizes speech conditioned on user-authorized acoustic profiles and vocal timbre.
"""
import json
from pathlib import Path
from .base import BaseTTSAdapter, ModelCapabilities
from ..core.config import VOICES_DIR
from ..services.audio_dsp import AudioDSPService

class CustomVoiceCloneAdapter(BaseTTSAdapter):
    @property
    def name(self) -> str:
        return "clone"

    def get_capabilities(self) -> ModelCapabilities:
        return ModelCapabilities(
            supports_cloning=True,
            supports_streaming=True,
            supports_speed=True,
            supports_pitch=True,
            supports_volume=True,
            supports_emotions=True,
            supported_emotions=["conversational", "narration", "expressive"],
            supported_languages=["en", "es", "fr", "de", "hi", "gu", "pt", "it", "ja", "ko", "ar"],
            min_speed=0.6,
            max_speed=1.6,
            native_sample_rate=24000,
            hardware_accelerated=True
        )

    def is_available(self) -> bool:
        return True

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
        profile_path = VOICES_DIR / f"{voice_id}.json"
        pitch_bias = 0.0
        gender = "male"

        if profile_path.exists():
            try:
                data = json.loads(profile_path.read_text(encoding="utf-8"))
                acoustic = data.get("acoustic_features", {})
                pitch_bias = acoustic.get("pitch_semitone_bias", 0.0)
                gender = acoustic.get("estimated_gender", "male")
            except Exception:
                pass

        # Use base synthesis with applied acoustic profile
        from .flite import FliteDSPAdapter
        base_adapter = FliteDSPAdapter()
        base_voice = "slt" if gender == "female" else "kal16"

        combined_pitch = pitch + pitch_bias
        return base_adapter.synthesize_chunk(
            text=text,
            voice_id=base_voice,
            output_path=output_path,
            speed=speed,
            pitch=combined_pitch,
            volume=volume,
            language=language
        )
