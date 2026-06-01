# ResQ — AI Ambulance Allocation System

> Emergency response platform powered by Machine Learning (priority prediction) and a Genetic Algorithm (optimal dispatch). Built with Next.js, Express, Supabase, and Socket.IO.

---

## Architecture

```
Gen-Z/
├── frontend/          # Next.js 16 + Tailwind CSS + shadcn/ui
├── backend/           # Express + TypeScript + Socket.IO + Better Auth
├── ai-ml/             # Python ML service (separate — see its own README)
└── docs/              # Design docs
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | Express 5, TypeScript, Socket.IO, Zod |
| Database | Supabase (PostgreSQL) |
| Auth | Better Auth (email + password, role-based) |
| Maps | Leaflet + CartoDB dark tiles |
| Charts | Recharts |
| AI/ML | Python FastAPI service (Random Forest) |
| Allocation | Genetic Algorithm (inline TypeScript fallback) |

---

## Quick Start

### 1. Database Setup (Supabase)

1. Go to your **Supabase SQL Editor**
2. Run `backend/better_auth_migration.sql` first
3. Then run `backend/supabase_schema.sql`

### 2. Backend

```bash
cd backend

# Fill in your actual values:
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - BETTER_AUTH_SECRET (any 32+ char random string)
# Edit .env

npm install
npm run dev
# → Running on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend

# Edit .env.local if needed (defaults work for local dev)

npm install
npm run dev
# → Running on http://localhost:3000
```

### 4. AI-ML Service (optional)

```bash
cd ai-ml
pip install -r requirements.txt
python main.py
# → Running on http://localhost:8000
```

> If the AI-ML service is not running, the backend automatically falls back to a rule-based priority classifier.

---

## User Roles

| Role | Access |
|------|--------|
| **Patient** | Create emergency requests, live-track assigned ambulance |
| **Driver** | View assignment, accept/complete trip, auto-broadcasts GPS |
| **Admin** | Dashboard metrics, all requests, fleet management, assignments |

## Default Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account (select role) |
| `/patient/dashboard` | Patient home |
| `/patient/request` | New emergency form |
| `/patient/track/[id]` | Live ambulance tracking |
| `/driver/dashboard` | Driver home + active task |
| `/admin/dashboard` | Admin overview |
| `/admin/requests` | All emergency requests |
| `/admin/ambulances` | Fleet management |
| `/admin/assignments` | Assignment log |

---

## How Assignment Works

```
Patient submits request
       ↓
Backend calls AI-ML /predict (or rule-based fallback)
       ↓
Priority assigned: low / medium / high / critical
       ↓
Genetic Algorithm evaluates all available ambulances:
  Fitness = (priority_weight × 100) / (haversine_distance + 1)
  Runs 5 generations of selection → crossover → mutation
       ↓
Best ambulance selected → Assignment created in Supabase
       ↓
Socket.IO notifies driver (assignment:new) + patient (request:status_change)
       ↓
Driver accepts → GPS tracking begins → Patient sees live map
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres.xxx:password@aws-region.pooler.supabase.com:6543/postgres

BETTER_AUTH_SECRET=your_32_char_random_secret
BETTER_AUTH_URL=http://localhost:5000

AI_ML_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## Design System

Strict black-and-white monochrome palette:

| Token | Value |
|-------|-------|
| `--bg-base` | `#050505` |
| `--bg-card` | `#111111` |
| `--text-primary` | `#ededed` |
| `--text-muted` | `#7a7a7a` |
| `--border` | `#2a2a2a` |

Font: **Geist** (sans) + **Geist Mono** (code)
