"""SPP Backend — AI Operating System for Real Estate.

Modular AI layer (currently GPT-5.2 via Emergent Universal Key) powering:
- AI Employee daily briefing
- AI Decisions
- Property Health
- Predictive Maintenance
- Unified Brain chat
"""

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import time
import asyncio
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from adapters.gas_client import GasClientError
from adapters.live_data import domain_source, get_gas_client, resolve_domain, beta_mode_enabled
from adapters.executive.brain import build_executive_brain
from adapters.canonical.pipeline import (
    insights_to_api,
    legacy_api_payload,
    memory_graph_to_dict,
    portfolio_from_bundles,
)
from adapters.executive_intelligence.engine import generate_insights
from adapters.mappers.briefing import build_briefing
from adapters.mappers.verdicts import build_verdicts
from adapters.mappers.contracts import map_contracts_from_app_data, reconcile_contracts
from adapters.mappers.decisions import map_decisions_from_app_data
from adapters.mappers.notifications import map_notifications_from_app_data
from adapters.mappers.ai_notifications import derive_notifications_from_ai_state
from adapters.mappers.common import slug
from adapters.decision_approvals import (
    ApprovalValidationError,
    build_approval_record,
    find_decision,
)
from adapters.mappers.properties import map_properties_from_app_data
from adapters.mappers.reports import map_reports_from_app_data
from adapters.mappers.tenants import map_tenants_from_app_data
from beta_seed import beta_dataset, verify_beta_login, BETA_ACCOUNTS
from adapters.upload_analysis import analyze_upload_portfolio
from adapters.gas_import_bridge import (
    analyze_upload_with_gas_fallback,
    apply_gas_import,
    build_local_apply_commit,
    create_gas_owner_pdf,
    gas_import_available,
)
# AI Property Employee (Phase 1 — additive, no changes to existing endpoints)
from adapters.ai_employee import (
    build_employee_context,
    build_system_prompt,
    classify_intent,
    generate_proactive_suggestions,
    retrieve_relevant_memory,
)
# Gap 6 — LLM interpretation layer (controlled, environment-based)
from adapters.llm import LLMRequest, LLMService

# In-memory portfolio for beta builds when Mongo is unavailable
_memory_db: Dict[str, List[dict]] = {}

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Mongo (optional — required only when SPP_*_SOURCE=mongo without GAS)
# ---------------------------------------------------------------------------
_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_available = False
_MONGO_TIMEOUT_MS = 3000


def _get_db():
    global _mongo_client
    name = os.environ.get("DB_NAME", "spp")
    if _mongo_client is None:
        url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        _mongo_client = AsyncIOMotorClient(
            url,
            serverSelectionTimeoutMS=_MONGO_TIMEOUT_MS,
            connectTimeoutMS=_MONGO_TIMEOUT_MS,
        )
    return _mongo_client[name]


async def _mongo_ping() -> bool:
    try:
        await _get_db().command("ping")
        return True
    except Exception:
        return False


def _gas_live_mode() -> bool:
    if beta_mode_enabled():
        return False
    gas = get_gas_client()
    if not gas.configured:
        return False
    if os.environ.get("SPP_DATA_SOURCE", "mongo").lower() in ("gas", "hybrid"):
        return True
    for domain in ("PROPERTIES", "TENANTS", "CONTRACTS", "DECISIONS", "REPORTS", "ALERTS"):
        if domain_source(domain) in ("gas", "hybrid"):
            return True
    return False

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="SPP — Smart Property Platform")
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# AI Layer (swappable). Currently OpenAI GPT-5.2 via Emergent LLM key.
# ---------------------------------------------------------------------------
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
AI_PROVIDER = "openai"
AI_MODEL = "gpt-5.2"

SPP_SYSTEM_PROMPT = (
    "You are the AI Employee inside SPP (Smart Property Platform), an AI Operating "
    "System for real estate. You think like a seasoned property advisor. "
    "Your voice is calm, confident, and premium — think Superhuman meets Linear. "
    "Never present raw data — always answer 'what should the owner do next'. "
    "Prefer short, elegant sentences. No emojis. No filler."
)


def get_llm_chat(session_id: str, system_message: str = SPP_SYSTEM_PROMPT):
    """Factory so we can later swap provider/model without touching callers."""
    from emergentintegrations.llm.chat import LlmChat  # local import: keeps startup fast
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(AI_PROVIDER, AI_MODEL)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Property(BaseModel):
    id: str
    name: str
    address: str
    city: str
    kind: str  # villa | apartment | penthouse | office
    units: int
    occupancy: float  # 0..1
    monthly_revenue: float
    health_score: int  # 0..100
    hero_image: str
    tenant_ids: List[str] = []
    owner_id: str


class Owner(BaseModel):
    id: str
    name: str
    portfolio_value: float
    properties: int


class Tenant(BaseModel):
    id: str
    name: str
    property_id: str
    unit: str
    since: str
    rent: float
    reliability: int  # 0..100


class Contract(BaseModel):
    id: str
    tenant_id: str
    property_id: str
    start: str
    end: str
    monthly_rent: float
    status: str  # active | expiring | renewed


class Decision(BaseModel):
    id: str
    priority: str  # critical | high | medium | low
    kind: str  # maintenance | financial | tenant | opportunity
    title: str
    reason: str
    impact: str
    recommended_action: str
    confidence: int  # 0..100
    property_id: Optional[str] = None
    created_at: str


class TimelineEvent(BaseModel):
    id: str
    property_id: str
    kind: str
    title: str
    subtitle: str
    at: str


class Sensor(BaseModel):
    id: str
    property_id: str
    kind: str  # temperature | humidity | leak | occupancy | energy | air_quality
    label: str
    value: float
    unit: str
    status: str  # nominal | attention | critical
    trend: str  # up | down | flat


class Notification(BaseModel):
    id: str
    title: str
    body: str
    priority: str
    at: str
    read: bool = False


class ChatMessage(BaseModel):
    id: str
    role: str
    text: str
    at: str


class ChatRequest(BaseModel):
    session_id: str
    text: str


