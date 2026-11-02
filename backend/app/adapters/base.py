"""
OpenVoice Studio — Base TTS Model Adapter Interface
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

@dataclass
class ModelCapabilities:
    supports_cloning: bool = False
    supports_streaming: bool = True
    supports_speed: bool = True
    supports_pitch: bool = False
    supports_volume: bool = True
    supports_emotions: bool = False
    supported_emotions: List[str] = field(default_factory=list)
    supported_languages: List[str] = field(default_factory=list)
    min_speed: float = 0.5
    max_speed: float = 2.0
    native_sample_rate: int = 24000
    hardware_accelerated: bool = False

class BaseTTSAdapter(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Adapter unique identifier (e.g. 'kokoro', 'piper', 'flite')"""
        pass

    @abstractmethod
    def get_capabilities(self) -> ModelCapabilities:
        """Return the precise technical capabilities of this model."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if model files or runtimes are present."""
        pass

    @abstractmethod
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
        """Synthesize a single text chunk to a WAV audio file."""
        pass

