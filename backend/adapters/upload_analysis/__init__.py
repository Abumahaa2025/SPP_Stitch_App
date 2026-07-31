"""Portfolio analysis from uploaded file manifests + live domain data."""

from __future__ import annotations

from typing import Any


def analyze_upload_portfolio(*args: Any, **kwargs: Any):
    from .portfolio_engine import analyze_upload_portfolio as _fn

    return _fn(*args, **kwargs)


__all__ = ["analyze_upload_portfolio"]