# ---------------------------------------------------------------------------
# Seed data — feels alive on first launch
# ---------------------------------------------------------------------------
def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _seed_dataset() -> Dict[str, List[dict]]:
    now = datetime.now(timezone.utc)

    owners = [
        {"id": "own_1", "name": "Alexander Vale", "portfolio_value": 24_800_000, "properties": 4},
    ]

    properties = [
        {
            "id": "prop_1",
            "name": "Marina Crest Residences",
            "address": "12 Harbour Row",
            "city": "Dubai Marina",
            "kind": "penthouse",
            "units": 3,
            "occupancy": 1.0,
            "monthly_revenue": 68_500,
            "health_score": 92,
            "hero_image": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
            "tenant_ids": ["ten_1", "ten_2"],
            "owner_id": "own_1",
        },
        {
            "id": "prop_2",
            "name": "Onyx Sky Loft",
            "address": "88 Emerald Ave",
            "city": "Downtown",
            "kind": "apartment",
            "units": 8,
            "occupancy": 0.875,
            "monthly_revenue": 42_200,
            "health_score": 78,
            "hero_image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200",
            "tenant_ids": ["ten_3"],
            "owner_id": "own_1",
        },
        {
            "id": "prop_3",
            "name": "The Palm Villa",
            "address": "Frond H, Palm",
            "city": "Palm Jumeirah",
            "kind": "villa",
            "units": 1,
            "occupancy": 1.0,
            "monthly_revenue": 55_000,
            "health_score": 88,
            "hero_image": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200",
            "tenant_ids": ["ten_4"],
            "owner_id": "own_1",
        },
        {
            "id": "prop_4",
            "name": "Aurum Office Tower",
            "address": "1 Gold Boulevard",
            "city": "Business Bay",
            "kind": "office",
            "units": 14,
            "occupancy": 0.71,
            "monthly_revenue": 96_000,
            "health_score": 64,
            "hero_image": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200",
            "tenant_ids": [],
            "owner_id": "own_1",
        },
    ]

    tenants = [
        {"id": "ten_1", "name": "Priya Kapoor", "property_id": "prop_1", "unit": "PH-01", "since": "2023-06-01", "rent": 24_000, "reliability": 98},
        {"id": "ten_2", "name": "Marcus Reed", "property_id": "prop_1", "unit": "PH-02", "since": "2024-02-15", "rent": 22_500, "reliability": 92},
        {"id": "ten_3", "name": "Sana Al-Farsi", "property_id": "prop_2", "unit": "12B", "since": "2022-09-01", "rent": 8_400, "reliability": 87},
        {"id": "ten_4", "name": "Leon Costa", "property_id": "prop_3", "unit": "Villa", "since": "2021-04-10", "rent": 55_000, "reliability": 95},
    ]

    contracts = [
        {"id": "ct_1", "tenant_id": "ten_1", "property_id": "prop_1", "start": "2023-06-01", "end": "2028-06-01", "monthly_rent": 24_000, "status": "active"},
        {"id": "ct_2", "tenant_id": "ten_2", "property_id": "prop_1", "start": "2024-02-15", "end": _iso(now + timedelta(days=34))[:10], "monthly_rent": 22_500, "status": "expiring"},
        {"id": "ct_3", "tenant_id": "ten_3", "property_id": "prop_2", "start": "2022-09-01", "end": _iso(now + timedelta(days=58))[:10], "monthly_rent": 8_400, "status": "expiring"},
        {"id": "ct_4", "tenant_id": "ten_4", "property_id": "prop_3", "start": "2021-04-10", "end": "2029-04-10", "monthly_rent": 55_000, "status": "active"},
    ]

    decisions = [
        {
            "id": "d_1", "priority": "high", "kind": "maintenance",
            "title": "HVAC on Marina Crest is trending toward failure",
            "reason": "Compressor cycle variance up 34% over 21 days. Historical pattern predicts breakdown within 9–14 days.",
            "impact": "Prevents ≈ AED 42,000 emergency service + 2 tenant complaints.",
            "recommended_action": "Schedule preventive service for Thursday morning.",
            "confidence": 92, "property_id": "prop_1",
            "created_at": _iso(now - timedelta(hours=2)),
        },
        {
            "id": "d_2", "priority": "critical", "kind": "financial",
            "title": "Aurum Office Tower yield below target for 3 months",
            "reason": "Occupancy 71% vs market 84%. Two competing towers dropped rate 8%.",
            "impact": "Recover ≈ AED 168,000 annualized revenue.",
            "recommended_action": "Approve a 6% incentive on new leases and re-list two floors.",
            "confidence": 88, "property_id": "prop_4",
            "created_at": _iso(now - timedelta(hours=5)),
        },
        {
            "id": "d_3", "priority": "medium", "kind": "tenant",
            "title": "Marcus Reed contract renewal window opens",
            "reason": "Contract expires in 34 days. Tenant reliability 92, on-time 24 of 24 months.",
            "impact": "Retention avoids ≈ AED 60,000 vacancy + turnover cost.",
            "recommended_action": "Send renewal offer with 4% increase, locked 24 months.",
            "confidence": 95, "property_id": "prop_1",
            "created_at": _iso(now - timedelta(hours=9)),
        },
        {
            "id": "d_4", "priority": "low", "kind": "opportunity",
            "title": "Palm Villa comparables suggest higher rent",
            "reason": "3 comparable villas leased 8–11% above your rate in last 60 days.",
            "impact": "Uplift ≈ AED 5,000 per month at next renewal.",
            "recommended_action": "Plan rate review for renewal cycle in Q1.",
            "confidence": 76, "property_id": "prop_3",
            "created_at": _iso(now - timedelta(days=1)),
        },
    ]

    timeline = [
        {"id": "t_1", "property_id": "prop_1", "kind": "ai", "title": "AI detected HVAC drift", "subtitle": "Compressor variance rising", "at": _iso(now - timedelta(hours=2))},
        {"id": "t_2", "property_id": "prop_4", "kind": "financial", "title": "Occupancy dipped below 75%", "subtitle": "Third consecutive month", "at": _iso(now - timedelta(days=2))},
        {"id": "t_3", "property_id": "prop_1", "kind": "tenant", "title": "Rent received", "subtitle": "Priya Kapoor · AED 24,000", "at": _iso(now - timedelta(days=3))},
        {"id": "t_4", "property_id": "prop_3", "kind": "maintenance", "title": "Pool service completed", "subtitle": "Villa · scheduled", "at": _iso(now - timedelta(days=5))},
    ]

    sensors = [
        {"id": "s_1", "property_id": "prop_1", "kind": "temperature", "label": "PH-01 Living", "value": 23.4, "unit": "°C", "status": "nominal", "trend": "flat"},
        {"id": "s_2", "property_id": "prop_1", "kind": "humidity", "label": "PH-01 Living", "value": 58, "unit": "%", "status": "attention", "trend": "up"},
        {"id": "s_3", "property_id": "prop_1", "kind": "energy", "label": "Main Meter", "value": 42.6, "unit": "kWh", "status": "nominal", "trend": "down"},
        {"id": "s_4", "property_id": "prop_2", "kind": "leak", "label": "12B Kitchen", "value": 0, "unit": "", "status": "nominal", "trend": "flat"},
        {"id": "s_5", "property_id": "prop_3", "kind": "occupancy", "label": "Villa", "value": 3, "unit": "people", "status": "nominal", "trend": "flat"},
        {"id": "s_6", "property_id": "prop_4", "kind": "air_quality", "label": "Floor 8", "value": 71, "unit": "AQI", "status": "attention", "trend": "up"},
    ]

    notifications = [
        {"id": "n_1", "title": "HVAC action recommended", "body": "SPP suggests preventive service on Marina Crest.", "priority": "high", "at": _iso(now - timedelta(hours=2)), "read": False},
        {"id": "n_2", "title": "Contract expiring in 34 days", "body": "Marcus Reed · Marina Crest PH-02", "priority": "medium", "at": _iso(now - timedelta(hours=9)), "read": False},
        {"id": "n_3", "title": "Occupancy alert", "body": "Aurum Office Tower below target.", "priority": "critical", "at": _iso(now - timedelta(hours=5)), "read": False},
    ]

    reports = [
        {"id": "r_1", "kind": "monthly", "title": "October Portfolio Review", "subtitle": "AI-authored · 4 properties",
         "highlight": "Revenue up 6.2% MoM · 1 intervention prevented",
         "created_at": _iso(now - timedelta(days=2)), "pages": 12, "accent": "gold"},
        {"id": "r_2", "kind": "financial", "title": "Q3 Yield & Cashflow", "subtitle": "AI analysis",
         "highlight": "Yield 7.4% · above market by 0.9pt",
         "created_at": _iso(now - timedelta(days=10)), "pages": 8, "accent": "emerald"},
        {"id": "r_3", "kind": "compliance", "title": "Compliance & Safety Audit", "subtitle": "Green API + sensor sweep",
         "highlight": "100% checks passed · next review in 90 days",
         "created_at": _iso(now - timedelta(days=18)), "pages": 6, "accent": "emerald"},
        {"id": "r_4", "kind": "tenant", "title": "Tenant Reliability Ledger", "subtitle": "AI scoring",
         "highlight": "3 of 4 tenants scoring above 90",
         "created_at": _iso(now - timedelta(days=24)), "pages": 4, "accent": "gold"},
    ]

    knowledge = [
        {"id": "k_1", "topic": "Getting started",
         "title": "How SPP thinks about your portfolio",
         "body": "SPP watches sensor drift, service history, occupancy patterns and market data — then proposes one clear action.",
         "reading_minutes": 3},
        {"id": "k_2", "topic": "Predictive Maintenance",
         "title": "Why prevention beats emergency repairs",
         "body": "Ninety percent of costly failures leave a signal weeks in advance. SPP surfaces those signals.",
         "reading_minutes": 4},
        {"id": "k_3", "topic": "Contracts",
         "title": "The renewal window playbook",
         "body": "How to price, propose and lock a renewal without leaving revenue on the table.",
         "reading_minutes": 5},
        {"id": "k_4", "topic": "Virtual Sensors",
         "title": "What sensors matter most for residential",
         "body": "Temperature, humidity, occupancy and leak sensors deliver 80% of predictive value.",
         "reading_minutes": 4},
        {"id": "k_5", "topic": "Tenant Experience",
         "title": "Reducing churn through response time",
         "body": "Tenants who receive a same-day acknowledgement renew 41% more often.",
         "reading_minutes": 3},
    ]

    guides = [
        {"id": "g_1", "title": "Install your first virtual sensor", "duration": "6 min",
         "kind": "video", "level": "Essential", "chapters": 4,
         "poster": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80"},
        {"id": "g_2", "title": "Connect Home Assistant to SPP", "duration": "9 min",
         "kind": "video", "level": "Intermediate", "chapters": 5,
         "poster": "https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&q=80"},
        {"id": "g_3", "title": "Automate tenant renewals with the Brain", "duration": "5 min",
         "kind": "video", "level": "Essential", "chapters": 3,
         "poster": "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80"},
        {"id": "g_4", "title": "Wire Green API to SPP notifications", "duration": "8 min",
         "kind": "video", "level": "Advanced", "chapters": 6,
         "poster": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80"},
    ]

    return {
        "owners": owners, "properties": properties, "tenants": tenants,
        "contracts": contracts, "decisions": decisions, "timeline": timeline,
        "sensors": sensors, "notifications": notifications,
        "reports": reports, "knowledge": knowledge, "guides": guides,
    }


async def _reseed_if_empty():
    if beta_mode_enabled():
        logger.info("Beta mode — auto-seed disabled; use /api/beta/login.")
        return
    if not _mongo_available:
        return
    if not _demo_mode_enabled():
        logger.info("Demo seed skipped — SPP_DEMO_MODE is off (default: empty portfolio).")
        return
    try:
        if await _get_db().properties.count_documents({}) > 0:
            return
        data = _seed_dataset()
        for coll, rows in data.items():
            if rows:
                await _get_db()[coll].insert_many([dict(r) for r in rows])
    except Exception as exc:
        logger.warning("Mongo reseed skipped: %s", exc)


def _demo_mode_enabled() -> bool:
    return os.getenv("SPP_DEMO_MODE", "false").lower() in ("1", "true", "yes")


def _use_memory_store() -> bool:
    return beta_mode_enabled() and not _mongo_available


def _memory_find(collection: str, query: Optional[dict] = None) -> List[dict]:
    rows = _memory_db.get(collection, [])
    if not query:
        return list(rows)
    return [r for r in rows if all(r.get(k) == v for k, v in query.items())]


def _memory_find_one(collection: str, query: Optional[dict] = None) -> Optional[dict]:
    matches = _memory_find(collection, query)
    return matches[0] if matches else None


def _memory_insert_all(data: Dict[str, List[dict]]) -> None:
    global _memory_db
    _memory_db = {k: [dict(r) for r in v] for k, v in data.items()}


def _memory_clear() -> None:
    global _memory_db
    _memory_db = {}


async def _clear_all_collections():
    if _use_memory_store() or (beta_mode_enabled() and not _mongo_available):
        _memory_clear()
        return
    if not _mongo_available:
        return
    cols = [
        "owners", "properties", "tenants", "contracts", "decisions", "timeline",
        "sensors", "notifications", "reports", "knowledge", "guides",
    ]
    for c in cols:
        await _get_db()[c].delete_many({})


async def _load_demo_seed(persona: str = "owner"):
    data = beta_dataset(persona) if beta_mode_enabled() else _seed_dataset()
    if _mongo_available:
        await _clear_all_collections()
        for coll, rows in data.items():
            if rows:
                await _get_db()[coll].insert_many([dict(r) for r in rows])
    elif _use_memory_store() or beta_mode_enabled():
        _memory_insert_all(data)
    else:
        raise HTTPException(503, "Database unavailable for demo load")


def _strip_id(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _safe_mongo_find(
    collection: str,
    query: Optional[dict] = None,
    *,
    sort: Optional[tuple] = None,
) -> List[dict]:
    if _use_memory_store():
        rows = _memory_find(collection, query)
        if sort:
            key, direction = sort
            rows = sorted(rows, key=lambda r: r.get(key, ""), reverse=direction < 0)
        return rows
    if not _mongo_available:
        return []
    try:
        cursor = _get_db()[collection].find(query or {}, {"_id": 0})
        if sort:
            cursor = cursor.sort(sort[0], sort[1])
        return [_strip_id(doc) async for doc in cursor]
    except Exception as exc:
        logger.warning("Mongo read %s failed: %s", collection, exc)
        return []


async def _safe_mongo_find_one(collection: str, query: Optional[dict] = None) -> Optional[dict]:
    if _use_memory_store():
        return _memory_find_one(collection, query)
    if not _mongo_available:
        return None
    try:
        doc = await _get_db()[collection].find_one(query or {}, {"_id": 0})
        return _strip_id(doc) if doc else None
    except Exception as exc:
        logger.warning("Mongo find_one %s failed: %s", collection, exc)
        return None


# ---------------------------------------------------------------------------
# Gap 1 — AI reasoning state persistence
# ---------------------------------------------------------------------------
# After a successful Apply, the import pipeline has produced rich reasoning
# artifacts (property_knowledge, koil_reasoning, consistency_gate,
# executive_brief, lifecycle, tenant_cards). These MUST be persisted so the
# live-context endpoints (/api/briefing, /api/verdicts, /api/executive) can
# consume them — otherwise the next briefing rebuilds from raw properties
# with zero memory of why those properties look the way they do.
#
# Storage abstraction:
#   - When Mongo is available → persist to `ai_state` collection (one doc per
#     analysis_id) + `ai_state_latest` singleton doc pointing to the most
#     recent successful apply. Survives server restart.
#   - When Mongo is unavailable (beta / local / test) → fall back to the
#     in-memory `_memory_db` dict under the `ai_state` and `ai_state_latest`
#     keys. Lost on restart, but that matches the existing memory-store
#     contract for properties/tenants/contracts.
#
# Safety guarantees:
#   1. A failed or incomplete analysis NEVER overwrites the last valid AI
#      state. _persist_ai_state() is only called after build_local_apply_commit()
#      succeeds with both properties AND ai_state.
#   2. _load_ai_state() returns None when no state exists — callers must
#      fall back to the pre-Gap-1 behavior (raw ctx without reasoning).
#   3. Repeated Apply with the same analysis_id is idempotent: the same
#      analysis_id overwrites its own doc, but the `latest` pointer only
#      moves forward in `applied_at` time.
# ---------------------------------------------------------------------------
_AI_STATE_COLLECTION = "ai_state"
_AI_STATE_LATEST_COLLECTION = "ai_state_latest"


def _ai_state_memory_store() -> Dict[str, dict]:
    """Return (creating if needed) the in-memory dict holding AI state docs.

    Memory-store shape (different from list-based _memory_db):
        {
            "ai_state": { analysis_id: ai_state_doc, ... },
            "ai_state_latest": { "analysis_id": "...", "applied_at": "..." },
        }
    """
    store = _memory_db.setdefault(_AI_STATE_COLLECTION, {})
    if not isinstance(store, dict):
        # If something put a list here by mistake, reset to dict.
        store = {}
        _memory_db[_AI_STATE_COLLECTION] = store
    return store


def _ai_state_latest_memory_pointer() -> Dict[str, str]:
    ptr = _memory_db.setdefault(_AI_STATE_LATEST_COLLECTION, {})
    if not isinstance(ptr, dict):
        ptr = {}
        _memory_db[_AI_STATE_LATEST_COLLECTION] = ptr
    return ptr


async def _persist_ai_state(ai_state: Dict[str, Any]) -> None:
    """Persist a successful Apply's AI state. No-op if ai_state is empty.

    Called only after build_local_apply_commit() returns a valid commit with
    both `properties` and `ai_state` populated. Failed applies never reach
    this function — they raise HTTPException before the call site.

    Safety: refuse to persist an empty / incomplete AI state. This protects
    against the case where build_local_apply_commit() is called with an
    unknown analysis_id (session lookup returns {}) and produces an ai_state
    with empty property_knowledge + koil_reasoning. Persisting that would
    overwrite the last valid AI state with garbage.
    """
    if not ai_state or not ai_state.get("analysis_id"):
        return

    # Refuse to persist an AI state that has no real reasoning content.
    # This is the "failed apply does not overwrite last valid state" guard.
    pk = ai_state.get("property_knowledge") or {}
    reasoning = ai_state.get("koil_reasoning") or {}
    if not pk or not reasoning:
        logger.warning(
            "Refusing to persist incomplete AI state (analysis_id=%s) — "
            "property_knowledge or koil_reasoning is empty",
            ai_state.get("analysis_id"),
        )
        return

    analysis_id = ai_state["analysis_id"]
    applied_at = ai_state.get("applied_at") or _iso(datetime.now(timezone.utc))
    ai_state = dict(ai_state)
    ai_state["applied_at"] = applied_at

    if _use_memory_store():
        store = _ai_state_memory_store()
        store[analysis_id] = ai_state
        _ai_state_latest_memory_pointer()["analysis_id"] = analysis_id
        _ai_state_latest_memory_pointer()["applied_at"] = applied_at
        return

    if not _mongo_available:
        return

    try:
        await _get_db()[_AI_STATE_COLLECTION].update_one(
            {"analysis_id": analysis_id},
            {"$set": ai_state},
            upsert=True,
        )
        await _get_db()[_AI_STATE_LATEST_COLLECTION].update_one(
            {"_id": "latest"},
            {"$set": {"analysis_id": analysis_id, "applied_at": applied_at}},
            upsert=True,
        )
    except Exception as exc:
        # Persistence failure must NOT break the apply response — the
        # portfolio rows are already committed. Log and move on; the next
        # briefing will fall back to raw ctx (pre-Gap-1 behavior).
        logger.warning("AI state persist failed (analysis_id=%s): %s", analysis_id, exc)


async def _load_ai_state() -> Optional[Dict[str, Any]]:
    """Load the latest successfully-applied AI state, or None if absent.

    Used by _portfolio_live_context() to enrich ctx with reasoning artifacts.
    """
    if _use_memory_store():
        ptr = _ai_state_latest_memory_pointer()
        aid = ptr.get("analysis_id")
        if not aid:
            return None
        return _ai_state_memory_store().get(aid)

    if not _mongo_available:
        return None

    try:
        ptr = await _get_db()[_AI_STATE_LATEST_COLLECTION].find_one({"_id": "latest"})
        if not ptr or not ptr.get("analysis_id"):
            return None
        aid = ptr["analysis_id"]
        doc = await _get_db()[_AI_STATE_COLLECTION].find_one({"analysis_id": aid}, {"_id": 0})
        return _strip_id(doc) if doc else None
    except Exception as exc:
        logger.warning("AI state load failed: %s", exc)
        return None


async def _load_ai_state_by_analysis_id(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Load one applied analysis explicitly instead of following latest."""
    if _use_memory_store():
        return _ai_state_memory_store().get(analysis_id)
    if not _mongo_available:
        return None
    try:
        doc = await _get_db()[_AI_STATE_COLLECTION].find_one(
            {"analysis_id": analysis_id},
            {"_id": 0},
        )
        return _strip_id(doc) if doc else None
    except Exception as exc:
        logger.warning("AI state load failed (analysis_id=%s): %s", analysis_id, exc)
        raise RuntimeError("ai_state_store_unavailable") from exc


async def _persist_decision_approval(record: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    """Atomically insert one durable approval, returning its canonical record."""
    if not _mongo_available:
        raise RuntimeError("approval_store_unavailable")

    approval_id = record.get("_id")
    if not approval_id:
        raise RuntimeError("approval_id_missing")

    try:
        collection = _get_db()["decision_approvals"]
        result = await collection.update_one(
            {"_id": approval_id},
            {"$setOnInsert": record},
            upsert=True,
        )
        stored = await collection.find_one({"_id": approval_id})
        if not stored:
            raise RuntimeError("approval_not_persisted")
        return _strip_id(stored), result.upserted_id is None
    except Exception as exc:
        logger.warning(
            "Decision approval persist failed (approval_id=%s): %s",
            approval_id,
            exc,
        )
        raise RuntimeError("approval_store_unavailable") from exc


async def _clear_ai_state() -> None:
    """Clear all persisted AI state. Used by /api/demo/clear so a fresh
    demo load doesn't leak the previous import's reasoning."""
    if _use_memory_store():
        _memory_db.pop(_AI_STATE_COLLECTION, None)
        _memory_db.pop(_AI_STATE_LATEST_COLLECTION, None)
        return
    if not _mongo_available:
        return
    try:
        await _get_db()[_AI_STATE_COLLECTION].delete_many({})
        await _get_db()[_AI_STATE_LATEST_COLLECTION].delete_many({})
    except Exception as exc:
        logger.warning("AI state clear failed: %s", exc)


async def _persist_apply_notifications(notifications: List[dict], analysis_id: str) -> None:
    """Upsert Apply-derived notifications; drop stale n_ai_* from other analyses."""
    if not analysis_id:
        return

    aid_slug = slug(analysis_id)
    current_prefix = f"n_ai_{aid_slug}_"

    if _use_memory_store():
        store = _memory_db.get("notifications")
        if not isinstance(store, list):
            store = []
        legacy = [
            n for n in store
            if not str(n.get("id") or "").startswith("n_ai_")
            or str(n.get("id") or "").startswith(current_prefix)
        ]
        by_id = {str(n.get("id")): n for n in legacy if n.get("id")}
        for notif in notifications:
            nid = str(notif.get("id") or "")
            if nid:
                by_id[nid] = notif
        _memory_db["notifications"] = list(by_id.values())
        return

    if not _mongo_available:
        return

    try:
        coll = _get_db()["notifications"]
        await coll.delete_many(
            {
                "id": {"$regex": r"^n_ai_"},
                "analysis_id": {"$ne": analysis_id},
            }
        )
        for notif in notifications:
            nid = notif.get("id")
            if not nid:
                continue
            await coll.update_one({"id": nid}, {"$set": notif}, upsert=True)
    except Exception as exc:
        logger.warning("Apply notifications persist failed (analysis_id=%s): %s", analysis_id, exc)


async def _finalize_apply_ai_state(commit: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    """Persist ai_state + derived notifications after a successful Apply commit."""
    ai_state = dict(commit.get("ai_state") or {})
    ai_state_persisted = False
    if not ai_state:
        return ai_state, False

    pk_check = ai_state.get("property_knowledge") or {}
    reasoning_check = ai_state.get("koil_reasoning") or {}
    if not pk_check or not reasoning_check:
        logger.warning(
            "Skipping AI state persist for analysis_id=%s — incomplete "
            "(property_knowledge or koil_reasoning empty)",
            ai_state.get("analysis_id"),
        )
        return ai_state, False

    applied_at = _iso(datetime.now(timezone.utc))
    ai_state["applied_at"] = applied_at
    await _persist_ai_state(ai_state)
    ai_state_persisted = True
    derived = derive_notifications_from_ai_state(ai_state)
    await _persist_apply_notifications(derived, str(ai_state.get("analysis_id") or ""))
    return ai_state, ai_state_persisted


def _gas_memory_bundle() -> Optional[Dict[str, Any]]:
    gas = get_gas_client()
    if not gas.configured:
        return None
    try:
        return gas.get_memory_lite()
    except Exception as exc:
        logger.debug("GAS memory lite unavailable: %s", exc)
        return None


def _gas_canonical_context() -> Dict[str, Any]:
    """Single GAS load → canonical model → legacy API shapes + memory + intelligence."""
    gas = get_gas_client()
    dashboard = gas.get_dashboard_lite()
    decisions_bundle = gas.get_decisions_lite()
    memory_bundle = _gas_memory_bundle()

    portfolio = portfolio_from_bundles(
        dashboard=dashboard,
        decisions=decisions_bundle,
        memory=memory_bundle,
    )
    health = (dashboard or {}).get("propertyHealth") or {}
    base_health = int(health.get("score") or 75)
    payload = legacy_api_payload(portfolio, base_health=base_health, merge_intelligence=True)
    reports = map_reports_from_app_data(dashboard)

    return {
        "settings": (dashboard or {}).get("settings") or {},
        "properties": payload["properties"],
        "tenants": payload["tenants"],
        "contracts": payload["contracts"],
        "decisions": payload["decisions"],
        "reports": reports,
        "memory": payload["memory"],
        "portfolio": payload["portfolio"],
    }


def _gas_properties() -> List[dict]:
    return map_properties_from_app_data(get_gas_client().get_properties_lite())


def _gas_tenants() -> List[dict]:
    return map_tenants_from_app_data(get_gas_client().get_tenants_lite())


def _gas_contracts() -> List[dict]:
    gas = get_gas_client()
    for loader in (gas.get_contracts_lite, gas.get_properties_lite, gas.get_dashboard_lite):
        contracts = map_contracts_from_app_data(loader())
        if contracts:
            return contracts
    return []


def _gas_decisions() -> List[dict]:
    return map_decisions_from_app_data(get_gas_client().get_decisions_lite())


def _gas_reports() -> List[dict]:
    return map_reports_from_app_data(get_gas_client().get_reports_lite())


def _gas_notifications() -> List[dict]:
    return map_notifications_from_app_data(get_gas_client().get_alerts_lite())


async def _mongo_properties() -> List[dict]:
    return await _safe_mongo_find("properties")


async def _mongo_tenants() -> List[dict]:
    return await _safe_mongo_find("tenants")


async def _mongo_contracts() -> List[dict]:
    return await _safe_mongo_find("contracts")


async def _mongo_decisions() -> List[dict]:
    return await _safe_mongo_find("decisions", sort=("created_at", -1))


async def _mongo_reports() -> List[dict]:
    return await _safe_mongo_find("reports", sort=("created_at", -1))


async def _mongo_notifications() -> List[dict]:
    return await _safe_mongo_find("notifications", sort=("at", -1))


async def _list_properties_live() -> List[dict]:
    return await resolve_domain("PROPERTIES", _gas_properties, _mongo_properties)


async def _list_tenants_live() -> List[dict]:
    return await resolve_domain("TENANTS", _gas_tenants, _mongo_tenants)


async def _list_contracts_live() -> List[dict]:
    return await resolve_domain("CONTRACTS", _gas_contracts, _mongo_contracts)


async def _list_decisions_live() -> List[dict]:
    return await resolve_domain("DECISIONS", _gas_decisions, _mongo_decisions)


async def _list_reports_live() -> List[dict]:
    return await resolve_domain("REPORTS", _gas_reports, _mongo_reports)


async def _list_notifications_live() -> List[dict]:
    ai_state = await _load_ai_state()
    if ai_state:
        return derive_notifications_from_ai_state(ai_state)
    return await resolve_domain("ALERTS", _gas_notifications, _mongo_notifications)


async def _get_property_live(pid: str) -> Optional[dict]:
    props = await _list_properties_live()
    for prop in props:
        if prop.get("id") == pid:
            return prop
    return None


_portfolio_cache: Optional[Dict[str, Any]] = None
_portfolio_cache_at: float = 0.0
_PORTFOLIO_CACHE_TTL_SEC = 25.0


async def _mongo_portfolio_context() -> Dict[str, Any]:
    """Mongo / empty fallback when GAS is unavailable or canonical load fails.

    Mirrors the domain keys used by live-context endpoints so briefing /
    executive / list routes keep returning 200 with empty-or-mongo data
    instead of raising GasClientError (HTTP 500).
    """
    props, decisions, tenants, contracts, reports = await asyncio.gather(
        _mongo_properties(),
        _mongo_decisions(),
        _mongo_tenants(),
        _mongo_contracts(),
        _mongo_reports(),
    )
    return {
        "settings": {},
        "properties": props,
        "tenants": tenants,
        "contracts": contracts,
        "decisions": decisions,
        "reports": reports,
    }


async def _portfolio_live_context() -> Dict[str, Any]:
    """Load portfolio domains in parallel; short TTL cache avoids duplicate GAS round-trips."""
    global _portfolio_cache, _portfolio_cache_at
    now = time.time()
    if _portfolio_cache and (now - _portfolio_cache_at) < _PORTFOLIO_CACHE_TTL_SEC:
        return _portfolio_cache

    if beta_mode_enabled():
        props = _memory_find("properties")
        if props:
            ctx = {
                "settings": {},
                "properties": props,
                "tenants": _memory_find("tenants"),
                "contracts": _memory_find("contracts"),
                "decisions": _memory_find("decisions"),
                "reports": _memory_find("reports"),
            }
        else:
            data = beta_dataset("owner")
            ctx = {
                "settings": {},
                "properties": data.get("properties", []),
                "tenants": data.get("tenants", []),
                "contracts": data.get("contracts", []),
                "decisions": data.get("decisions", []),
                "reports": data.get("reports", []),
            }
    elif _gas_live_mode():
        props, decisions, tenants, contracts, reports = await asyncio.gather(
            _list_properties_live(),
            _list_decisions_live(),
            _list_tenants_live(),
            _list_contracts_live(),
            _list_reports_live(),
        )
        contracts = reconcile_contracts(contracts, decisions, tenants, props)

        settings: Dict[str, Any] = {}
        gas = get_gas_client()
        if gas.configured and not beta_mode_enabled():
            try:
                settings = await asyncio.to_thread(
                    lambda: (gas.get_dashboard_lite() or {}).get("settings") or {}
                )
            except Exception as exc:
                logger.warning("GAS portfolio settings skipped: %s", exc)

        ctx = {
            "settings": settings,
            "properties": props,
            "tenants": tenants,
            "contracts": contracts,
            "decisions": decisions,
            "reports": reports,
        }
    else:
        # `_gas_live_mode()` is False when GAS is unconfigured OR when the
        # data source is mongo-only. The old path always called
        # `_gas_canonical_context()`, which raises GasClientError when
        # GOOGLE_APPS_SCRIPT_URL is missing — turning every live-context
        # endpoint (briefing, properties, upload roundtrip, …) into HTTP 500.
        gas = get_gas_client()
        if gas.configured:
            try:
                ctx = await asyncio.to_thread(_gas_canonical_context)
            except (GasClientError, Exception) as exc:
                logger.warning(
                    "GAS canonical context failed; falling back to mongo: %s", exc
                )
                ctx = await _mongo_portfolio_context()
        else:
            ctx = await _mongo_portfolio_context()

    # Gap 1: enrich ctx with the latest successfully-applied AI reasoning
    # artifacts. _load_ai_state() returns None when no state has been
    # persisted (fresh server, no imports yet, or Mongo unavailable) — in
    # that case ctx stays unchanged and all downstream endpoints fall back
    # to their pre-Gap-1 behavior. This is the backward-compat guarantee.
    ai_state = await _load_ai_state()
    if ai_state:
        ctx["ai_state"] = ai_state
        # Convenience accessors — callers can read these directly from ctx
        # without digging into ai_state. All optional; absent when no state.
        ctx["reasoning"] = ai_state.get("koil_reasoning")
        ctx["consistency_gate"] = ai_state.get("consistency_gate")
        ctx["executive_brief"] = ai_state.get("executive_brief")
        # Lifecycle comes from property_knowledge.lifecycle (the canonical
        # source inside the import snapshot). Expose it directly so
        # build_briefing() can read it without nested lookups.
        pk = ai_state.get("property_knowledge") or {}
        ctx["lifecycle"] = pk.get("lifecycle") or ai_state.get("lifecycle")
        ctx["property_knowledge"] = pk
        # Gap 2: expose canonical portfolio + memory + intelligence so
        # /api/portfolio-memory and /api/intelligence can serve them
        # directly without rebuilding from demo/GAS data.
        ctx["canonical_portfolio_summary"] = ai_state.get("canonical_portfolio_summary")
        ctx["property_memory"] = ai_state.get("property_memory")
        ctx["executive_intelligence"] = ai_state.get("executive_intelligence")
        ctx["canonical_warnings"] = ai_state.get("canonical_warnings")
        # Gap 3 (complete): expose the ONE normalized lifecycle payload +
        # lifecycle decisions. This is the authoritative lifecycle source
        # for /api/briefing, /api/verdicts, /api/executive, smart decisions.
        # Falls back to property_knowledge.lifecycle when normalized_lifecycle
        # is absent (backward compat with Gap 1-only ai_state).
        ctx["normalized_lifecycle"] = ai_state.get("normalized_lifecycle") or {
            "version": "lifecycle-v1",
            "reporting_period": {},
            "departed": (pk.get("lifecycle") or {}).get("departed") or [],
            "newcomers": (pk.get("lifecycle") or {}).get("newcomers") or [],
            "active": (pk.get("lifecycle") or {}).get("active") or [],
            "tenant_changes": (pk.get("lifecycle") or {}).get("tenant_changes") or [],
            "late_tenants": (pk.get("late") or {}).get("tenants") or [],
            "payment_ledger": [],
            "late_by_month": [],
            "month_comparison": [],
            "annual_stats": {},
            "summary": {
                "departed_count": (pk.get("lifecycle") or {}).get("departed_count") or 0,
                "newcomers_count": (pk.get("lifecycle") or {}).get("newcomers_count") or 0,
                "active_count": (pk.get("lifecycle") or {}).get("active_count") or 0,
                "late_count": (pk.get("late") or {}).get("tenant_count") or 0,
            },
            "warnings": [], "unresolved": [],
            "source": "fallback_from_property_knowledge",
            "has_real_content": True, "month_count": 0,
        }
        ctx["lifecycle_decisions"] = ai_state.get("lifecycle_decisions") or []
        # Gap 4: expose the ONE unified smart decisions list. Authoritative
        # for /api/decisions, /api/executive, /api/briefing, /api/verdicts.
        # Falls back to empty list when no ai_state (backward compat).
        ctx["unified_smart_decisions"] = ai_state.get("unified_smart_decisions") or []
        # Gap 5: expose the authoritative normalized consistency gate.
        # This is the ONE gate shape consumed by all live-context endpoints.
        ctx["normalized_gate"] = ai_state.get("normalized_gate")

    _portfolio_cache = ctx
    _portfolio_cache_at = now
    return _portfolio_cache


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "SPP", "status": "online"}


@api_router.get("/briefing")
async def briefing():
    """The AI Employee's morning briefing — the heart of the home screen."""
    ctx = await _portfolio_live_context()
    brief = build_briefing(
        ctx["settings"],
        ctx["properties"],
        ctx["tenants"],
        ctx["contracts"],
        ctx["decisions"],
        ctx["reports"],
        # Gap 1: pass persisted reasoning artifacts so build_briefing() can
        # weave them into the narrative. All optional — None when no import
        # has been applied yet, in which case build_briefing() falls back
        # to its pre-Gap-1 behavior.
        reasoning=ctx.get("reasoning"),
        consistency_gate=ctx.get("consistency_gate"),
        lifecycle=ctx.get("lifecycle"),
        executive_brief=ctx.get("executive_brief"),
        # Gap 3 (complete): pass the ONE normalized lifecycle payload so
        # the briefing uses it as the authoritative source for late tenants,
        # payment history, and month-over-month collection change.
        normalized_lifecycle=ctx.get("normalized_lifecycle"),
        # Gap 4: pass the ONE unified smart decisions list so the briefing
        # action line references the same decision id as /api/decisions,
        # /api/executive, /api/verdicts.
        unified_smart_decisions=ctx.get("unified_smart_decisions"),
        # Gap A: pass canonical portfolio summary for authoritative count hierarchy
        canonical_portfolio_summary=ctx.get("canonical_portfolio_summary"),
    )
    # Gap 5: apply the authoritative normalized gate to the briefing.
    # When blocked, claims are rephrased as review requirements.
    # Only apply when a persisted gate exists (backward compat: no gate
    # when no import has been applied).
    _ng = ctx.get("normalized_gate")
    if _ng:
        from adapters.gate import apply_gate_to_briefing
        brief = apply_gate_to_briefing(brief, _ng)
    return brief


@api_router.get("/executive")
async def executive_brain():
    """Executive Brain V2 — daily agenda, ranked decisions, opportunities."""
    ctx = await _portfolio_live_context()
    brain = build_executive_brain(
        ctx["settings"],
        ctx["properties"],
        ctx["tenants"],
        ctx["contracts"],
        ctx["decisions"],
        ctx["reports"],
        # Gap 3: pass persisted lifecycle so tenant-change items appear in
        # the ranked queue + agenda + daily brief. None when no import
        # has been applied (backward compat).
        lifecycle=ctx.get("lifecycle"),
        # Gap 3 (complete): pass the ONE normalized lifecycle payload +
        # the 7 lifecycle decision kinds so they appear in ranked_decisions,
        # agenda, daily_brief, risks, and opportunities.
        normalized_lifecycle=ctx.get("normalized_lifecycle"),
        lifecycle_decisions=ctx.get("lifecycle_decisions"),
        # Gap 4: pass the ONE unified smart decisions list so ranked_decisions
        # + agenda are DERIVED from it (not independently rebuilt). Same
        # decision ids appear across /api/decisions, /api/executive,
        # /api/briefing, /api/verdicts.
        unified_smart_decisions=ctx.get("unified_smart_decisions"),
        # Gap A: pass canonical portfolio summary for authoritative unit/property counts
        canonical_portfolio_summary=ctx.get("canonical_portfolio_summary"),
    )
    # Gap 5: apply the authoritative normalized gate to the executive brain.
    # Blocked items move to a review_queue; daily_brief separates confirmed
    # / warnings / review; data_confidence block is added.
    # Only apply when a persisted gate exists (backward compat).
    _ng = ctx.get("normalized_gate")
    if _ng:
        from adapters.gate import apply_gate_to_executive_brain
        brain = apply_gate_to_executive_brain(brain, _ng)
    return brain


@api_router.get("/portfolio-memory")
async def portfolio_memory():
    """Portfolio Memory graph — canonical asset life profiles.

    Gap 2: when an import has been applied, the persisted ai_state contains
    a property_memory block (same shape as this endpoint's response) that
    was built from the REAL uploaded data. Serve it directly instead of
    rebuilding from demo/GAS bundles. Falls back to the legacy behavior
    when no ai_state is present (backward compat).
    """
    ctx = await _portfolio_live_context()
    # Gap 2: prefer persisted property_memory from ai_state when available.
    ai_state = ctx.get("ai_state") or {}
    persisted_memory = ai_state.get("property_memory")
    if persisted_memory and isinstance(persisted_memory, dict) and persisted_memory.get("assets") is not None:
        # Add a provenance marker so callers can verify they're seeing
        # the imported memory, not a rebuild.
        out = dict(persisted_memory)
        out["_source"] = "ai_state_persisted"
        out["_analysis_id"] = ai_state.get("analysis_id")
        return out

    # Legacy path: build from GAS bundles / canonical portfolio.
    memory = ctx.get("memory")
    if memory is None:
        portfolio = portfolio_from_bundles()
        from adapters.portfolio_memory.graph import build_memory_graph

        memory = build_memory_graph(portfolio)
    result = memory_graph_to_dict(memory)
    result["_source"] = "canonical_rebuild"
    return result


@api_router.get("/intelligence")
async def executive_intelligence():
    """Executive Intelligence — pattern-based insights from canonical memory.

    Gap 2: when an import has been applied, the persisted ai_state contains
    an executive_intelligence block (same shape as this endpoint's response)
    that was derived from the REAL uploaded canonical portfolio. Serve it
    directly instead of rebuilding from demo/GAS bundles. Falls back to the
    legacy behavior when no ai_state is present (backward compat).
    """
    ctx = await _portfolio_live_context()
    # Gap 2: prefer persisted executive_intelligence from ai_state when available.
    ai_state = ctx.get("ai_state") or {}
    persisted_intel = ai_state.get("executive_intelligence")
    if (
        persisted_intel
        and isinstance(persisted_intel, dict)
        and "insights" in persisted_intel
    ):
        out = dict(persisted_intel)
        out["_source"] = "ai_state_persisted"
        out["_analysis_id"] = ai_state.get("analysis_id")
        return out

    # Legacy path: build from canonical portfolio + memory graph.
    portfolio = ctx.get("portfolio")
    memory = ctx.get("memory")
    if portfolio is None:
        return {"insights": [], "count": 0, "_source": "no_portfolio"}
    insights = generate_insights(portfolio, memory)
    return {"insights": insights_to_api(insights), "count": len(insights), "_source": "canonical_rebuild"}


@api_router.get("/properties")
async def list_properties():
    ctx = await _portfolio_live_context()
    return ctx["properties"]


@api_router.get("/properties/{pid}")
async def get_property(pid: str):
    ctx = await _portfolio_live_context()
    for prop in ctx["properties"]:
        if prop.get("id") == pid:
            return prop
    doc = await _safe_mongo_find_one("properties", {"id": pid})
    if not doc:
        raise HTTPException(404, "property not found")
    return doc


@api_router.get("/decisions")
async def list_decisions():
    """Ranked AI decisions.

    Gap 4: when unified_smart_decisions is present (after Apply), return
    the unified list with a _source marker. Falls back to legacy
    ctx["decisions"] when no ai_state (backward compat).
    """
    ctx = await _portfolio_live_context()
    unified = ctx.get("unified_smart_decisions") or []
    if unified:
        # Return unified list with provenance marker. Legacy consumers
        # that expect a list of decision dicts still work — the unified
        # shape is a superset of the legacy shape.
        return {
            "decisions": unified,
            "count": len(unified),
            "_source": "unified",
            "_analysis_id": (ctx.get("ai_state") or {}).get("analysis_id"),
        }
    # Legacy fallback: return the raw decisions list (pre-Gap-4 shape).
    return ctx["decisions"]


class DecisionApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysis_id: str
    decision_id: str


@api_router.post("/decisions/approve")
async def approve_decision(req: DecisionApproveRequest):
    """Approve and prepare one late-tenant reminder without sending it."""
    if not _mongo_available:
        raise HTTPException(
            503,
            {"code": "approval_store_unavailable", "message": "MongoDB is required"},
        )

    try:
        ai_state = await _load_ai_state_by_analysis_id(req.analysis_id)
    except RuntimeError as exc:
        raise HTTPException(
            503,
            {"code": "approval_store_unavailable", "message": str(exc)},
        ) from exc
    if not ai_state:
        raise HTTPException(
            404,
            {"code": "analysis_not_found", "analysis_id": req.analysis_id},
        )

    decision = find_decision(ai_state, req.decision_id)
    if not decision:
        raise HTTPException(
            404,
            {
                "code": "decision_not_found",
                "analysis_id": req.analysis_id,
                "decision_id": req.decision_id,
            },
        )

    try:
        approval = build_approval_record(ai_state, decision)
    except ApprovalValidationError as exc:
        status_code = 422 if exc.code == "decision_data_incomplete" else 409
        raise HTTPException(
            status_code,
            {"code": exc.code, "message": str(exc)},
        ) from exc

    try:
        stored, idempotent_replay = await _persist_decision_approval(approval)
    except RuntimeError as exc:
        raise HTTPException(
            503,
            {"code": "approval_store_unavailable", "message": str(exc)},
        ) from exc

    return {
        "ok": True,
        "status": "approved_and_prepared",
        "idempotent_replay": idempotent_replay,
        "approval": stored,
    }


@api_router.get("/tenants")
async def list_tenants():
    ctx = await _portfolio_live_context()
    return ctx["tenants"]


@api_router.get("/contracts")
async def list_contracts():
    ctx = await _portfolio_live_context()
    return ctx["contracts"]


@api_router.get("/timeline")
async def list_timeline():
    return await _safe_mongo_find("timeline", sort=("at", -1))


@api_router.get("/sensors")
async def list_sensors():
    return await _safe_mongo_find("sensors")


@api_router.get("/notifications")
async def list_notifications():
    return await _list_notifications_live()


@api_router.get("/reports")
async def list_reports():
    ctx = await _portfolio_live_context()
    return ctx["reports"]


@api_router.get("/knowledge")
async def list_knowledge():
    return await _safe_mongo_find("knowledge")


@api_router.get("/guides")
async def list_guides():
    return await _safe_mongo_find("guides")


@api_router.get("/owner")
async def get_owner():
    doc = await _safe_mongo_find_one("owners")
    return doc or {"id": "own_1", "name": "", "portfolio_value": 0, "properties": 0}


class BetaLoginRequest(BaseModel):
    email: str
    password: str


@api_router.get("/beta/info")
async def beta_info():
    """Public beta metadata — no secrets."""
    return {
        "beta": beta_mode_enabled(),
        "personas": [
            {"id": "owner", "email": "demo.owner@spp.beta", "label": "Owner"},
            {"id": "tenant", "email": "demo.tenant@spp.beta", "label": "Tenant"},
            {"id": "technician", "email": "demo.tech@spp.beta", "label": "Technician"},
        ],
        "data_source": "fictional_beta_seed",
        "gas_disabled": beta_mode_enabled(),
    }


@api_router.get("/build-info")
async def build_info():
    """Additive deploy fingerprint — Render injects RENDER_GIT_* env vars. Safe for UI clients to ignore."""
    return {
        "app": "SPP",
        "git_commit": (os.getenv("RENDER_GIT_COMMIT") or os.getenv("SPP_GIT_COMMIT") or "")[:40] or None,
        "git_branch": os.getenv("RENDER_GIT_BRANCH") or os.getenv("SPP_GIT_BRANCH") or None,
        "service": os.getenv("RENDER_SERVICE_NAME") or None,
        "beta": beta_mode_enabled(),
    }


@api_router.post("/beta/login")
async def beta_login(req: BetaLoginRequest):
    """Beta tester login — loads fictional portfolio, never Google Sheets."""
    if not beta_mode_enabled():
        raise HTTPException(404, "Beta mode is not enabled on this server")
    persona = verify_beta_login(req.email, req.password)
    if not persona:
        raise HTTPException(401, "Invalid beta credentials")
    await _load_demo_seed(persona)
    global _portfolio_cache, _portfolio_cache_at
    _portfolio_cache = None
    _portfolio_cache_at = 0.0
    return {"ok": True, "persona": persona, "email": req.email.strip().lower()}


@api_router.post("/demo/load")
async def load_demo():
    """Load sample portfolio — opt-in only, never default."""
    await _load_demo_seed("owner")
    global _portfolio_cache, _portfolio_cache_at
    _portfolio_cache = None
    _portfolio_cache_at = 0.0
    return {"ok": True, "mode": "demo", "beta": beta_mode_enabled()}


@api_router.post("/demo/clear")
async def clear_demo():
    """Remove all seeded data — return to empty portfolio."""
    await _clear_all_collections()
    # Gap 1: also clear persisted AI state so a fresh demo load doesn't
    # leak the previous import's reasoning into the new portfolio.
    await _clear_ai_state()
    global _portfolio_cache, _portfolio_cache_at
    _portfolio_cache = None
    _portfolio_cache_at = 0.0
    return {"ok": True, "mode": "empty"}


@api_router.get("/verdicts")
async def verdicts():
    """Contextual AI verdicts — one Brain speaking on every surface."""
    ctx = await _portfolio_live_context()
    notifications = await _list_notifications_live()
    verdicts_result = build_verdicts(
        ctx["properties"],
        ctx["tenants"],
        ctx["contracts"],
        ctx["decisions"],
        ctx["reports"],
        notifications,
        # Gap 3: pass persisted lifecycle so tenant-change signals surface
        # in the home + tenants verdicts. None when no import applied.
        lifecycle=ctx.get("lifecycle"),
        # Gap 3 (complete): pass the ONE normalized lifecycle payload so
        # verdicts include evidence fields (tenant/unit/period/source/confidence)
        # when lifecycle data exists.
        normalized_lifecycle=ctx.get("normalized_lifecycle"),
        # Gap 4: pass the ONE unified smart decisions list so verdicts
        # reference the same decision ids as /api/decisions, /api/executive,
        # /api/briefing.
        unified_smart_decisions=ctx.get("unified_smart_decisions"),
    )
    # Gap 5: apply the authoritative normalized gate to the verdicts.
    # Affected verdicts get gate_status, confidence cap, conflict_codes,
    # requires_review, and evidence fields.
    # Only apply when a persisted gate exists (backward compat).
    _ng = ctx.get("normalized_gate")
    if _ng:
        from adapters.gate import apply_gate_to_verdicts
        verdicts_result = apply_gate_to_verdicts(verdicts_result, _ng)
    return verdicts_result


@api_router.post("/chat")
async def chat(req: ChatRequest):
    """Non-streaming chat endpoint — Unified Brain."""
    now = _iso(datetime.now(timezone.utc))
    user_msg = {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "user", "text": req.text, "at": now}
    try:
        from emergentintegrations.llm.chat import UserMessage  # type: ignore
        if not EMERGENT_LLM_KEY:
            raise HTTPException(500, "AI key not configured")
        chat_obj = get_llm_chat(session_id=req.session_id)
        reply = await chat_obj.send_message(UserMessage(text=req.text))
    except HTTPException:
        raise
    except ModuleNotFoundError:
        reply = "I couldn't reach the Brain just now. Try again in a moment."
    except Exception as e:
        msg = str(e).lower()
        if "budget" in msg or "quota" in msg:
            reply = (
                "The AI Employee is momentarily paused — your Emergent Universal Key "
                "balance has run out. Top up in Profile → Universal Key → Add Balance "
                "and I'll be right back."
            )
        else:
            reply = "I couldn't reach the Brain just now. Try again in a moment."
    msg = {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "assistant", "text": reply, "at": now}
    if _use_memory_store():
        bucket = _memory_db.setdefault("chat_messages", [])
        bucket.extend([dict(user_msg), dict(msg)])
    elif _mongo_available:
        try:
            await _get_db().chat_messages.insert_many([dict(user_msg), dict(msg)])
        except Exception as exc:
            logger.warning("Chat history not saved (Mongo unavailable): %s", exc)
    return {"reply": reply, "at": now}


@api_router.get("/chat/{session_id}")
async def chat_history(session_id: str):
    return await _safe_mongo_find(
        "chat_messages", {"session_id": session_id}, sort=("at", 1)
    )


# ---------------------------------------------------------------------------
# AI Property Employee — Phase 1 (additive, no changes to existing endpoints)
#
# New endpoints under /api/ai/employee/*:
#   POST /api/ai/employee/chat         — context-aware chat (snapshot + focused memory)
#   GET  /api/ai/employee/suggestions  — proactive recommendations (rule-based)
#   GET  /api/ai/employee/context      — debug: the assembled snapshot + last intent
#
# All existing endpoints (/api/chat, /api/briefing, /api/executive, /api/verdicts,
# /api/intelligence, /api/notifications, etc.) are UNCHANGED. The legacy
# /api/chat continues to work exactly as before. The new /api/ai/employee/chat
# is a parallel endpoint that injects portfolio context into the prompt.
# ---------------------------------------------------------------------------
class AIEmployeeChatRequest(BaseModel):
    session_id: str
    text: str
    lang: str = "ar"  # ar | en — defaults to Arabic (matches Koïl engine default)


@api_router.post("/ai/employee/chat")
async def ai_employee_chat(req: AIEmployeeChatRequest):
    """Context-aware chat: inject portfolio snapshot + focused memory into the prompt.

    Falls back to a deterministic local reply when the LLM key is missing or the
    emergentintegrations package is not installed — so the endpoint always returns
    a structured reply instead of 500ing in beta / local mode.
    """
    now = _iso(datetime.now(timezone.utc))
    user_msg = {
        "id": str(uuid.uuid4()),
        "session_id": req.session_id,
        "role": "user",
        "text": req.text,
        "at": now,
    }

    # 1. Build employee context from the live portfolio.
    ctx = await _portfolio_live_context()
    emp_ctx = build_employee_context(ctx)

    # 2. Classify intent + retrieve focused memory for this turn.
    intent = classify_intent(req.text, emp_ctx.properties, emp_ctx.tenants, emp_ctx.contracts)
    retrieval = retrieve_relevant_memory(emp_ctx, intent)

    # 3. Build the system prompt (voice + snapshot + focused context).
    lang = "ar" if (req.lang or "ar").startswith("ar") else "en"
    system_prompt = build_system_prompt(emp_ctx, retrieval, lang=lang)  # type: ignore[arg-type]

    # 4. Call the LLM (graceful fallback if no key / no emergentintegrations).
    reply_text: str
    used_llm = False
    try:
        from emergentintegrations.llm.chat import UserMessage  # type: ignore
        if not EMERGENT_LLM_KEY:
            raise RuntimeError("AI key not configured")
        chat_obj = get_llm_chat(session_id=req.session_id, system_message=system_prompt)
        reply_text = await chat_obj.send_message(UserMessage(text=req.text))
        used_llm = True
    except ModuleNotFoundError:
        reply_text = _local_employee_reply(req.text, emp_ctx, retrieval, lang)
    except RuntimeError:
        reply_text = _local_employee_reply(req.text, emp_ctx, retrieval, lang)
    except Exception as e:
        msg_lower = str(e).lower()
        if "budget" in msg_lower or "quota" in msg_lower:
            reply_text = (
                "The AI Employee is momentarily paused — the Emergent Universal Key "
                "balance has run out. Top up in Profile → Universal Key → Add Balance "
                "and I will be right back."
            ) if lang == "en" else (
                "AI Employee متوقف مؤقتاً — رصيد Emergent Universal Key نفد. "
                "أعد الشحن من الملف الشخصي → Universal Key → Add Balance وسأعود فوراً."
            )
        else:
            reply_text = _local_employee_reply(req.text, emp_ctx, retrieval, lang)

    assistant_msg = {
        "id": str(uuid.uuid4()),
        "session_id": req.session_id,
        "role": "assistant",
        "text": reply_text,
        "at": _iso(datetime.now(timezone.utc)),
    }

    # 5. Persist both messages (same store as /api/chat — unified history).
    if _use_memory_store():
        bucket = _memory_db.setdefault("chat_messages", [])
        bucket.extend([dict(user_msg), dict(assistant_msg)])
    elif _mongo_available:
        try:
            await _get_db().chat_messages.insert_many([dict(user_msg), dict(assistant_msg)])
        except Exception as exc:
            logger.warning("AI Employee chat history not saved (Mongo unavailable): %s", exc)

    return {
        "reply": reply_text,
        "at": assistant_msg["at"],
        "session_id": req.session_id,
        "intent": intent.to_dict(),
        "used_llm": used_llm,
        "context_summary": {
            "properties_in_focus": len(retrieval.properties),
            "tenants_in_focus": len(retrieval.tenants),
            "contracts_in_focus": len(retrieval.contracts),
            "decisions_in_focus": len(retrieval.decisions),
            "notes_count": len(retrieval.notes),
        },
    }


@api_router.get("/ai/employee/suggestions")
async def ai_employee_suggestions():
    """Proactive recommendations — rule-based, deterministic, no LLM cost.

    Returns a sorted list of Suggestion objects across 4 categories:
    critical | important | follow_up | information
    Each suggestion includes reason, action, impact, confidence, and
    related property/tenant/contract ids.
    """
    ctx = await _portfolio_live_context()
    emp_ctx = build_employee_context(ctx)
    suggestions = generate_proactive_suggestions(emp_ctx)
    return {
        "version": "ai-employee-v1",
        "count": len(suggestions),
        "suggestions": [s.to_dict() for s in suggestions],
        "categories": {
            "critical": sum(1 for s in suggestions if s.category == "critical"),
            "important": sum(1 for s in suggestions if s.category == "important"),
            "follow_up": sum(1 for s in suggestions if s.category == "follow_up"),
            "information": sum(1 for s in suggestions if s.category == "information"),
        },
    }


@api_router.get("/ai/employee/context")
async def ai_employee_context():
    """Debug endpoint: returns the assembled EmployeeContext snapshot.

    Useful for verifying the assistant is grounded in real data.
    No PII — only property/tenant/contract ids and aggregate metrics.
    """
    ctx = await _portfolio_live_context()
    emp_ctx = build_employee_context(ctx)
    snap = emp_ctx.snapshot
    return {
        "version": "ai-employee-v1",
        "owner_name": snap.owner_name,
        "currency": snap.currency,
        "portfolio_annual_revenue": snap.portfolio_annual_revenue,
        "avg_health": snap.avg_health,
        "occupancy_pct": snap.occupancy_pct,
        "expiring_contracts": snap.expiring_contracts,
        "open_decisions": snap.open_decisions,
        "properties_count": len(snap.properties),
        "tenants_count": len(snap.tenants),
        "contracts_count": len(snap.contracts),
        "decisions_count": len(snap.decisions),
        "property_ids": [p.id for p in snap.properties],
        "tenant_ids": [t.id for t in snap.tenants],
        "contract_ids": [c.id for c in snap.contracts],
    }


def _local_employee_reply(
    text: str,
    emp_ctx: Any,
    retrieval: Any,
    lang: str,
) -> str:
    """Deterministic fallback reply when LLM is unavailable.

    Builds a short, grounded reply from the focused memory — never generic.
    Used in beta / local mode without EMERGENT_LLM_KEY.
    """
    ar = lang == "ar"
    if not retrieval.notes and not retrieval.properties and not retrieval.tenants and not retrieval.contracts:
        # Nothing matched — surface the top decision or top property.
        if emp_ctx.snapshot.decisions:
            top = emp_ctx.snapshot.decisions[0]
            if ar:
                return (
                    f"لا توجد بيانات مطابقة لسؤالك. أولوية اليوم: {top.title} "
                    f"({top.priority}). الإجراء المقترح: {top.action}."
                )
            return (
                f"No direct match for your question. Today's top priority: {top.title} "
                f"({top.priority}). Suggested action: {top.action}."
            )
        if ar:
            return (
                f"محفظتك تحتوي على {len(emp_ctx.snapshot.properties)} عقار و"
                f"{len(emp_ctx.snapshot.tenants)} مستأجر. "
                f"الصحة {emp_ctx.snapshot.avg_health}/100، الإشغال {emp_ctx.snapshot.occupancy_pct}%. "
                "اسألني عن عقار أو مستأجر أو عقد محدد لأعطيك إجابة دقيقة."
            )
        return (
            f"Your portfolio has {len(emp_ctx.snapshot.properties)} properties and "
            f"{len(emp_ctx.snapshot.tenants)} tenants. "
            f"Health {emp_ctx.snapshot.avg_health}/100, occupancy {emp_ctx.snapshot.occupancy_pct}%. "
            "Ask me about a specific property, tenant, or contract for a grounded answer."
        )

    # Build a short grounded reply from the focused notes.
    notes = retrieval.notes[:3]
    if ar:
        prefix = "بناءً على بيانات محفظتك:"
        bullets = " · ".join(notes)
        action_line = (
            "الإجراء التالي: راجع التفاصيل واتخذ قراراً اليوم."
            if not emp_ctx.snapshot.decisions
            else f"الإجراء التالي: {emp_ctx.snapshot.decisions[0].action}"
        )
        return f"{prefix} {bullets}. {action_line}"
    prefix = "Based on your portfolio:"
    bullets = " · ".join(notes)
    action_line = (
        "Next action: review the details and decide today."
        if not emp_ctx.snapshot.decisions
        else f"Next action: {emp_ctx.snapshot.decisions[0].action}"
    )
    return f"{prefix} {bullets}. {action_line}"


# ---------------------------------------------------------------------------
# Upload → portfolio analysis (additive — files + live domain)
# ---------------------------------------------------------------------------
class UploadFileMeta(BaseModel):
    name: str
    mimeType: Optional[str] = None
    size: Optional[int] = None
    textSnippet: Optional[str] = None


class UploadPortfolioRequest(BaseModel):
    files: List[UploadFileMeta]
    lang: str = "ar"


class UploadApplyRequest(BaseModel):
    analysis_id: str
    files: Optional[List[UploadFileMeta]] = None


class UploadPdfRequest(BaseModel):
    analysis_id: Optional[str] = None


_last_applied_analysis: Optional[str] = None


@api_router.post("/upload/portfolio-analysis")
async def upload_portfolio_analysis(req: UploadPortfolioRequest):
    """Analyze uploaded files — GAS Smart Property engines when configured."""
    if not req.files:
        raise HTTPException(400, "No files provided")
    lang = "ar" if req.lang.startswith("ar") else "en"
    ctx = await _portfolio_live_context()
    payload = await asyncio.to_thread(
        analyze_upload_with_gas_fallback,
        [f.model_dump() for f in req.files],
        ctx,
        lang,  # type: ignore[arg-type]
    )
    return payload


@api_router.post("/upload/apply-analysis")
async def upload_apply_analysis(req: UploadApplyRequest):
    """Commit import to portfolio — GAS commitSmartPropertyImportBatch when configured."""
    global _last_applied_analysis, _portfolio_cache, _portfolio_cache_at
    files_dump = [f.model_dump() for f in req.files] if req.files else None

    if gas_import_available():
        try:
            result = await asyncio.to_thread(
                apply_gas_import,
                req.analysis_id,
                files_dump,
            )
            commit = build_local_apply_commit(req.analysis_id)
            ai_state, ai_state_persisted = await _finalize_apply_ai_state(commit)
            _portfolio_cache = None
            _portfolio_cache_at = 0.0
            _last_applied_analysis = req.analysis_id
            applied_at = _iso(datetime.now(timezone.utc))
            return {
                "ok": True,
                "analysis_id": req.analysis_id,
                "applied_at": applied_at,
                "gas": True,
                "commit": result.get("result"),
                "ai_state_persisted": ai_state_persisted,
                "ai_state_analysis_id": (ai_state or {}).get("analysis_id") if ai_state_persisted else None,
                "ai_state_pipeline_version": (ai_state or {}).get("pipeline_version") if ai_state_persisted else None,
            }
        except Exception as exc:
            # Match analyze_upload_with_gas_fallback: if GAS cannot commit, materialise
            # the Python Property Knowledge session so beta / local Apply still updates portfolio.
            logger.warning("GAS apply failed, falling back to local apply: %s", exc)

    # No GAS (or GAS commit failed): materialise Property Knowledge session into beta memory.
    commit = build_local_apply_commit(req.analysis_id)
    if not commit.get("tenants") and not commit.get("properties"):
        raise HTTPException(
            404,
            {
                "ok": False,
                "error": "analysis session expired — أعد التحليل ثم اعتمد",
                "analysis_id": req.analysis_id,
            },
        )
    _memory_db["properties"] = list(commit.get("properties") or [])
    _memory_db["tenants"] = list(commit.get("tenants") or [])
    _memory_db["contracts"] = list(commit.get("contracts") or [])
    _memory_db["reports"] = list(commit.get("reports") or [])
    _memory_db.setdefault("decisions", [])

    ai_state, ai_state_persisted = await _finalize_apply_ai_state(commit)

    _portfolio_cache = None
    _portfolio_cache_at = 0.0
    _last_applied_analysis = req.analysis_id
    applied_at = _iso(datetime.now(timezone.utc))
    return {
        "ok": True,
        "analysis_id": req.analysis_id,
        "applied_at": applied_at,
        "gas": False,
        "commit": {
            "units": commit.get("units"),
            "tenants": commit.get("tenant_count"),
            "properties": len(commit.get("properties") or []),
            "contracts": len(commit.get("contracts") or []),
            "reports": len(commit.get("reports") or []),
            "source": commit.get("source"),
            "summary": commit.get("summary") or {},
        },
        "ai_state_persisted": ai_state_persisted,
        "ai_state_analysis_id": (ai_state or {}).get("analysis_id") if ai_state_persisted else None,
        "ai_state_pipeline_version": (ai_state or {}).get("pipeline_version") if ai_state_persisted else None,
    }


@api_router.post("/upload/create-pdf")
async def upload_create_pdf(req: UploadPdfRequest):
    """Create owner PDF via GAS createOwnerReportPdf_."""
    if not gas_import_available():
        raise HTTPException(503, "PDF requires GAS Smart Property backend")
    try:
        result = await asyncio.to_thread(create_gas_owner_pdf, req.analysis_id)
        return result
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc


@api_router.get("/upload/last-applied")
async def upload_last_applied():
    return {"analysis_id": _last_applied_analysis}


# ---------------------------------------------------------------------------
# Gap 6 — LLM interpretation layer (POST /api/ai/respond)
#
# Controlled LLM endpoint that explains verified SPP intelligence results.
# The LLM NEVER calculates, invents, or executes — it only explains.
# When AI_ENABLED=false, returns a deterministic fallback (no external call).
# ---------------------------------------------------------------------------
class AIRespondRequest(BaseModel):
    analysis_id: str
    task: str = "answer"  # answer | executive_summary | decision_explanation
    question: Optional[str] = None


# Singleton LLM service — provider is resolved from env on first use.
_llm_service: Optional[LLMService] = None


def _get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


@api_router.post("/ai/respond")
async def ai_respond(req: AIRespondRequest):
    """Controlled LLM interpretation of persisted SPP intelligence.

    Loads AI state by analysis_id, builds a controlled context (no raw
    files), enforces the consistency gate, calls the LLM provider only
    when AI_ENABLED=true, validates the response, and returns a typed
    LLMResponse.

    When AI_ENABLED=false: returns status=disabled with a deterministic
    fallback generated from existing SPP data.
    """
    # 1. Load persisted AI state by analysis_id.
    ai_state = await _load_ai_state()
    if not ai_state or ai_state.get("analysis_id") != req.analysis_id:
        # Also check if this is the latest applied analysis.
        if req.analysis_id != _last_applied_analysis:
            raise HTTPException(404, f"AI state not found for analysis_id={req.analysis_id}")
        if not ai_state:
            raise HTTPException(404, "No AI state persisted")

    # 2. Build the LLM request.
    llm_req = LLMRequest(
        analysis_id=req.analysis_id,
        task=req.task if req.task in ("answer", "executive_summary", "decision_explanation") else "answer",
        question=req.question,
    )

    # 3. Call the LLM service (handles gate enforcement + provider call + validation).
    service = _get_llm_service()
    response = await service.respond(llm_req, ai_state)

    return response.model_dump()


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _startup():
    global _mongo_available
    _mongo_available = await _mongo_ping()
    if beta_mode_enabled():
        logger.info("SPP BETA MODE — Google Sheets disabled; fictional seed only.")
        if not _mongo_available:
            logger.info("Mongo unavailable — using in-memory beta store.")
    if _mongo_available:
        await _reseed_if_empty()
        logger.info("Mongo connected — seed check complete.")
    elif _gas_live_mode():
        logger.warning("Mongo unavailable — starting with GAS/hybrid live data.")
    else:
        logger.warning("Mongo unavailable and GAS not configured — some endpoints may return empty data.")
    logger.info("SPP backend ready.")


@app.on_event("shutdown")
async def shutdown_db_client():
    if _mongo_client:
        _mongo_client.close()
