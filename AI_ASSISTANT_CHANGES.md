# AI Journey Assistant — change list

## New files
- backend/app/services/railway_tools.py — read-only, validated MongoDB tools (the AI's only database access)
- backend/app/services/ai_provider.py — Gemini provider (backend only, key from env, stdlib HTTP)
- backend/app/services/assistant.py — conversation, tool loop, structured cards, follow-up context, grounding guard
- backend/app/routes/assistant.py — POST /api/assistant/chat, GET /api/assistant/status (+ per-IP rate limit)
- backend/tests/test_railway_tools.py, test_assistant_core.py, test_ai_provider.py — offline logic tests
- backend/tests/test_assistant_api.py — HTTP tests (needs the normal backend environment)
- backend/tests/test_assistant_live.py — checks against YOUR real MongoDB (and Gemini if a key is set)
- backend/tests/fake_db.py, fixtures_synthetic.py — TEST-ONLY in-memory DB and SYNTHETIC records (never used by the app)
- frontend/src/components/AssistantBlocks.jsx — cards for assistant results (reuses existing modals + NationalMap)

## Modified files
- backend/app/config.py — optional AI settings (app still starts without them)
- backend/app/main.py — include assistant router; CORS now allows POST (was GET only)
- backend/app/routes/__init__.py — export assistant router
- backend/.env.example — AI variables with placeholders
- backend/requirements.txt — unchanged (no new dependencies)
- frontend/src/components/JourneyAssistant.jsx — real assistant (header/shell/classes preserved)
- frontend/src/components/NationalMap.jsx — optional `embedded` prop; default behaviour unchanged
- frontend/src/App.jsx — passes onSelectTrain/onSelectStation/onViewMap to JourneyAssistant
- frontend/src/services/api.js — added sendAssistantMessage, getAssistantStatus
- README.md — AI assistant section

## Not touched
Database contents/collections/indexes, journey_estimator.py, existing routes, Home/Trains/Stations/modals/Navbar/CSS.
