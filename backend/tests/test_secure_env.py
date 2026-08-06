"""Unit tests for secure_env redaction and client-safe errors."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from secure_env import debug_enabled, redact, safe_client_message


def test_redact_mongo_url():
    raw = "failed connect mongodb://user:pass@cluster.example/db"
    out = redact(raw)
    assert "pass@" not in out
    assert "[REDACTED]" in out


def test_redact_api_key_fragments():
    raw = "upstream rejected sk-abcDEF1234567890token"
    out = redact(raw)
    assert "sk-abc" not in out
    assert "[REDACTED]" in out


def test_safe_client_message_hides_exception_by_default(monkeypatch):
    monkeypatch.delenv("SPP_DEBUG", raising=False)
    monkeypatch.delenv("DEBUG", raising=False)
    body = safe_client_message(exc=RuntimeError("mongodb://user:secret@host/db"))
    assert body["ok"] is False
    assert "secret" not in str(body)
    assert "debug" not in body


def test_safe_client_message_debug_is_redacted(monkeypatch):
    monkeypatch.setenv("SPP_DEBUG", "true")
    assert debug_enabled() is True
    body = safe_client_message(exc=RuntimeError("mongodb://user:secret@host/db"))
    assert "debug" in body
    assert "secret" not in body["debug"]
