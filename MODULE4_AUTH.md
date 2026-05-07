# MODULE 4: User Authentication & History

# File: MODULE4_AUTH.md — Place in project root

# Working directory: ~/Videos/Graduation Project/ai-code-analyst

# Always run: source venv/bin/activate before any Python command

---

## OVERVIEW

Goal: Add Supabase-based authentication so each user has a personal account linked to their
optimization history. Users can log in, view a dashboard with score trends and global stats,
and return to any past session.

Owner split:

- **Asaad** → `core/schemas.py`, `core/config.py`, `orchestrator.py` (schema + config changes only)
- **Abdulkadir** → `api/app.py`, `frontend/` (all auth endpoints + UI)

Pipeline is NOT changing. No agents are touched. No teammate files are touched.

---

## PREREQUISITES

Before starting Task 4.1, confirm all of the following:

- [ ] `python orchestrator.py` runs end-to-end without errors
- [ ] Module 3 is pushed and merged to main
- [ ] You have a Supabase account at https://supabase.com (free tier is fine)
- [ ] `git pull` to get everyone's latest code

---

## TASK 4.1 — Supabase Project Setup + Schema Changes

**Owner:** Asaad
**Time:** 1–2 hours
**Files to edit:** `core/schemas.py`, `core/config.py`

### Step 1 — Create Supabase project

