# RailSaathi: Indian Railway Directory and Journey Assistant

RailSaathi is a full-stack web application for exploring the Indian railway network. It combines a searchable directory of more than 5,200 trains and 8,900 stations, complete stop-by-stop timetables, an interactive route map, a timetable-based position estimator, and an AI journey assistant that answers questions using the real data in the database.

- **Frontend:** React and Vite, styled with Tailwind utility classes and a custom stylesheet, with Leaflet and OpenStreetMap for maps
- **Backend:** Python and FastAPI
- **Database:** MongoDB Atlas
- **AI:** Google Gemini, called only from the backend

---

## Key Features

1. **Nationwide coverage.** 5,208 trains and 8,900 stations stored in MongoDB.
2. **Robust importer.** Idempotent upserts, batch processing, and complete ordered route preservation.
3. **REST API.** Search trains and stations, read ordered timetables, and list the trains that stop at any station, with pagination.
4. **National route map.** Leaflet and OpenStreetMap map showing every intermediate stop of a train, with sequence markers.
5. **Scheduled position estimator.** Estimates where a train should be from its printed arrival and departure times. It is clearly labelled as a timetable estimate and is not live GPS tracking.
6. **AI journey assistant.** A conversational assistant connected to the database through fixed, validated, read-only tools. See [AI Journey Assistant](#ai-journey-assistant).

---

## Project Structure

```
IndianRailway/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, health and position endpoints
│   │   ├── config.py                # Settings read from environment variables
│   │   ├── database.py              # MongoDB connection
│   │   ├── models/schemas.py
│   │   ├── routes/
│   │   │   ├── trains.py
│   │   │   ├── stations.py
│   │   │   ├── search.py
│   │   │   └── assistant.py         # POST /api/assistant/chat, GET /api/assistant/status
│   │   ├── services/
│   │   │   ├── journey_estimator.py # timetable-based position estimate
│   │   │   ├── railway_tools.py     # the only database access the AI has (read-only, validated)
│   │   │   ├── ai_provider.py       # Gemini client (backend only, key from environment)
│   │   │   └── assistant.py         # conversation, tool loop, result cards, follow-up memory
│   │   └── utils/helpers.py
│   ├── scripts/import_railway_data.py
│   ├── gemini_test.py               # checks your Gemini key and model
│   ├── tests/                       # API, tool, assistant, provider and live tests
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.jsx, Trains.jsx, Stations.jsx, Navbar.jsx
│   │   │   ├── NationalMap.jsx
│   │   │   ├── TrainDetailModal.jsx, StationDetailModal.jsx
│   │   │   ├── JourneyAssistant.jsx # chat interface
│   │   │   ├── AssistantBlocks.jsx  # cards for assistant results
│   │   │   └── Icons.jsx            # inline SVG icon set
│   │   ├── services/api.js
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## Getting Started Locally

### Prerequisites
- Python 3.10 or newer
- Node.js 18 or newer
- A MongoDB Atlas cluster and its connection string
- A Google AI Studio API key (only needed for the AI assistant)

### 1. Backend setup

```bash
cd backend
python -m venv venv

# Windows PowerShell
.\venv\Scripts\Activate.ps1
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` inside `backend/` and fill in your values:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/
DB_NAME=indian_railway
ALLOWED_ORIGINS=http://localhost:5173

AI_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Never commit `.env`. It is listed in `.gitignore`.

### 2. Import railway data (first time only)

Place the `Indian-Railway-Data-main` dataset next to the project folder (or adjust the paths in the script), then run:

```bash
# Test import (first 10 trains)
python scripts/import_railway_data.py --test

# Full import (all trains and stations)
python scripts/import_railway_data.py
```

### 3. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

API documentation is available at `http://localhost:8000/docs`.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend calls the relative path `/api`, and the Vite dev server forwards it to the backend.

If you run the backend on a different port, change the proxy target in `frontend/vite.config.js`:

```js
proxy: { '/api': { target: 'http://localhost:8001', changeOrigin: true } }
```

---

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service and database health |
| GET | `/api/search?q=` | Combined train and station search |
| GET | `/api/trains` | List trains (paginated) |
| GET | `/api/trains/search` | Search trains |
| GET | `/api/trains/{number}` | Train details |
| GET | `/api/trains/{number}/route` | Complete ordered route |
| GET | `/api/trains/{number}/map` | Route with station coordinates for the map |
| GET | `/api/trains/{number}/position` | Timetable-based position estimate |
| GET | `/api/stations` | List stations (paginated) |
| GET | `/api/stations/search` | Search stations |
| GET | `/api/stations/{code}` | Station details |
| GET | `/api/stations/{code}/trains` | Trains stopping at a station |
| POST | `/api/assistant/chat` | One AI assistant conversation turn |
| GET | `/api/assistant/status` | Whether the AI is configured (never returns the key) |

---

## AI Journey Assistant

The **Journey AI** tab is a conversational assistant that looks facts up in the MongoDB database instead of answering from memory.

### How it works

```
Browser (JourneyAssistant.jsx)
   |  POST /api/assistant/chat   { message, last few messages, small context }
   v
FastAPI  -->  Gemini (function calling)  -->  asks for one of the fixed tools
                    ^                                     |
                    |  real results                       v
                    +-----------------  railway_tools.py --> MongoDB (read-only)
   ^
   +-- { reply text, cards built from the real records, updated context }
```

- The model never writes database queries. It can only call these tools, each with validated arguments: `search_trains`, `get_train_details`, `get_train_route`, `search_stations`, `get_station_details`, `get_station_trains`, `get_trains_at_station`, `find_trains_between_stations`, `get_scheduled_position`.
- Every tool is read-only. Inputs are type-checked, length-limited and regex-escaped.
- Cards and map data are built by the backend from the tool results, not written by the model.
- If a record or field is missing, the assistant says so. If MongoDB or the AI service fails, the chat shows a clear error. It never switches to made-up data.
- A guard checks the reply for train-style numbers that no tool returned, and corrects or flags them.
- Follow-ups such as "what is its next station?" or "show its route" work because the browser sends the last few messages plus a small validated context (current train or station, last results). The server stores no sessions.
- Route maps reuse the existing `NationalMap` component in an `embedded` mode. Stops without stored coordinates are not drawn.
- Timetable estimates are not live tracking. "Next station" answers use `journey_estimator.py` with Indian time and are always labelled as estimates.

### What you can ask

- "Tell me about train 12951."
- "Show me the route of this train."
- "Tell me about Raipur Junction."
- "Which trains can take me from Raipur to Nagpur?" then "Which one has the shortest scheduled journey?" then "Show its route."

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` | AI provider (only `gemini` is supported today) |
| `GEMINI_API_KEY` | none | Key from Google AI Studio. Stays on the server. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Any Gemini model that supports function calling |
| `AI_TIMEOUT_SECONDS` | `30` | How long to wait for the AI before showing an error |
| `ASSISTANT_RATE_LIMIT_PER_MIN` | `20` | Requests per minute per client IP |

Google retires models over time. If the assistant reports that the model was not found, run `python gemini_test.py <model-name>` from the `backend` folder (a small script that sends a test request) or check Google AI Studio for a current model, then update `GEMINI_MODEL`.

### Known limitations

- Direct trains only. Connecting journeys are not searched.
- No live running status, delays, platforms, PNR status, fares or seat availability, because none of these are in the database.
- Ticket-image understanding is not included yet and is planned as a next phase.
- The per-IP rate limit is held in memory, so it applies per backend process and resets on restart.

---

## Testing

```bash
cd backend

# Offline logic tests (no database or API key needed)
python -m unittest tests.test_railway_tools tests.test_assistant_core tests.test_ai_provider -v

# HTTP tests (need a reachable MongoDB, like the existing API tests)
python -m pytest tests/test_assistant_api.py tests/test_api.py

# Live checks against your real MongoDB (and real Gemini if a key is set)
python -m unittest tests.test_assistant_live -v
```

The offline tests use synthetic records defined in `tests/fixtures_synthetic.py`. These exist only for testing and are never used by the application.

---

## Deployment

A common setup is the frontend on Vercel and the backend on Render.

### Backend on Render

1. Push the repository to GitHub. Make sure `backend/.env` is not committed.
2. In MongoDB Atlas, open Network Access and allow the server to connect. Free Render instances have no fixed IP, so this usually means allowing `0.0.0.0/0`. Use a strong database password.
3. In Render, create a new Web Service from the repository with:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/api/health`
4. Add the environment variables: `PYTHON_VERSION` (for example `3.11.9`), `MONGODB_URI`, `DB_NAME`, `ALLOWED_ORIGINS` (your frontend URL, no trailing slash), `AI_PROVIDER`, `GEMINI_API_KEY` and `GEMINI_MODEL`.
5. Check `https://<your-service>.onrender.com/api/health` and `/api/assistant/status`.

Free Render services sleep after about 15 minutes without traffic, and the first request afterwards can take around a minute. A paid instance removes the sleep.

### Frontend on Vercel

Add `frontend/vercel.json` so that `/api` requests go to your backend:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<your-service>.onrender.com/api/:path*" }
  ]
}
```

Then import the repository in Vercel with `frontend` as the root directory. Vercel detects Vite automatically.

---

## Security Notes

- API keys and the database connection string live only in environment variables. They are never sent to the browser.
- Do not commit `.env`, virtual environments, `node_modules` or cache folders.
- The assistant has no write access to the database and cannot run arbitrary queries.
- If a secret is ever shared or committed by mistake, rotate it (change the database password or create a new API key).
