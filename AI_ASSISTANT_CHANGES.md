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


## Version 2: feature release

### New backend files
- app/services/journey_tools.py: one-change journeys, reachability, trip planner, comparison, halts
- app/services/demo_tools.py: DEMO PNR finder, fares, seats, running status, food menu and orders
- app/services/tools.py: single tool registry the AI can call (merges real and demo tools)
- app/services/ticket_reader.py: ticket photo reading (image kept in memory only)
- app/services/data_quality.py and scripts/data_quality_report.py: read-only data checks
- app/services/eval_runner.py and scripts/run_assistant_eval.py: question suite for the real model
- app/routes/demo.py: /api/demo/* endpoints
- backend/gemini_test.py: checks your key and model
- tests: test_journey_tools, test_demo_tools, test_assistant_features, test_ticket_reader, test_data_quality, test_eval_runner, test_assistant_api

### Changed backend files
- app/services/assistant.py: new blocks, follow-up chips, progress events, cache, language, preferences, DEMO rules
- app/services/railway_tools.py: time filters; ASCII-only digit validation
- app/services/ai_provider.py: JSON response option; default model gemini-3.5-flash-lite
- app/routes/assistant.py: /stream and /ticket endpoints, daily limit
- app/config.py, .env.example, app/main.py, app/routes/__init__.py

### New frontend files
- components/Services.jsx, components/Icons.jsx (SVG icons)
- utils/: i18n.js, ics.js, share.js, journey.js, prefs.js, orders.js, image.js
- frontend/.env.example (optional VITE_API_URL)

### Changed frontend files
- components/AssistantBlocks.jsx, JourneyAssistant.jsx, NationalMap.jsx (marker overlay mode), Navbar.jsx, Home.jsx ("Ask AI"), App.jsx, services/api.js, index.css, index.html