1. Go to https://supabase.com → New Project
2. Name it `ai-code-analyst`, choose a region close to Turkey (e.g. Frankfurt)
3. Save the following from Project Settings → API:
   - `SUPABASE_URL` (looks like `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` (public anon key)
4. Add both to your `.env` file:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### Step 2 — Create database tables in Supabase SQL Editor

Run this SQL in Supabase → SQL Editor → New Query:

```sql
-- Sessions table: one row per analysis run
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source_code TEXT NOT NULL,
  final_report JSONB NOT NULL
);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users see own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);
```

### Step 3 — Add config variables to `core/config.py`

Add these lines (do NOT remove existing variables):

```python
import os
from dotenv import load_dotenv
load_dotenv()

# Existing keys stay as-is
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# New for Module 4
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
```

### Step 4 — Add new schemas to `core/schemas.py`

Add these Pydantic models at the bottom (do NOT modify existing models):

```python
from typing import Optional
from datetime import datetime

class SessionRecord(BaseModel):
    """Represents one saved analysis session stored in Supabase."""
    id: Optional[str] = None
    user_id: str
    created_at: Optional[datetime] = None
    source_code: str
    final_report: dict  # serialized FinalReport

class UserStats(BaseModel):
    """Aggregated stats shown on the user dashboard."""
    total_sessions: int
    total_bugs_fixed: int
    total_memory_saved_mb: float
    most_common_bug_type: Optional[str] = None
    avg_code_dna_score: float
    score_trend: list[float]  # list of avg scores over time, oldest first
```

### Step 5 — Update `orchestrator.py` to accept optional user_id

Find the `run()` method signature and add an optional `user_id` parameter.
The orchestrator does NOT save to Supabase itself — it just passes user_id through
so the API layer (Abdulkadir) can save the result after calling run().

```python
async def run(self, source_code: str, user_id: Optional[str] = None) -> FinalReport:
    # existing logic unchanged
    # at the end, attach user_id to the report so the API can use it
    report.user_id = user_id  # only if you add user_id: Optional[str] = None to FinalReport
    return report
```

Also add `user_id: Optional[str] = None` to `FinalReport` in `core/schemas.py`:

```python
class FinalReport(BaseModel):
    # ... existing fields ...
    user_id: Optional[str] = None  # set by API layer, not orchestrator
```

### Test block

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate
python -c "
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
assert SUPABASE_URL and SUPABASE_URL.startswith('https://'), 'SUPABASE_URL missing or wrong'
assert SUPABASE_ANON_KEY and len(SUPABASE_ANON_KEY) > 10, 'SUPABASE_ANON_KEY missing'
print('Config OK')
from core.schemas import SessionRecord, UserStats, FinalReport
r = FinalReport.__fields__
assert 'user_id' in r, 'user_id missing from FinalReport'
print('Schemas OK')
"
python orchestrator.py
```

Expected: Config OK, Schemas OK, pipeline runs end-to-end without errors.

**Commit:** `"feat: supabase config, SessionRecord/UserStats schemas, user_id in FinalReport"`

---

## TASK 4.2 — Backend Auth Endpoints

**Owner:** Abdulkadir
**Time:** 2–3 hours
**Files to edit:** `api/app.py`

Install Supabase Python client first:

```bash
pip install supabase
```

Add to `requirements.txt`:

```
supabase>=2.0.0
```

### Endpoints to add in `api/app.py`

```
POST /auth/signup        — create account with email + password
POST /auth/login         — login, return JWT access token
POST /auth/logout        — invalidate session
GET  /auth/me            — return current user info from JWT
```

Use the official `supabase-py` client:

```python
from supabase import create_client
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY

supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### Also update the existing `/analyze` endpoint

Extract the JWT from the `Authorization: Bearer <token>` header.
Pass the decoded `user_id` to `orchestrator.run(source_code, user_id=user_id)`.
After getting the FinalReport back, save it to Supabase:

```python
supabase_client.table("sessions").insert({
    "user_id": user_id,
    "source_code": source_code,
    "final_report": report.dict()
}).execute()
```

If no token is provided, still run the analysis but do not save (anonymous use is allowed).

### Test block

```bash
# Start the API server
uvicorn api.app:app --reload

# In another terminal:
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "testpass123"}'
# Expected: {"user": {...}, "session": {...}}

curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "testpass123"}'
# Expected: {"access_token": "...", "user": {...}}
```

**Commit:** `"feat: supabase auth endpoints signup/login/logout/me, save session after analyze"`

---

## TASK 4.3 — Session History API Endpoints

**Owner:** Abdulkadir
**Time:** 1–2 hours
**Files to edit:** `api/app.py`

Add these endpoints:

```
GET  /sessions           — list all sessions for the logged-in user (newest first)
GET  /sessions/{id}      — get one full session by ID (code + full report)
GET  /sessions/stats     — return UserStats for the logged-in user
```

For `/sessions/stats`, compute on the backend from the sessions table:

- `total_sessions` → count of rows for this user_id
- `total_bugs_fixed` → sum of `final_report->bug_report->bug_score` across sessions (use a threshold: score > 0 counts as "fixed")
- `total_memory_saved_mb` → sum of memory improvement from validation results
- `most_common_bug_type` → most frequent bug type string across all sessions
- `avg_code_dna_score` → average of final DNA scores
- `score_trend` → list of avg_code_dna_score per session ordered by created_at ASC

All these queries run against the `sessions` table in Supabase using the Python client.

### Test block

```bash
# After logging in and running at least one analysis:
TOKEN="your_access_token_here"

curl http://localhost:8000/sessions \
  -H "Authorization: Bearer $TOKEN"
# Expected: list of session objects

curl http://localhost:8000/sessions/stats \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"total_sessions": 1, "total_bugs_fixed": ..., ...}
```

**Commit:** `"feat: session history endpoints list/get/stats"`

---

## TASK 4.4 — Frontend Auth UI

**Owner:** Abdulkadir
**Time:** 2–3 hours
**Files to edit:** `frontend/`

### Pages to add / update

**Login / Signup page** (`/login`)

- Email + password form
- Toggle between login and signup mode
- On success: store JWT in `localStorage` as `access_token`, redirect to `/dashboard`
- Show error messages inline (wrong password, email taken, etc.)

**Navbar update**

- If logged in: show user email + Logout button
- If not logged in: show Login button
- Logout clears `localStorage` and redirects to `/`

**Protected route wrapper**

- Wrap `/dashboard` and `/sessions/*` routes
- Redirect to `/login` if no token in localStorage

### Test block

Manual test in browser:

1. Go to `/login` → sign up with a new email → should redirect to `/dashboard`
2. Refresh the page → should still be logged in (token persisted)
3. Click logout → should redirect to `/` and remove token
4. Go directly to `/dashboard` while logged out → should redirect to `/login`

**Commit:** `"feat: login/signup UI, JWT storage, protected routes, navbar auth state"`

---

## TASK 4.5 — User Dashboard UI

**Owner:** Abdulkadir
**Time:** 2–3 hours
**Files to edit:** `frontend/`

### Dashboard page (`/dashboard`)

**Section 1: Global Stats (top row, 4 cards)**

- Total Sessions Analyzed
- Total Bugs Fixed
- Total Memory Saved (MB)
- Most Common Bug Type

Fetch from `GET /sessions/stats`.

**Section 2: Score Trend Chart**

- Line chart using Recharts
- X-axis: session number (1, 2, 3…)
- Y-axis: average Code DNA score (0–100)
- Data from `score_trend` array in stats response

**Section 3: Recent Sessions List**

- Fetch from `GET /sessions` (limit to last 10)
- Each row shows: date, bug score, speedup %, validation status
- Clicking a row navigates to `/sessions/{id}`

### Session Detail page (`/sessions/:id`)

Fetch from `GET /sessions/{id}`. Display:

- Original code (read-only code block)
- Code DNA chart (same component used in main results view)
- Execution logs / validation result
- Bug report summary

### Test block

Manual test:

1. Run at least 2 analyses while logged in
2. Go to `/dashboard` → stats cards show correct numbers, chart shows 2 data points
3. Click a session row → detail page loads the correct code and report
4. Verify score trend chart renders (not blank, no console errors)

**Commit:** `"feat: dashboard stats cards, score trend chart, session list and detail page"`

---

## TASK 4.6 — End-to-End Integration Test

**Owner:** Asaad (runs the test, coordinates with Abdulkadir)
**Time:** 1 hour

### Full flow to verify

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate

# 1. Start API
uvicorn api.app:app --reload &

# 2. Start frontend
cd frontend && npm run dev &

# 3. Open browser at http://localhost:5173
```

Walk through this checklist:

- [ ] Sign up with a new email → redirected to dashboard
- [ ] Submit code for analysis (paste a sample from `datasets/sample_code/`)
- [ ] Analysis completes → result shown in UI
- [ ] Navigate to `/dashboard` → session appears in list, stats updated
- [ ] Click session → detail page shows original code + report correctly
- [ ] Log out → redirected to home
- [ ] Log back in → session history still there (persisted in Supabase)
- [ ] Run `python orchestrator.py` directly → pipeline still works without auth (no regression)

**Commit:** `"test: end-to-end auth + history flow verified"`

---

## FINAL VERIFICATION CHECKLIST

Run before marking Module 4 complete:

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate

# Pipeline must still work
python orchestrator.py

# Schemas must import cleanly
python -c "from core.schemas import SessionRecord, UserStats, FinalReport; print('Schemas OK')"

# Config must load both keys
python -c "
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
assert all([SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY])
print('All env vars OK')
"
```

Expected output: no errors, "Schemas OK", "All env vars OK"

---

## COMMIT HISTORY FOR MODULE 4 (4 commits total)

```
1. "feat: supabase config, SessionRecord/UserStats schemas, user_id in FinalReport"  ← Asaad
2. "feat: supabase auth endpoints signup/login/logout/me, save session after analyze"  ← Abdulkadir
3. "feat: session history endpoints list/get/stats"  ← Abdulkadir
4. "feat: login/signup UI, JWT storage, protected routes, navbar auth state"  ← Abdulkadir
5. "feat: dashboard stats cards, score trend chart, session list and detail page"  ← Abdulkadir
6. "test: end-to-end auth + history flow verified"  ← Asaad
```

---

## DEPENDENCY NOTES

- Asaad must complete Task 4.1 before Abdulkadir starts Task 4.2
- Tasks 4.2 and 4.3 can be done in the same session (same file)
- Tasks 4.4 and 4.5 can be done in the same session (same frontend folder)
- Task 4.6 requires both 4.1–4.3 (backend) and 4.4–4.5 (frontend) to be done

## NEW PACKAGES TO ADD TO requirements.txt

```
supabase>=2.0.0
```

No new packages needed for the React frontend — Recharts is already in use from the showcase work.
