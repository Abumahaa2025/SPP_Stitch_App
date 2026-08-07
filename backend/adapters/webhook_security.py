"""Shared webhook auth helpers — fail closed outside explicit beta/local.

Blueprint §§4.3, 15, 19 / System Architecture C-11:
unset secret accepting any request is a production defect.
"""

from __future__ import annotations

from adapters.settings import get_settings


def webhook_fail_open_allowed() -> bool:
    """True only for explicit beta / local / development environments."""
    return get_settings().webhook_fail_open_allowed()
