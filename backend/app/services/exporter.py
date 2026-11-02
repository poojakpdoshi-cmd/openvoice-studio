"""
OpenVoice Studio — Multi-Format Audio Export Engine
"""
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

FFMPEG_BIN = shutil.which("ffmpeg") or "ffmpeg"

class AudioExporter:
    @staticmethod
    def export(
        input_path: str,
        output_path: str,
        format_type: str = "wav",
        sample_rate: int = 24000,
        bit_depth: int = 16,
        channels: int = 1,
        mp3_bitrate: str = "256k",
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Export master audio file with high fidelity and proper metadata tagging.
        """
        format_type = format_type.lower()
        cmd = [FFMPEG_BIN, "-y", "-i", input_path]

        # Sample rate
        cmd.extend(["-ar", str(sample_rate)])

        # Channels (1 = mono, 2 = stereo)
        cmd.extend(["-ac", str(channels)])

        # Format specific codecs
        if format_type == "wav":
            if bit_depth == 24:
                cmd.extend(["-c:a", "pcm_s24le"])
            else:
                cmd.extend(["-c:a", "pcm_s16le"])
        elif format_type == "mp3":
            cmd.extend(["-c:a", "libmp3lame", "-b:a", mp3_bitrate])
        elif format_type == "flac":
            cmd.extend(["-c:a", "flac", "-compression_level", "5"])
        elif format_type == "ogg":
            cmd.extend(["-c:a", "libvorbis", "-q:a", "6"])
        else:
            raise ValueError(f"Unsupported export format: {format_type}")

        # Metadata & AI Disclosure Watermark
        meta_tags = {
            "title": "OpenVoice Studio Synthesis",
            "artist": "OpenVoice Studio",
            "album": "AI Speech Generation",
            "comment": "Synthesized with OpenVoice Studio (Open-Source AI Speech Platform)"
        }
        if metadata:
            meta_tags.update(metadata)

        for k, v in meta_tags.items():
            cmd.extend(["-metadata", f"{k}={v}"])

        cmd.append(output_path)
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return output_path

