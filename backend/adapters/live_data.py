"""Domain source resolution — gas / mongo / hybrid per env flag."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Awaitable, Callable, List, TypeVar

from adapters.gas_client import GasClient, GasClientError

logger = logging.getLogger(__name__)

T = TypeVar("T")

_gas_client: GasClient | None = None


def get_gas_client() -> GasClient:
    global _gas_client
    if _gas_client is None:
        _gas_client = GasClient()
    return _gas_client


def domain_source(domain: str) -> str:
    key = f"SPP_{domain.upper()}_SOURCE"
    return os.environ.get(key, os.environ.get("SPP_DATA_SOURCE", "mongo")).lower()


def beta_mode_enabled() -> bool:
    return os.environ.get("SPP_BETA_MODE", "false").lower() in ("1", "true", "yes")


async def resolve_domain(
    domain: str,
    gas_loader: Callable[[], T],
    mongo_loader: Callable[[], Awaitable[List[dict]]],
) -> List[dict]:
    if beta_mode_enabled():
        return await mongo_loader()

    mode = domain_source(domain)
    gas = get_gas_client()

    if mode == "mongo" or not gas.configured:
        return await mongo_loader()

    if mode == "gas":
        return await asyncio.to_thread(gas_loader)

    try:
        return await asyncio.to_thread(gas_loader)
    except GasClientError as exc:
        logger.warning("GAS %s fallback to Mongo: %s", domain, exc)
        try:
            return await mongo_loader()
        except Exception as mongo_exc:
            logger.warning("Mongo fallback failed for %s: %s", domain, mongo_exc)
            return []
