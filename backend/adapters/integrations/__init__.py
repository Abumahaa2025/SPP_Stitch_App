"""Phase-4 integrations — Sheets/GAS, Green API WhatsApp, Home Assistant.

All config is environment-based. Missing credentials degrade gracefully
(status reports disconnected; send/sensors fall back to existing paths).
"""

from .status import integration_status
from .green_api import green_configured, send_whatsapp_message
from .home_assistant import ha_configured, fetch_ha_sensors

__all__ = [
    "integration_status",
    "green_configured",
    "send_whatsapp_message",
    "ha_configured",
    "fetch_ha_sensors",
]
