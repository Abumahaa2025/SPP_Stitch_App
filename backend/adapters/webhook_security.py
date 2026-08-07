"""Shared webhook auth helpers — fail closed outside explicit beta/local.

Blueprint §§4.3, 15, 19 / System Architecture C-11:
unset secret accepting any request is a production defect.
"""

from __future__ import annotations

import os


def webhook_fail_open_allowed() -> bool:
    """True only for explicit beta / local / development environments."""
    if os.environ.get("SPP_BETA_MODE", "").lower() in ("1", "true", "yes"):
        return True
    env = (os.environ.get("SPP_ENV") or os.environ.get("ENV") or "").strip().lower()
    return env in ("local", "dev", "development", "beta")
