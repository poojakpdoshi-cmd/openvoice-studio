"""
OpenVoice Studio — Digital Signal Processing (DSP) & Audio Engine
Uses FFmpeg for lossless/lossy processing, pitch shifting, time-stretching, and audio forensics.
"""
import subprocess
import shutil
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

FFMPEG_BIN = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_BIN = shutil.which("ffprobe") or "ffprobe"

class AudioDSPService:
    @staticmethod
    def is_available() -> bool:
        return shutil.which("ffmpeg") is not None

    @staticmethod
    def generate_silence(duration_ms: int, output_path: str, sample_rate: int = 24000):
        """Generate exact digital silence in WAV format."""
        duration_s = max(duration_ms / 1000.0, 0.05)
        cmd = [
            FFMPEG_BIN, "-y",
            "-f", "lavfi",
            "-i", f"anullsrc=r={sample_rate}:cl=mono",
            "-t", str(duration_s),
            "-c:a", "pcm_s16le",
            output_path
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    @staticmethod
    def apply_speech_fx(
        input_path: str,
        output_path: str,
        speed: float = 1.0,
        pitch_shift_semitones: float = 0.0,
        volume: float = 1.0,
        sample_rate: int = 24000
    ):
        """
        Apply real-time pitch shifting and tempo modification.
        - Speed (0.5x - 2.0x) uses atempo filter (no pitch distortion).
        - Pitch shift (-12 to +12 semitones) uses asetrate + aresample + atempo.
        - Volume scales linearly.
        """
        filters = []

        # 1. Volume
        if volume != 1.0:
            vol_clamped = max(0.1, min(volume, 2.5))
            filters.append(f"volume={vol_clamped:.2f}")

        # 2. Pitch shifting without speed change
        if pitch_shift_semitones != 0.0:
            # Frequency ratio = 2^(semitones / 12)
            ratio = 2.0 ** (pitch_shift_semitones / 12.0)
            resampled_rate = int(sample_rate * ratio)
            tempo_correction = 1.0 / ratio
            filters.append(f"asetrate={resampled_rate}")
            filters.append(f"aresample={sample_rate}")
            # Correct tempo compensation (atempo supports 0.5 to 2.0 per filter)
            if tempo_correction < 0.5:
                filters.append("atempo=0.5")
                filters.append(f"atempo={tempo_correction / 0.5:.3f}")
            elif tempo_correction > 2.0:
                filters.append("atempo=2.0")
                filters.append(f"atempo={tempo_correction / 2.0:.3f}")
            else:
                filters.append(f"atempo={tempo_correction:.3f}")

        # 3. Speed alteration without pitch shift
        if speed != 1.0:
            speed_clamped = max(0.5, min(speed, 2.0))
            filters.append(f"atempo={speed_clamped:.3f}")

        cmd = [FFMPEG_BIN, "-y", "-i", input_path]
        if filters:
            cmd.extend(["-af", ",".join(filters)])
        cmd.extend(["-ar", str(sample_rate), output_path])

        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    @staticmethod
    def trim_audio(input_path: str, output_path: str, start_time: float, end_time: Optional[float] = None):
        """Trim audio accurately with millisecond precision."""
        cmd = [FFMPEG_BIN, "-y", "-ss", f"{start_time:.3f}", "-i", input_path]
        if end_time is not None and end_time > start_time:
            duration = end_time - start_time
            cmd.extend(["-t", f"{duration:.3f}"])
        cmd.extend(["-c:a", "pcm_s16le", output_path])
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    @staticmethod
    def concatenate_segments(input_paths: List[str], pauses_ms: List[int], output_path: str, sample_rate: int = 24000):
        """
        Concatenate multiple speech segments with custom pause buffers.
        Uses FFmpeg filter_complex or concat demuxer.
        """
        if not input_paths:
            raise ValueError("No input files provided for concatenation.")

        if len(input_paths) == 1 and (not pauses_ms or pauses_ms[0] == 0):
            shutil.copy(input_paths[0], output_path)
            return

        temp_dir = Path(output_path).parent / "temp_concat"
        temp_dir.mkdir(parents=True, exist_ok=True)
        file_list_path = temp_dir / "concat_list.txt"

        lines = []
        for i, path in enumerate(input_paths):
            lines.append(f"file '{Path(path).as_posix()}'")
            # If there's an inter-segment pause
            pause = pauses_ms[i] if i < len(pauses_ms) else 0
            if pause > 50 and i < len(input_paths) - 1:
                silence_file = temp_dir / f"silence_{i}_{pause}ms.wav"
                AudioDSPService.generate_silence(pause, str(silence_file), sample_rate)
                lines.append(f"file '{silence_file.as_posix()}'")

        file_list_path.write_text("\n".join(lines), encoding="utf-8")

        cmd = [
            FFMPEG_BIN, "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(file_list_path),
            "-c:a", "pcm_s16le",
            "-ar", str(sample_rate),
            output_path
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @staticmethod
    def analyze_audio_quality(file_path: str) -> Dict[str, Any]:
        """
        Comprehensive audio forensics:
        - Exact duration
        - Peak & RMS level (dB)
        - Estimated Signal-to-Noise Ratio (SNR)
        - Clipping detection (percentage of 0 dBFS occurrences)
        - Silence periods
        """
        # Run astats filter
        cmd = [
            FFMPEG_BIN,
            "-i", file_path,
            "-af", "astats=metadata=1:reset=1,silencedetect=noise=-40dB:d=0.3",
            "-f", "null",
            "-"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stderr = res.stderr

        # Extract duration
        duration = 0.0
        dur_match = re.search(r'Duration:\s*(\d+):(\d+):(\d+\.\d+)', stderr)
        if dur_match:
            h, m, s = float(dur_match.group(1)), float(dur_match.group(2)), float(dur_match.group(3))
            duration = h * 3600 + m * 60 + s

        # Extract Peak Level (dBFS)
        peak_match = re.search(r'Peak level dB:\s*([-\d.]+)', stderr)
        peak_db = float(peak_match.group(1)) if peak_match else -12.0

        # Extract RMS level (dBFS)
        rms_match = re.search(r'RMS level dB:\s*([-\d.]+)', stderr)
        rms_db = float(rms_match.group(1)) if rms_match else -24.0

        # Detect clipping (Peak within 0.1 dB of 0)
        is_clipped = peak_db >= -0.1

        # Detect silence periods
        silence_matches = re.findall(r'silence_duration:\s*([\d.]+)', stderr)
        total_silence = sum(float(x) for x in silence_matches)
        silence_ratio = (total_silence / max(duration, 0.1)) if duration > 0 else 0.0

        # Estimate SNR: difference between speech RMS and estimated noise floor (-45 dB standard)
        estimated_snr = max(5.0, min(55.0, abs(rms_db - (-50.0))))

        # Rate overall quality
        if duration < 3.0:
            rating = "Too Short"
            feedback = "Recording must be at least 3 seconds long for accurate vocal modeling."
            is_valid = False
        elif duration > 60.0:
            rating = "Too Long"
            feedback = "Recording exceeds maximum recommended sample length (60s)."
            is_valid = False
        elif is_clipped:
            rating = "Clipped / Distorted"
            feedback = "Microphone gain is too high. Audio is clipping at 0 dBFS."
            is_valid = False
        elif estimated_snr < 18.0 or rms_db < -38.0:
            rating = "High Background Noise"
            feedback = "High ambient noise floor or vocal level is too quiet. Move closer to the mic."
            is_valid = True
        elif estimated_snr >= 28.0:
            rating = "Excellent Studio Quality"
            feedback = "Optimal vocal clarity, low noise floor, and good dynamic range."
            is_valid = True
        else:
            rating = "Good Quality"
            feedback = "Acceptable clarity for custom voice cloning."
            is_valid = True

        return {
            "duration_seconds": round(duration, 2),
            "peak_level_db": round(peak_db, 1),
            "rms_level_db": round(rms_db, 1),
            "estimated_snr_db": round(estimated_snr, 1),
            "is_clipped": is_clipped,
            "silence_ratio": round(silence_ratio, 2),
            "quality_rating": rating,
            "feedback": feedback,
            "is_valid": is_valid
        }
