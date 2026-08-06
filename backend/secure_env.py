"""Secure environment loading for SPP backend.

- Loads secrets only from `.env` / process environment (never hardcode keys).
- Provides redaction helpers so logs and API errors never leak credentials.
- Keeps client-facing error payloads generic when DEBUG is off.
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent
_ENV_LOADED = False

# Patterns that must never appear in client responses or log lines.
_SECRET_PATTERNS = (
    re.compile(r"(?i)(mongodb(?:\+srv)?://)[^\s\"']+"),
    re.compile(r"(?i)(Bearer\s+)[A-Za-z0-9\-._~+/]+=*"),
    re.compile(r"(?i)(sk-|key-|xox[baprs]-)[A-Za-z0-9\-._]+"),
    re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"]?[^\s'\"]+"),
    re.compile(r"(?i)/[A-Za-z0-9_\-]{20,}/exec"),  # GAS deploy URLs often embed IDs
)


def load_secure_env(*, override: bool = False) -> Path:
    """Load backend/.env once. Safe to call repeatedly."""
    global _ENV_LOADED
    env_path = _ROOT / ".env"
    if not _ENV_LOADED or override:
        # Do not override already-set process env (CI / hosting secrets win).
        load_dotenv(env_path, override=override)
        _ENV_LOADED = True
    return env_path


def debug_enabled() -> bool:
    return (os.environ.get("SPP_DEBUG") or os.environ.get("DEBUG") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def get_env(name: str, default: str = "") -> str:
    """Read a non-secret config value (may have a safe default)."""
    load_secure_env()
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip()


def get_secret(name: str, *, required: bool = False) -> str:
    """Read a secret. Never logs the value. Empty string when unset."""
    load_secure_env()
    value = (os.environ.get(name) or "").strip()
    if required and not value:
        raise RuntimeError(f"Missing required secret: {name}")
    return value


def secret_configured(name: str) -> bool:
    return bool(get_secret(name))


def redact(text: str) -> str:
    """Strip credential-like substrings from a string."""
    if not text:
        return text
    out = text
    for pattern in _SECRET_PATTERNS:
        if pattern.pattern.startswith("(?i)(mongodb"):
            out = pattern.sub(r"\1[REDACTED]", out)
        elif pattern.pattern.startswith("(?i)(Bearer"):
            out = pattern.sub(r"\1[REDACTED]", out)
        else:
            out = pattern.sub("[REDACTED]", out)
    return out


def safe_client_message(
    *,
    code: str = "internal_error",
    public_message: str = "An unexpected error occurred. Please try again.",
    exc: Optional[BaseException] = None,
) -> dict:
    """Build an API error body that never exposes stack traces or secrets."""
    body: dict = {"ok": False, "code": code, "message": public_message}
    if debug_enabled() and exc is not None:
        body["debug"] = redact(f"{type(exc).__name__}: {exc}")
    return body


@lru_cache(maxsize=1)
def mongo_url() -> str:
    return get_env("MONGO_URL", "mongodb://localhost:27017")


@lru_cache(maxsize=1)
def mongo_db_name() -> str:
    return get_env("DB_NAME", "spp")


@lru_cache(maxsize=1)
def emergent_llm_key() -> str:
    return get_secret("EMERGENT_LLM_KEY")


@lru_cache(maxsize=1)
def spp_api_key() -> str:
    return get_secret("SPP_API_KEY")


def configure_secure_logging(logger: logging.Logger | None = None) -> None:
    """Attach a filter that redacts secrets from log records."""

    class _RedactFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
            try:
                if isinstance(record.msg, str):
                    record.msg = redact(record.msg)
                if record.args:
                    if isinstance(record.args, dict):
                        record.args = {k: redact(str(v)) if isinstance(v, str) else v for k, v in record.args.items()}
                    elif isinstance(record.args, tuple):
                        record.args = tuple(
                            redact(str(a)) if isinstance(a, str) else a for a in record.args
                        )
            except Exception:
                pass
            return True

    target = logger or logging.getLogger()
    # Avoid stacking duplicate filters on reload.
    if not any(isinstance(f, _RedactFilter) for f in target.filters):
        target.addFilter(_RedactFilter())


# Load on import so early module reads of os.environ still see .env values.
load_secure_env()
