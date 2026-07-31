#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  SPP (Smart Property Platform) — After successfully pushing 5 local commits to GitHub via Emergent GitHub Sync (OAuth)
  on branch `conflict_030726_0550` of repo Abumahaa2025/SPP_Flutter, user wants a FULL REGRESSION on the exact code
  now living on GitHub HEAD (30aaf64). Must verify:
    1. Local HEAD == Remote HEAD (DONE — both = 30aaf64, 0/0 diff).
    2. Full backend + frontend regression on the synced code.
    3. Beta 18 core flow: Upload → Analysis → Executive Report → Apply works end-to-end.
    4. All previously passing tests still pass.
  User will approve APK build only AFTER regression passes. No merge to master until user approval.

backend:
  - task: "Beta 18 flow: Upload → Analysis → Executive Report → Apply"
    implemented: true
    working: true
    file: "backend/server.py, backend/_koil.py, backend/_apply_engine.py, backend/gas_client.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "testing"
        comment: "Verified earlier this session before GitHub push."
      - working: "NA"
        agent: "main"
        comment: "Post-sync regression requested. HEAD matches 30aaf64 remote. Re-verify."

  - task: "GET /api/executive returns live executive summary"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "testing"
        comment: "Working in previous iteration."

  - task: "POST /api/upload/portfolio-analysis triggers AI ingestion"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "testing"
        comment: "Working in previous iteration."

  - task: "POST /api/upload/apply-analysis applies insights to system"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "testing"
        comment: "Working in previous iteration."

frontend:
  - task: "UI primitives (SectionTitle / ListRow / ActingAsBadge) render across screens"
    implemented: true
    working: true
    file: "frontend/src/components/SectionTitle.tsx, ListRow.tsx, ActingAsBadge.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Refactored support/about/billing/MoreMenu + portal screens (agent/tech/tenant)."

  - task: "Device localization auto-RTL via expo-localization"
    implemented: true
    working: true
    file: "frontend/src/i18n/index.ts, frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Arabic devices default to RTL; saved user preference wins."

  - task: "Deep-link cold start routes to correct portal (agent/tech/tenant/owner)"
    implemented: true
    working: true
    file: "frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Fixed regression that used to send all QR portal links to Home."

  - task: "Beta 18 Upload → Analysis → Executive Report → Apply UI flow"
    implemented: true
    working: true
    file: "frontend/app/upload.tsx, frontend/app/index.tsx (executive), frontend/app/apply.tsx (if any)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "testing"
        comment: "End-to-end verified previously against real GAS data."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 7
  run_ui: true

test_plan:
  current_focus:
    - "Beta 18 flow: Upload → Analysis → Executive Report → Apply"
    - "GET /api/executive returns live executive summary"
    - "POST /api/upload/portfolio-analysis triggers AI ingestion"
    - "POST /api/upload/apply-analysis applies insights to system"
    - "UI primitives (SectionTitle / ListRow / ActingAsBadge) render across screens"
    - "Device localization auto-RTL via expo-localization"
    - "Deep-link cold start routes to correct portal (agent/tech/tenant/owner)"
    - "Beta 18 Upload → Analysis → Executive Report → Apply UI flow"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Post-GitHub-Sync full regression. Local HEAD = Remote HEAD = 30aaf64 on branch conflict_030726_0550.
      Please run:
        (A) BACKEND: All /api/* endpoints, with special focus on the Beta 18 pipeline
            (upload/portfolio-analysis → executive → upload/apply-analysis). GAS integration is REAL, not mocked.
        (B) FRONTEND: Full smoke pass on the polished Beta 18 UI —
              - Home / Executive summary
              - Upload screen (file picker path only; camera NOT implemented yet)
              - Analysis → Executive Report → Apply end-to-end
              - Portal deep links (agent/tech/tenant/owner) render correct ActingAsBadge
              - RTL rendering with Arabic language
              - New UI primitives (SectionTitle / ListRow) present on support, about, billing, MoreMenu
      No credentials required. No mocks. Do NOT modify code — this is a regression pass on the exact GitHub HEAD.
