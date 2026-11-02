"""
OpenVoice Studio — Pytest Test Suite
"""
import pytest
from app.services.chunker import chunk_text_to_sentences, count_text_stats
from app.services.dictionary import dictionary_service
from app.services.audio_dsp import AudioDSPService

def test_text_stats():
    stats = count_text_stats("Hello world. This is OpenVoice Studio.")
    assert stats["words"] == 6
    assert stats["sentences"] >= 1
    assert stats["characters"] > 0

def test_text_chunker():
    text = "Dr. Smith examined the U.S. report in 2026. Everything was normal! [pause:500] Next test."
    chunks = chunk_text_to_sentences(text, max_chars=100)
    assert len(chunks) >= 2
    assert any(c["pause_after_ms"] == 500 for c in chunks)

def test_pronunciation_dictionary():
    dictionary_service.add_override("AGY", "Antigravity")
    assert dictionary_service.apply("Welcome to AGY studio") == "Welcome to Antigravity studio"
    dictionary_service.remove_override("AGY")

def test_audio_dsp_availability():
    assert AudioDSPService.is_available() is True
