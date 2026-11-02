"""
OpenVoice Studio — Smart Text Chunking & Statistics Engine
"""
import re
from typing import List, Dict, Any

HONORIFICS = r'\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Gen|Col|Capt|Lt|Sgt|Rev|Hon)\.'
ABBREVIATIONS = r'\b(e\.g|i\.e|vs|etc|approx|dept|univ|est|fig|no|inc|ltd|co|corp)\.'
ACRONYMS = r'\b([A-Z]\.){2,}'

def count_text_stats(text: str, speaking_rate_wpm: float = 150.0) -> Dict[str, Any]:
    trimmed = text.strip()
    if not trimmed:
        return {
            "characters": 0,
            "characters_no_spaces": 0,
            "words": 0,
            "sentences": 0,
            "paragraphs": 0,
            "estimated_duration_seconds": 0.0
        }
    
    chars = len(trimmed)
    chars_no_spaces = len(re.sub(r'\s+', '', trimmed))
    words = len(re.findall(r'\b\w+\b', trimmed))
    paragraphs = len([p for p in trimmed.split('\n') if p.strip()])
    
    # Calculate sentences
    sentences = len(chunk_text_to_sentences(trimmed, max_chars=10000))
    estimated_seconds = round((words / max(speaking_rate_wpm, 50.0)) * 60.0, 1)

    return {
        "characters": chars,
        "characters_no_spaces": chars_no_spaces,
        "words": words,
        "sentences": sentences,
        "paragraphs": max(paragraphs, 1),
        "estimated_duration_seconds": estimated_seconds
    }

def chunk_text_to_sentences(text: str, max_chars: int = 350) -> List[Dict[str, Any]]:
    """
    Split text into sentence-level chunks suitable for TTS inference.
    Preserves pause markers [pause:Xms] or <break time="Xms"/>.
    """
    if not text or not text.strip():
        return []

    # Protect common periods from splitting
    protected = text
    protected = re.sub(HONORIFICS, lambda m: m.group(0).replace('.', '@PERIOD@'), protected, flags=re.IGNORECASE)
    protected = re.sub(ABBREVIATIONS, lambda m: m.group(0).replace('.', '@PERIOD@'), protected, flags=re.IGNORECASE)
    protected = re.sub(ACRONYMS, lambda m: m.group(0).replace('.', '@PERIOD@'), protected)
    protected = re.sub(r'(\d+)\.(\d+)', r'\1@DECIMAL@\2', protected)

    # Standard sentence terminal regex
    sentence_delimiters = r'([.!?]+[\s\n]+|[\n]{2,})'
    raw_parts = re.split(sentence_delimiters, protected)

    sentences = []
    current_sentence = ""

    for part in raw_parts:
        if not part:
            continue
        if re.match(r'^[.!?]+[\s\n]+$', part) or part.startswith('\n\n'):
            current_sentence += part
            if current_sentence.strip():
                sentences.append(current_sentence.strip())
            current_sentence = ""
        else:
            current_sentence += part

    if current_sentence.strip():
        sentences.append(current_sentence.strip())

    # Unprotect periods and decimals
    normalized_sentences = []
    for s in sentences:
        restored = s.replace('@PERIOD@', '.').replace('@DECIMAL@', '.')
        normalized_sentences.append(restored)

    # Secondary split for sentences that exceed max_chars
    final_chunks = []
    chunk_index = 0

    for s in normalized_sentences:
        if len(s) <= max_chars:
            chunk_data = _analyze_chunk(s, chunk_index)
            final_chunks.append(chunk_data)
            chunk_index += 1
        else:
            # Sub-split on clauses (commas, semicolons, em-dashes)
            subparts = re.split(r'([,;:\—\–\-]|\s+and\s+|\s+but\s+)', s)
            acc = ""
            for sub in subparts:
                if len(acc) + len(sub) <= max_chars:
                    acc += sub
                else:
                    if acc.strip():
                        final_chunks.append(_analyze_chunk(acc.strip(), chunk_index))
                        chunk_index += 1
                    acc = sub
            if acc.strip():
                final_chunks.append(_analyze_chunk(acc.strip(), chunk_index))
                chunk_index += 1

    return final_chunks

def _analyze_chunk(text: str, index: int) -> Dict[str, Any]:
    # Look for explicit pause token
    pause_ms = 0
    clean_text = text

    # Match [pause:500] or [pause:500ms]
    pause_match = re.search(r'\[pause:(\d+)(ms)?\]', clean_text, re.IGNORECASE)
    if pause_match:
        pause_ms = int(pause_match.group(1))
        clean_text = re.sub(r'\[pause:\d+(ms)?\]', '', clean_text, flags=re.IGNORECASE).strip()

    # Match <break time="500ms"/> or <break time="1s"/>
    break_match = re.search(r'<break\s+time=["\'](\d+)(ms|s)?["\']\s*/>', clean_text, re.IGNORECASE)
    if break_match:
        val = int(break_match.group(1))
        unit = break_match.group(2) or 'ms'
        pause_ms = val * 1000 if unit.lower() == 's' else val
        clean_text = re.sub(r'<break\s+time=["\']\d+(ms|s)?["\']\s*/>', '', clean_text, flags=re.IGNORECASE).strip()

    words = len(clean_text.split())
    # Estimate standard sentence duration
    est_duration = round((words / 150.0) * 60.0 + (pause_ms / 1000.0), 2)

    return {
        "index": index,
        "text": clean_text,
        "raw_text": text,
        "char_count": len(clean_text),
        "word_count": words,
        "pause_after_ms": pause_ms,
        "estimated_duration_seconds": max(est_duration, 0.5)
    }

