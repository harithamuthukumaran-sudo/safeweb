# SafeWeb — AI-Powered Website Safety Tracker

> Scan any URL for threats, SSL issues, phishing, malware, and uptime — with transparent, honest risk scoring.

---

## Project Structure

```
children safe/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/v1/            # scan, history, monitor, alerts endpoints
│   │   ├── core/              # config, JWT auth security
│   │   ├── models/            # Pydantic schemas
│   │   ├── services/          # SSRF validator, SSL checker, threat intel, scoring
│   │   └── workers/           # monitor_scheduler.py background worker
│   ├── tests/                 # 68 automated tests (all passing)
│   └── requirements.txt
│
├── frontend-web/               # React + Vite + Tailwind CSS web app
│   └── src/
│       ├── pages/             # Scanner, Dashboard, Monitor, Alerts, Auth
│       ├── components/        # Navbar, RiskScoreMeter, ScanResultCard
│       ├── context/           # AuthContext (Supabase)
│       └── lib/               # supabase.js, api.js
│
├── mobile/                     # React Native + Expo mobile app
│   └── app/(tabs)/            # index, dashboard, monitor, alerts, profile
│
├── supabase/
│   └── schema.sql              # PostgreSQL tables + RLS policies
│
├── render.yaml                 # Render.com deployment (backend + scheduler)
└── .gitignore
```

## Running Locally

### 1. Backend
```powershell
cd backend
.\venv\Scripts\uvicorn.exe app.main:app --reload
# → http://127.0.0.1:8000
# → http://127.0.0.1:8000/docs  (Swagger UI)
```

### 2. Frontend
```powershell
cd frontend-web
npm run dev
# → http://localhost:5173
```

### 3. Scheduler (optional)
```powershell
cd backend
.\venv\Scripts\python.exe -m app.workers.monitor_scheduler
```

### 4. Mobile
```powershell
cd mobile
npx expo start
# Scan QR code with Expo Go app
```

## Running Tests
```powershell
.\backend\venv\Scripts\python.exe -m pytest backend\tests -v
# 68 tests: SSRF, SSL, scoring, auth, API integration
```

## Security Features
- ✅ **SSRF Protection** — blocks localhost, RFC1918, link-local, cloud metadata, non-HTTP schemes, restricted ports
- ✅ **JWT Auth** — Supabase-issued tokens verified on backend, never stored in frontend
- ✅ **Row Level Security** — users can only see their own data in Supabase
- ✅ **No secrets in frontend** — only public anon key exposed; service-role key backend-only
- ✅ **Honest scoring** — explicit disclaimer that "no threat found ≠ safe"

## Deployment
- **Backend + Scheduler** → [Render.com](https://render.com) (see `render.yaml`)
- **Frontend** → [Vercel](https://vercel.com) (see `frontend-web/vercel.json`)
- **Mobile** → Expo EAS Build (see `mobile/eas.json`)
- **Database + Auth** → [Supabase](https://supabase.com) (see `supabase/schema.sql`)
