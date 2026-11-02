"""
OpenVoice Studio — Hardware Detection & Benchmarking
"""
import os
import platform
import subprocess
import shutil

def detect_hardware():
    info = {
        "os": platform.system(),
        "os_version": platform.version(),
        "architecture": platform.machine(),
        "cpu_count": os.cpu_count() or 4,
        "cpu_model": platform.processor() or "Unknown CPU",
        "has_gpu": False,
        "gpu_name": None,
        "gpu_vram_mb": 0,
        "recommended_engine": "piper",
        "performance_tier": "standard"
    }

    # Check for NVIDIA GPU via nvidia-smi
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=3
            )
            if res.returncode == 0 and res.stdout.strip():
                lines = res.stdout.strip().split("\n")
                if lines:
                    parts = lines[0].split(",")
                    info["has_gpu"] = True
                    info["gpu_name"] = parts[0].strip()
                    if len(parts) > 1:
                        try:
                            info["gpu_vram_mb"] = int(parts[1].strip())
                        except ValueError:
                            info["gpu_vram_mb"] = 4096
        except Exception:
            pass

    # Tier selection
    if info["has_gpu"] and info["gpu_vram_mb"] >= 6000:
        info["performance_tier"] = "pro_studio"
        info["recommended_engine"] = "kokoro"
    elif info["has_gpu"] or info["cpu_count"] >= 8:
        info["performance_tier"] = "standard"
        info["recommended_engine"] = "kokoro"
    else:
        info["performance_tier"] = "low_resource"
        info["recommended_engine"] = "piper"

    return info

