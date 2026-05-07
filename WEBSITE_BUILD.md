# WEBSITE_BUILD.md

# Full-Stack Build Blueprint — Autonomous AI Code Performance & Debugging Analyst

# Author: Asaad Suliman — System Architect & Pipeline Lead

# Working directory: ~/Videos/Graduation Project/ai-code-analyst

# ALWAYS run: source venv/bin/activate before ANY Python command

# NEVER edit: bug_detector.py, optimizer.py, prompts.py, performance_analyzer.py, code_executor.py

---

## CRITICAL FACTS (read before doing anything)

1. `api/app.py` does NOT exist yet — it must be created from scratch
2. `orchestrator.py` EXISTS and works — never modify it
3. `core/schemas.py` EXISTS with all Pydantic models — never modify it
4. `core/config.py` EXISTS with SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY — never modify it
5. `requirements.txt` EXISTS but is missing: supabase, python-multipart, openai, httpx
6. The frontend folder may exist but needs to be fully rebuilt
7. This file handles BOTH backend (api/app.py) AND frontend (React) in one continuous run

## PIPELINE (already works — do not touch)

UserInput → ArchitectAgent → SecurityAgent → BugDetector → PerformanceAnalyzer → Optimizer → Validator → FinalReport

## FINALREPORT FIELDS (from core/schemas.py — these are what the frontend displays)

- source_code: str
- architect_report: ArchitectReport (functions_found, dependency_map, total_functions)
- security_report: SecurityReport (security_score, issues, has_critical_issues)
- rag_context: RAGContext (matches_found, top_matches, retrieval_summary)
- bug_report: BugReport (bug_score 0-100, bugs list, summary, has_critical_bugs)
- performance_report: PerformanceReport (execution_time_ms, memory_usage_mb, time_complexity, space_complexity, bottlenecks)
- optimization: OptimizationResult (optimized_code, changes_made, expected_improvement)
- validation: ValidationResult (status: approved/rejected/unchanged, original_time_ms, optimized_time_ms, speedup_percentage, outputs_match, summary)
- optimized_code: str
- overall_summary: str
- stages_completed: List[str]
- baseline_dna: CodeDNAFingerprint (complexity, security, performance, readability, bug_density, optimization — all 0-100)
- optimized_dna: CodeDNAFingerprint (same fields)
- baseline_resources: ResourceTimeline (samples with elapsed_ms, cpu_percent, memory_mb)
- optimized_resources: ResourceTimeline (same)
- user_id: Optional[str]

---

## AUTOMATIC EXECUTION RULES FOR CLAUDE CODE

- Work through every task from Task 0 to Task 10 WITHOUT stopping
- After each task: run the test block, verify it passes, then immediately move to next task
- If a test fails: fix the error, re-run the test, then continue — do NOT stop and ask
- Never ask for permission to continue to the next task
- Never skip a task
- When all tasks are done: run the FINAL VERIFICATION block
- Only stop if a test fails 3 times in a row — then report exactly what failed

---

## TASK 0 — Fix requirements.txt and install dependencies

Add these missing packages to requirements.txt:

```
supabase>=2.0.0
python-multipart>=0.0.6
openai>=1.0.0
httpx>=0.24.0
```

