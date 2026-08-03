# SPP Application Path — Intake → Integrations

> Single operating reference for the end-to-end path (phases A→D).
> Do not redesign UI identity. Do not change Smart Import column/sheet mapping unless explicitly tasked.

## Overview

| Phase | Name | Status |
|-------|------|--------|
| A | Data intake (manual / upload / WhatsApp pick / Sheets UI) | Live |
| B | Analyze → Apply → Koil / Smart Employee / Kowil brain | Live after Apply |
| C | Actions (wa.me / Green API, portals, decision approve) | Live (Green when env set; else wa.me) |
| D | Integrations (Sheets / Green API / Home Assistant / sensors) | Live via `/api/integrations/*` + env keys |

## Flow

```mermaid
flowchart TB
  subgraph intake [1_DataIntake]
    Manual["Manual_PropertyOS"]
    Upload["Upload_Excel_PDF"]
    SheetsUI["Sheets_Setup_UI"]
    WhatsAppPick["WhatsApp_file_pick"]
  end

  subgraph analyze [2_Analyze_Apply]
    PortfolioAPI["POST_/upload/portfolio-analysis"]
    ApplyAPI["POST_/upload/apply-analysis"]
    AiState["ai_state_Mongo_or_memory"]
    LocalOS["PropertyOS_AsyncStorage"]
  end

  subgraph intelligence [3_Koil_Employee]
    Knowledge["property_knowledge"]
    Reasoning["koil_reasoning"]
    Unified["unified_smart_decisions"]
    Act["POST_/koil/act"]
    Desk["SmartEmployeeDesk"]
    Brain["Kowil_local_brain"]
  end

  subgraph actions [4_Actions_Today]
    WaDeep["wa.me_or_Green_API"]
    Portal["Tenant_Tech_portal_links"]
    Approvals["decisions/approve"]
  end

  subgraph phase4 [5_Integrations]
    Green["Green_API_WhatsApp"]
    HA["Home_Assistant_sensors"]
    SheetsLive["Sheets_GAS_hybrid"]
    SensorsUI["sensors_screen"]
  end

  Manual --> LocalOS
  Upload --> PortfolioAPI
  WhatsAppPick --> PortfolioAPI
  SheetsUI --> SheetsLive
  PortfolioAPI --> ApplyAPI
  ApplyAPI --> AiState
  ApplyAPI --> LocalOS
  AiState --> Knowledge --> Reasoning --> Unified
  Unified --> Act
  LocalOS --> Desk
  LocalOS --> Brain
  Act --> WaDeep
  Desk --> WaDeep
  Desk --> Portal
  Brain --> Portal
  Unified --> Approvals
  Green --> WaDeep
  HA --> SensorsUI
  SheetsLive --> PortfolioAPI
```

## Key files

### A — Intake
- Manual: `frontend/app/setup/property-os.tsx`
- Upload: `frontend/app/upload.tsx` → `frontend/src/api/portfolio-analysis.ts`
- Apply to device: `frontend/src/utils/apply-analysis-to-os.ts`
- Backend: `backend/server.py` (`/upload/portfolio-analysis`, `/upload/apply-analysis`)

### B — Intelligence
- Koil engines: `backend/adapters/koil/`
- Act: `POST /api/koil/act`
- Smart employee: `frontend/src/utils/smart-employee-agent.ts`
- Kowil chat: `frontend/src/utils/kowil-local-brain.ts`

### C — Actions
- Portals: `frontend/src/utils/portal-links.ts`
- Approve: `POST /api/decisions/approve`
- WhatsApp send: Green API when configured, else `wa.me` deep link

### D — Integrations API
- Status: `GET /api/integrations/status`
- Sheets probe: `GET /api/integrations/sheets/status`
- WhatsApp send: `POST /api/integrations/whatsapp/send`
- Home Assistant: `GET /api/integrations/home-assistant/status`, sensors via `/api/sensors` when HA configured

## Processing order (stability first)

1. Data spine: import → analyze → Apply → phone/contract/ledger visible in Property OS + Kowil
2. Koil / employee gaps from real data + `/koil/act`
3. Sheets/GAS live status (no sheet/column renames)
4. Green API send with `wa.me` fallback
5. Home Assistant → `/api/sensors`

## Env keys (integrations)

```
GOOGLE_APPS_SCRIPT_URL=
SPP_API_KEY=
GREEN_API_INSTANCE_ID=
GREEN_API_TOKEN=
GREEN_API_API_URL=https://api.green-api.com
HOME_ASSISTANT_URL=
HOME_ASSISTANT_TOKEN=
```

## Constraints

- No UI identity redesign
- No Smart Import mapping changes unless explicitly requested
- Preserve API response shapes consumed by the frozen frontend
- Every integration: config from `.env`, graceful degrade when keys missing
