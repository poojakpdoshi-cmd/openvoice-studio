"""
OpenVoice Studio — Pronunciation Override Engine
"""
import re
from typing import Dict, List, Tuple

class PronunciationDictionary:
    def __init__(self):
        self._entries: Dict[str, str] = {
            "OpenVoice": "Open Voice",
            "TTS": "T T S",
            "API": "A P I",
            "SQL": "sequel",
            "GUI": "gooey",
            "URL": "U R L",
            "AI": "A I",
            "GHz": "gigahertz",
            "MHz": "megahertz",
            "kHz": "kilohertz",
            "FP32": "F P thirty-two",
            "FP16": "F P sixteen",
            "INT8": "int eight"
        }

    def add_override(self, word: str, replacement: str):
        self._entries[word.strip()] = replacement.strip()

    def remove_override(self, word: str):
        if word in self._entries:
            del self._entries[word]

    def get_all(self) -> Dict[str, str]:
        return dict(self._entries)

    def apply(self, text: str) -> str:
        if not text:
            return ""
        result = text
        for word, replacement in self._entries.items():
            pattern = r'\b' + re.escape(word) + r'\b'
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
        return result

dictionary_service = PronunciationDictionary()