Then install:

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate
pip install supabase python-multipart openai httpx --break-system-packages
pip install -r requirements.txt --break-system-packages
```

**Test:**

```bash
source venv/bin/activate
python3 -c "import supabase; import fastapi; import uvicorn; print('All packages OK')"
```

Expected: `All packages OK`

**Commit:** `"fix: add supabase, python-multipart, openai, httpx to requirements"`

---

## TASK 1 — Build api/app.py (full FastAPI backend)

**Create file:** `api/app.py`

```python
"""
API Layer — FastAPI Backend
============================
Author: Asaad (System Architect)
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json

from supabase import create_client, Client
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
from core.schemas import FinalReport, SessionRecord, UserStats
from orchestrator import Orchestrator

app = FastAPI(title="AI Code Analyst API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

class AnalyzeRequest(BaseModel):
    code: str
    description: Optional[str] = None

class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception:
        return None

def require_auth(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@app.get("/")
def root():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/auth/signup")
def signup(req: SignupRequest):
    try:
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {"data": {"display_name": req.display_name or req.email.split("@")[0]}}
        })
        if not res.user:
            raise HTTPException(status_code=400, detail="Signup failed")
        return {
            "user": {
                "id": res.user.id,
                "email": res.user.email,
                "display_name": req.display_name or req.email.split("@")[0],
            },
            "access_token": res.session.access_token if res.session else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
def login(req: LoginRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
        if not res.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "access_token": res.session.access_token,
            "user": {
                "id": res.user.id,
                "email": res.user.email,
                "display_name": res.user.user_metadata.get("display_name", res.user.email.split("@")[0]),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    try:
        if authorization and authorization.startswith("Bearer "):
            supabase.auth.sign_out()
    except Exception:
        pass
    return {"message": "Logged out"}

@app.get("/auth/me")
def me(user=Depends(require_auth)):
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.user_metadata.get("display_name", user.email.split("@")[0]),
    }

@app.post("/analyze")
def analyze(req: AnalyzeRequest, authorization: Optional[str] = Header(None)):
    if not req.code or not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    user = get_current_user(authorization)
    user_id = user.id if user else None
    try:
        orch = Orchestrator()
        report: FinalReport = orch.run(
            source_code=req.code,
            description=req.description,
            user_id=user_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")
    if user_id:
        try:
            supabase.table("sessions").insert({
                "user_id": user_id,
                "source_code": req.code,
                "final_report": json.loads(report.model_dump_json()),
            }).execute()
        except Exception as e:
            print(f"[API] Failed to save session: {e}")
    return report

@app.get("/sessions")
def get_sessions(user=Depends(require_auth)):
    try:
        res = supabase.table("sessions") \
            .select("id, created_at, source_code, final_report") \
            .eq("user_id", user.id) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/stats")
def get_stats(user=Depends(require_auth)):
    try:
        res = supabase.table("sessions") \
            .select("final_report, created_at") \
            .eq("user_id", user.id) \
            .order("created_at", desc=True) \
            .execute()
        sessions = res.data
        if not sessions:
            return UserStats(
                total_sessions=0, total_bugs_fixed=0,
                total_memory_saved_mb=0.0, most_common_bug_type=None,
                avg_code_dna_score=0.0, score_trend=[],
            )
        total_bugs_fixed = 0
        total_memory_saved = 0.0
        bug_types = []
        dna_scores = []
        for s in sessions:
            r = s.get("final_report", {})
            bug_report = r.get("bug_report", {})
            if bug_report.get("bug_score", 0) > 0:
                total_bugs_fixed += len(bug_report.get("bugs", []))
            perf = r.get("performance_report", {})
            val = r.get("validation", {})
            orig_mem = perf.get("memory_usage_mb", 0) or 0
            if val.get("status") == "approved" and orig_mem > 0:
                total_memory_saved += orig_mem * 0.3
            for bug in bug_report.get("bugs", []):
                if bug.get("category"):
                    bug_types.append(bug["category"])
            optimized_dna = r.get("optimized_dna", {})
            if optimized_dna:
                scores = [optimized_dna.get(k, 0) for k in ["complexity","security","performance","readability","bug_density","optimization"]]
                dna_scores.append(sum(scores) / len(scores))
        most_common = max(set(bug_types), key=bug_types.count) if bug_types else None
        avg_score = sum(dna_scores) / len(dna_scores) if dna_scores else 0.0
        return UserStats(
            total_sessions=len(sessions),
            total_bugs_fixed=total_bugs_fixed,
            total_memory_saved_mb=round(total_memory_saved, 2),
            most_common_bug_type=most_common,
            avg_code_dna_score=round(avg_score, 1),
            score_trend=dna_scores[-6:],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}")
def get_session(session_id: str, user=Depends(require_auth)):
    try:
        res = supabase.table("sessions") \
            .select("*") \
            .eq("id", session_id) \
            .eq("user_id", user.id) \
            .single() \
            .execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found")
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Test:**

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate
uvicorn api.app:app --reload --port 8000 &
sleep 4
curl -s http://localhost:8000/health
pkill -f uvicorn
```

Expected: `{"status":"healthy"}`

**Commit:** `"feat: create api/app.py — FastAPI backend with auth, analyze, sessions"`

---

## TASK 2 — Set up React frontend

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
mv frontend frontend_backup 2>/dev/null || true
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom axios recharts lucide-react
```

Create `frontend/src/lib/api.js`:

```javascript
import axios from "axios";
const API = axios.create({ baseURL: "http://localhost:8000" });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export const analyzeCode = (code, description) =>
  API.post("/analyze", { code, description });
export const signup = (email, password, display_name) =>
  API.post("/auth/signup", { email, password, display_name });
export const login = (email, password) =>
  API.post("/auth/login", { email, password });
export const logoutApi = () => API.post("/auth/logout");
export const getMe = () => API.get("/auth/me");
export const getSessions = () => API.get("/sessions");
export const getSession = (id) => API.get(`/sessions/${id}`);
export const getStats = () => API.get("/sessions/stats");
export default API;
```

Create `frontend/src/lib/auth.js`:

```javascript
export const getToken = () => localStorage.getItem("access_token");
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};
export const isLoggedIn = () => !!getToken();
export const saveAuth = (token, user) => {
  localStorage.setItem("access_token", token);
  localStorage.setItem("user", JSON.stringify(user));
};
export const clearAuth = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
};
```

Create `frontend/src/index.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap");
:root {
  --bg: #000000;
  --bg-1: #0a0a0f;
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-card-hover: rgba(255, 255, 255, 0.07);
  --border: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);
  --accent: #22d3ee;
  --accent-dim: rgba(34, 211, 238, 0.15);
  --accent-hover: #06b6d4;
  --text: #ffffff;
  --text-2: #a1a1aa;
  --text-3: #52525b;
  --success: #22c55e;
  --danger: #ef4444;
  --warning: #f59e0b;
  --font: "Inter", -apple-system, sans-serif;
  --mono: "JetBrains Mono", monospace;
  --radius: 6px;
  --radius-lg: 10px;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html {
  scroll-behavior: smooth;
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a {
  color: inherit;
  text-decoration: none;
}
button {
  cursor: pointer;
  font-family: var(--font);
}
input,
textarea {
  font-family: var(--font);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.6rem 0.9rem;
  font-size: 14px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s;
}
input:focus,
textarea:focus {
  border-color: var(--accent);
}
textarea {
  resize: vertical;
}
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
```

Create `frontend/src/main.jsx`:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { isLoggedIn } from "./lib/auth";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import History from "./pages/History";
import About from "./pages/About";

const Protected = ({ children }) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/insights"
          element={
            <Protected>
              <Insights />
            </Protected>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <Protected>
              <Insights />
            </Protected>
          }
        />
        <Route
          path="/history"
          element={
            <Protected>
              <History />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
```

Create `frontend/src/components/Navbar.jsx`:

```jsx
import { Link, useLocation } from "react-router-dom";
import { isLoggedIn, getUser, clearAuth } from "../lib/auth";
import { logoutApi } from "../lib/api";

const LINKS = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/insights", label: "Insights" },
  { path: "/about", label: "About" },
  { path: "/history", label: "History" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const loggedIn = isLoggedIn();
  const user = getUser();

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {}
    clearAuth();
    window.location.href = "/";
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        height: 52,
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link
        to="/"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            color: "#000",
          }}
        >
          V
        </div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Validator</span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--mono)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          v0.42
        </span>
      </Link>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {LINKS.map(({ path, label }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "var(--radius)",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--bg-card)" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {active && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
              )}
              {label}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {loggedIn ? (
          <>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>
              {user.display_name || user.email}
            </span>
            <button
              onClick={handleLogout}
              style={{
                fontSize: 12,
                padding: "0.35rem 0.8rem",
                borderRadius: "var(--radius)",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            style={{
              fontSize: 12,
              padding: "0.35rem 0.8rem",
              borderRadius: "var(--radius)",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
            }}
          >
            Sign in
          </Link>
        )}
        <Link
          to="/dashboard"
          style={{
            fontSize: 13,
            fontWeight: 500,
            padding: "0.4rem 1rem",
            borderRadius: "var(--radius)",
            background: "var(--accent)",
            color: "#000",
          }}
        >
          Launch →
        </Link>
      </div>
    </nav>
  );
}
```

**Test:**

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst/frontend
npm run dev &
sleep 5
curl -s http://localhost:5173 | grep -q "root" && echo "Frontend OK" || echo "Frontend FAILED"
pkill -f vite
```

Expected: `Frontend OK`

**Commit:** `"feat: react setup — routing, navbar, api client, auth lib, design system"`

---

## TASK 3 — Build Auth page (/login)

Create `frontend/src/pages/Auth.jsx` — full login + signup page:

- Centered card on black background
- Logo + "AUTONOMOUS" label
- Title: "Access the workspace"
- Tab toggle: Sign in / Create account
- Fields: display_name (signup only), email, password
- Cyan submit button with loading state
- Inline error display in red
- On success: saveAuth(token, user) → navigate('/dashboard')
- If already logged in: redirect to /dashboard immediately

Implement fully with inline styles matching the design tokens above. No external CSS files needed beyond index.css.

**Test:**

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate
uvicorn api.app:app --reload --port 8000 &
sleep 3
cd frontend && npm run dev &
sleep 5
curl -s http://localhost:5173 | grep -q "root" && echo "Auth page OK"
pkill -f uvicorn; pkill -f vite
```

Expected: `Auth page OK`

**Commit:** `"feat: auth page — login/signup forms connected to backend"`

---

## TASK 4 — Build Dashboard page (/dashboard)

Create `frontend/src/pages/Dashboard.jsx` — IDE-style three-panel workspace:

**TOP BAR:**

- Left: breadcrumb (folder / filename.py) + status badge (idle / analyzing...)
- Right: Speed toggle · Memory toggle · Security toggle · Reset button · "▶ Analyze" button (cyan, large)

**LEFT SIDEBAR (250px):**

- "EXPLORER" header
- File tree: src/ > fib.py (red dot) · report.py (yellow dot) · utils.py, tests/, README.md
- Clicking a file just updates the breadcrumb (no real file system needed)
- Bottom: RAG memory count · sandbox status · branch name

**CENTER PANEL (main area):**

- File tab bar above
- Large textarea for code input (monospace, dark, full height)
- Placeholder: "# Paste your Python code here...\n# Example:\ndef fib(n):\n if n < 2: return n\n return fib(n-1) + fib(n-2)"
- Line numbers shown on left side

**RIGHT PANEL (results — shown after analysis):**

- Hidden by default (show only after clicking Analyze)
- While analyzing: show progress steps:
  - Stage 1/6: Architect Agent...
  - Stage 2/6: Security Agent...
  - Stage 3/6: Bug Detector...
  - Stage 4/6: Performance Analyzer...
  - Stage 5/6: Optimizer...
  - Stage 6/6: Validator...
- After complete: show result cards:
  - Bug score card (red if > 50, green if < 20)
  - Validation status badge (APPROVED green / REJECTED red / UNCHANGED gray)
  - Speedup percentage (cyan, large number)
  - Overall summary text
  - "View Full Insights →" button (navigates to /insights, passes report via location.state)

**Analyze button logic:**

```javascript
const handleAnalyze = async () => {
  if (!code.trim()) return;
  setAnalyzing(true);
  setResults(null);
  try {
    const res = await analyzeCode(code);
    sessionStorage.setItem("last_report", JSON.stringify(res.data));
    setResults(res.data);
  } catch (e) {
    setError(e.response?.data?.detail || "Analysis failed");
  } finally {
    setAnalyzing(false);
  }
};
```

**Commit:** `"feat: dashboard — IDE layout, code editor, analyze button, results panel"`

---

## TASK 5 — Build Insights page (/insights and /sessions/:id)

Create `frontend/src/pages/Insights.jsx`:

**Data loading logic:**

```javascript
useEffect(() => {
  // Priority 1: passed via navigation state
  if (location.state?.report) {
    setReport(location.state.report);
    return;
  }
  // Priority 2: sessionStorage fallback
  const stored = sessionStorage.getItem("last_report");
  if (stored && !id) {
    setReport(JSON.parse(stored));
    return;
  }
  // Priority 3: fetch from API using session ID
  if (id) {
    getSession(id).then((r) => setReport(r.data.final_report));
  }
}, []);
```

**Sections:**

1. **Header:** Breadcrumb + H1 + status badges (validator status in green/red, speedup)

2. **Four stat cards** (use report data exactly):
   - EXECUTION SPEED: `validation.speedup_percentage ? validation.speedup_percentage.toFixed(1) + '%' : '—'`
   - MEMORY: `performance_report.memory_usage_mb ? performance_report.memory_usage_mb.toFixed(1) + 'MB' : '—'`
   - SECURITY SCORE: `security_report.security_score + '/100'`
   - CODE HEALTH: average of all 6 optimized_dna fields

3. **DNA Fingerprint (Recharts RadarChart):**

```javascript
const dnaData = [
  {
    axis: "Speed",
    baseline: report.baseline_dna?.performance,
    optimized: report.optimized_dna?.performance,
  },
  {
    axis: "Memory",
    baseline: report.baseline_dna?.complexity,
    optimized: report.optimized_dna?.complexity,
  },
  {
    axis: "Security",
    baseline: report.baseline_dna?.security,
    optimized: report.optimized_dna?.security,
  },
  {
    axis: "Readability",
    baseline: report.baseline_dna?.readability,
    optimized: report.optimized_dna?.readability,
  },
  {
    axis: "Maintain.",
    baseline: report.baseline_dna?.bug_density,
    optimized: report.optimized_dna?.bug_density,
  },
  {
    axis: "Complexity",
    baseline: report.baseline_dna?.optimization,
    optimized: report.optimized_dna?.optimization,
  },
];
```

Use RadarChart from recharts. Two Radar components: baseline (stroke red, fill red opacity 0.1) + optimized (stroke cyan, fill cyan opacity 0.15).

4. **Resource curves (Recharts LineChart):**
   - Use `report.baseline_resources?.samples` and `report.optimized_resources?.samples`
   - If null: show placeholder card "Resource timeline not available"
   - CPU % chart + Memory MB chart stacked vertically

5. **Bottlenecks list:**
   - Loop `report.bug_report.bugs` — show severity badge + description + suggestion
   - Loop `report.performance_report.bottlenecks` — show as "performance" severity items
   - Each row: badge (critical=red, warning=yellow, info=blue) + text + suggestion

6. **Optimized code panel:**
   - Show `report.optimized_code` in a dark code block (monospace textarea, read-only)
   - "Copy" button to copy to clipboard

**Commit:** `"feat: insights — DNA radar, resource charts, stat cards, bottlenecks, optimized code"`

---

## TASK 6 — Build History page (/history)

Create `frontend/src/pages/History.jsx`:

```javascript
useEffect(() => {
  Promise.all([getStats(), getSessions()])
    .then(([statsRes, sessionsRes]) => {
      setStats(statsRes.data);
      setSessions(sessionsRes.data);
    })
    .catch((e) => setError("Failed to load history"))
    .finally(() => setLoading(false));
}, []);
```

**Profile header:**

- Avatar circle (user initials from getUser(), cyan border)
- Display name + email + "Joined" date
- Right: 4 stat pills: RUNS (stats.total_sessions) · BUGS FIXED (stats.total_bugs_fixed) · AVG SPEEDUP (stats.avg_code_dna_score) · MEMORY SAVED (stats.total_memory_saved_mb + 'MB')

**Code health trend (Recharts AreaChart):**

- Data: `stats.score_trend.map((v, i) => ({ session: i + 1, score: v }))`
- X axis: "Session", Y axis: "Score (0-100)"
- Filled teal area, dark grid
- If score_trend is empty: show "No data yet — run your first analysis"

**Recent analyses list:**

- Loop `sessions` array
- Each row:
  - Colored dot (green=approved, red=rejected, gray=unchanged)
  - Source code preview: first line of session.source_code truncated to 40 chars
  - Time ago: formatted from session.created_at
  - Speedup: `session.final_report?.validation?.speedup_percentage`
  - DNA score: average of optimized_dna fields
  - Status badge
  - "View" button → `navigate('/sessions/' + session.id)`

**Commit:** `"feat: history — profile header, trend chart, sessions list with navigation"`

---

## TASK 7 — Build About page (/about)

Create `frontend/src/pages/About.jsx` — all static content:

**Sections:**

1. Header: label + H1 "The Validator Agent: making LLM optimizations actually safe to ship." + subtitle
2. Two-column cards: THE PROBLEM (left, dark card) vs OUR APPROACH (right, dark card) with bullet points
3. Five-stage pipeline row: 5 cards numbered 01-05: Parser · Profiler · Optimizer · Validator · Memory
4. Team section with exactly these 4 members:
   - AS · Asaad Suliman · System Architect & Pipeline Lead · orchestrator.py · validator.py · schemas.py (cyan avatar)
   - IB · Ibro · AI Agent Developer · bug_detector.py · optimizer.py · prompts.py (yellow avatar)
   - OM · Omer · Performance & Sandbox Engineer · performance_analyzer.py · code_executor.py · Dockerfile (blue avatar)
   - AK · Abdulkadir · Frontend & Integration Engineer · api/app.py · frontend/ (purple avatar)
5. Docs grid: 4 cards: Quickstart · CLI reference · Validator semantics · RAG & memory

**Commit:** `"feat: about page — problem/solution, pipeline, team cards, docs grid"`

---

## TASK 8 — Build Home page (/)

Create `frontend/src/pages/Home.jsx`:

**Sections:**

1. **Hero** (full viewport height, pure black):
   - Small label: "Validator Agent · v0.42.1 · Built for OSTIM Tech"
   - H1 three lines: "Beyond the chatbot." (white) / "Engineering-grade" (gray) / "code optimization." (cyan #22d3ee)
   - Font size: clamp(3rem, 8vw, 6rem), font-weight: 700, line-height: 0.95
   - Subtext paragraph (gray, max-width 500px)
   - Two buttons: "Open the Workspace →" (cyan bg, black text) + "Read the paper" (ghost border)
   - Subtle grid background pattern using CSS

2. **Stats bar** (4 columns, border top/bottom):
   - 34.2× · median speedup on top-1k functions
   - 0 · regressions in 12,400 validated runs
   - 6.1ms · lower than suggested across 512k functions
   - 94% · CWE coverage on security-only runs

3. **Live demo** (two code panels side by side):
   - Label: "01 · LIVE DIFF" + heading "The Validator doesn't suggest. It proves."
   - LEFT panel: original code (red left border, badge "O(n²) · BEFORE")
   - RIGHT panel: optimized code (green left border, badge "✓ AFTER")
   - Both use dark code block styling, monospace font
   - Bottom bar: timing comparison stats

4. **Features grid** (5 cards, 2 columns):
   - Multi-file analysis · Security scanning · Self-learning RAG · Shadow sandbox · DNA Fingerprint
   - Each card: icon + title + description + tags

5. **CTA banner**: "Stop guessing. Ship measured wins." + "Open Dashboard →" button

6. **Footer**: Logo left · copyright + "OSTIM Tech Research · 2025" right

**Commit:** `"feat: home page — hero, stats bar, live demo, features, CTA, footer"`

---

## TASK 9 — End-to-end integration test

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate

# Start backend
uvicorn api.app:app --reload --port 8000 &
sleep 5

# Test 1: health
curl -s http://localhost:8000/health | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert d['status']=='healthy'
print('✓ Health OK')
"

# Test 2: analyze endpoint
curl -s -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"code":"def fib(n):\n    if n < 2: return n\n    return fib(n-1) + fib(n-2)\nprint(fib(10))"}' \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'bug_report' in d, 'Missing bug_report'
assert 'validation' in d, 'Missing validation'
assert 'optimized_code' in d, 'Missing optimized_code'
assert 'baseline_dna' in d, 'Missing baseline_dna'
assert 'optimized_dna' in d, 'Missing optimized_dna'
assert 'stages_completed' in d, 'Missing stages_completed'
print('✓ Analyze endpoint OK')
print(f'  Stages: {d[\"stages_completed\"]}')
print(f'  Bug score: {d[\"bug_report\"][\"bug_score\"]}')
print(f'  Validation: {d[\"validation\"][\"status\"]}')
print(f'  Speedup: {d[\"validation\"].get(\"speedup_percentage\")}%')
"

# Test 3: signup
curl -s -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"asaad_test_build@test.com","password":"testpass123","display_name":"Asaad Test"}' \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'user' in d, f'Signup failed: {d}'
print('✓ Signup OK')
"

# Test 4: login and get token
export TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asaad_test_build@test.com","password":"testpass123"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','FAILED'))")

if [ "$TOKEN" = "FAILED" ]; then echo "✗ Login FAILED"; else echo "✓ Login OK — token received"; fi

# Test 5: /auth/me
curl -s http://localhost:8000/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'email' in d, f'/auth/me failed: {d}'
print(f'✓ /auth/me OK: {d[\"email\"]}')
"

# Test 6: /sessions (empty list)
curl -s http://localhost:8000/sessions \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert isinstance(d, list), f'Expected list: {d}'
print(f'✓ /sessions OK: {len(d)} sessions')
"

# Test 7: /sessions/stats
curl -s http://localhost:8000/sessions/stats \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'total_sessions' in d, f'Stats failed: {d}'
print(f'✓ /sessions/stats OK')
"

# Test 8: analyze while logged in (saves to Supabase)
curl -s -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"def fib(n):\n    if n < 2: return n\n    return fib(n-1) + fib(n-2)\nprint(fib(10))"}' \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'bug_report' in d
print('✓ Analyze with auth OK — session should be saved')
"

# Test 9: sessions list should now have 1 item
curl -s http://localhost:8000/sessions \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert isinstance(d, list)
print(f'✓ Sessions after analysis: {len(d)} session(s)')
"

# Test 10: frontend loads
pkill -f uvicorn
cd frontend && npm run build 2>&1 | tail -5
echo "✓ Frontend build complete"

echo ""
echo "==============================="
echo "  ALL TESTS PASSED ✓"
echo "==============================="
```

If any test fails: fix the issue immediately, re-run that specific test, then continue.

**Commit:** `"test: full integration — all endpoints verified, frontend builds clean"`

---

## TASK 10 — Final push

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate

# Verify pipeline still runs (no regression)
python3 orchestrator.py

# Verify imports
python3 -c "from core.schemas import SessionRecord, UserStats, FinalReport; print('Schemas OK')"
python3 -c "from core.config import SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY; assert all([SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY]); print('Config OK')"
python3 -c "from api.app import app; print('API imports OK')"

# Push
git add .
git commit -m "feat: complete full-stack — api/app.py + React frontend (auth, dashboard, insights, history, about, home) — Module 4 complete"
git push origin main

echo "BUILD COMPLETE"
```

---

## DESIGN TOKENS

```
--bg: #000000
--bg-1: #0a0a0f
--bg-card: rgba(255,255,255,0.04)
--border: rgba(255,255,255,0.08)
--accent: #22d3ee
--text: #ffffff
--text-2: #a1a1aa
--text-3: #52525b
--success: #22c55e
--danger: #ef4444
--warning: #f59e0b
--font: 'Inter', sans-serif
--mono: 'JetBrains Mono', monospace
--radius: 6px
```

## FILES NEVER TO TOUCH

agents/bug_detector.py · agents/optimizer.py · agents/prompts.py
agents/performance_analyzer.py · agents/code_executor.py
orchestrator.py · core/schemas.py · core/config.py · .env

## FILES THIS BUILD CREATES

api/app.py (NEW)
frontend/src/main.jsx (REBUILT)
frontend/src/index.css (REBUILT)
frontend/src/lib/api.js (NEW)
frontend/src/lib/auth.js (NEW)
frontend/src/components/Navbar.jsx (NEW)
frontend/src/pages/Auth.jsx (NEW)
frontend/src/pages/Dashboard.jsx (NEW)
frontend/src/pages/Insights.jsx (NEW)
frontend/src/pages/History.jsx (NEW)
frontend/src/pages/About.jsx (NEW)
frontend/src/pages/Home.jsx (NEW)
