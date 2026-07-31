"""Read-only client for SPP_Official Google Apps Script API (lite actions)."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SEC = 30
_LITE_TIMEOUT_SEC = 45


class GasClientError(Exception):
    pass


class GasClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = _LITE_TIMEOUT_SEC,
    ) -> None:
        self.base_url = (base_url or os.environ.get("GOOGLE_APPS_SCRIPT_URL", "")).rstrip("/")
        self.api_key = api_key or os.environ.get("SPP_API_KEY", "")
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    def _cache_get(self, action: str) -> Optional[Dict[str, Any]]:
        entry = _CACHE.get(action)
        if not entry:
            return None
        if (time.time() - entry["at"]) >= _CACHE_TTL_SEC:
            return None
        return entry["data"]

    def _cache_put(self, action: str, data: Dict[str, Any]) -> Dict[str, Any]:
        _CACHE[action] = {"data": data, "at": time.time()}
        return data

    def _get(self, action: str, params: Optional[Dict[str, str]] = None) -> Any:
        if not self.configured:
            raise GasClientError("GOOGLE_APPS_SCRIPT_URL is not configured")

        query: Dict[str, str] = {"view": "api", "action": action}
        if self.api_key:
            query["apiKey"] = self.api_key
        if params:
            query.update(params)

        try:
            resp = requests.get(self.base_url, params=query, timeout=self.timeout)
            resp.raise_for_status()
            if resp.text.lstrip().startswith("<"):
                raise GasClientError(
                    "GAS returned HTML instead of JSON - check Web App deploy access (Anyone)"
                )
            envelope = resp.json()
        except requests.RequestException as exc:
            raise GasClientError(f"GAS request failed: {exc}") from exc
        except ValueError as exc:
            raise GasClientError("GAS returned invalid JSON") from exc

        if envelope.get("status") != "success":
            raise GasClientError(envelope.get("message") or f"GAS error for {action}")

        return envelope.get("data")

    def _get_lite(self, action: str) -> Dict[str, Any]:
        cached = self._cache_get(action)
        if cached is not None:
            return cached

        data = self._get(action)
        if not isinstance(data, dict):
            raise GasClientError(f"{action} returned unexpected shape")
        return self._cache_put(action, data)

    def health_check(self) -> Dict[str, Any]:
        data = self._get("healthCheck")
        return data if isinstance(data, dict) else {}

    def get_dashboard_lite(self) -> Dict[str, Any]:
        return self._get_lite("getDashboardLite")

    def get_properties_lite(self) -> Dict[str, Any]:
        return self._get_lite("getPropertiesLite")

    def get_tenants_lite(self) -> Dict[str, Any]:
        return self._get_lite("getTenantsLite")

    def get_contracts_lite(self) -> Dict[str, Any]:
        return self._get_lite("getContractsLite")

    def get_decisions_lite(self) -> Dict[str, Any]:
        return self._get_lite("getDecisionsLite")

    def get_reports_lite(self) -> Dict[str, Any]:
        return self._get_lite("getReportsLite")

    def get_alerts_lite(self) -> Dict[str, Any]:
        return self._get_lite("getAlertsLite")

    def get_memory_lite(self) -> Dict[str, Any]:
        return self._get_lite("getPropertyMemoryLite")

    def get_app_data(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Legacy alias — returns dashboard lite bundle only."""
        if force_refresh:
            _CACHE.clear()
        return self.get_dashboard_lite()

    def post_action(self, action: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """POST write/read action to GAS unified API (Smart Import, PDF, commit)."""
        if not self.configured:
            raise GasClientError("GOOGLE_APPS_SCRIPT_URL is not configured")

        body: Dict[str, Any] = {"action": action, "params": params or {}}
        if self.api_key:
            body["apiKey"] = self.api_key

        try:
            resp = requests.post(
                self.base_url,
                json=body,
                timeout=max(self.timeout, 90),
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            if resp.text.lstrip().startswith("<"):
                raise GasClientError(
                    "GAS returned HTML instead of JSON - check Web App deploy access (Anyone)"
                )
            envelope = resp.json()
        except requests.RequestException as exc:
            raise GasClientError(f"GAS POST failed: {exc}") from exc
        except ValueError as exc:
            raise GasClientError("GAS returned invalid JSON") from exc

        if envelope.get("status") != "success":
            raise GasClientError(envelope.get("message") or f"GAS error for {action}")

        return envelope.get("data")
