"""
API Layer — FastAPI Backend
============================
Author: Asaad (System Architect)
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import asyncio
from collections import Counter

from supabase import create_client, Client
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
from core.schemas import FinalReport, UserStats
from orchestrator import Orchestrator

app = FastAPI(title="AI Code Analyst API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_SESSION_LIST_LIMIT = 50
_MEM_SAVING_FRACTION = 0.3

# Strip any path suffix (e.g. /rest/v1/) — SDK needs bare project URL
_base_url = SUPABASE_URL.split("/rest/")[0].split("/auth/")[0].rstrip("/") if SUPABASE_URL else ""
supabase: Client = create_client(_base_url, SUPABASE_ANON_KEY)
_orchestrator = Orchestrator()

class AnalyzeRequest(BaseModel):
    source_code: str
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
        msg = getattr(e, "message", None) or str(e)
        raise HTTPException(status_code=400, detail=msg)

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
        msg = getattr(e, "message", None) or str(e)
        raise HTTPException(status_code=401, detail=msg)

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
    if not req.source_code or not req.source_code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    if len(req.source_code) > 500_000:
        raise HTTPException(status_code=400, detail="Code exceeds 500KB limit")
    user = get_current_user(authorization)
    user_id = user.id if user else None
    try:
        report: FinalReport = _orchestrator.run(
            source_code=req.source_code,
            description=req.description,
            user_id=user_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")
    if user_id and authorization:
        try:
            token = authorization.split(" ")[1]
            supabase.postgrest.auth(token)
            supabase.table("sessions").insert({
                "user_id": user_id,
                "source_code": req.source_code,
                "final_report": json.loads(report.model_dump_json()),
            }).execute()
            supabase.postgrest.auth(SUPABASE_ANON_KEY)
        except Exception as e:
            print(f"[API] Failed to save session: {e}")
    return report

@app.post("/analyze/stream")
async def analyze_stream(req: AnalyzeRequest, authorization: Optional[str] = Header(None)):
    if not req.source_code or not req.source_code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    if len(req.source_code) > 500_000:
        raise HTTPException(status_code=400, detail="Code exceeds 500KB limit")
    user = get_current_user(authorization)
    user_id = user.id if user else None
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def run_pipeline():
        def on_stage(stage, data):
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "stage", "stage": stage, "data": data}), loop
            )
        try:
            report = _orchestrator.run(
                source_code=req.source_code,
                description=req.description,
                user_id=user_id,
                on_stage=on_stage,
            )
            report_dict = json.loads(report.model_dump_json())
            if user_id and authorization:
                try:
                    token = authorization.split(" ")[1]
                    supabase.postgrest.auth(token)
                    supabase.table("sessions").insert({
                        "user_id": user_id,
                        "source_code": req.source_code,
                        "final_report": report_dict,
                    }).execute()
                    supabase.postgrest.auth(SUPABASE_ANON_KEY)
                except Exception as e:
                    print(f"[API] Failed to save session: {e}")
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "complete", "data": report_dict}), loop
            )
        except Exception as e:
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "error", "error": str(e)}), loop
            )

    async def generate():
        loop.run_in_executor(None, run_pipeline)
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=300)
            except asyncio.TimeoutError:
                yield "data: {\"type\":\"error\",\"error\":\"Pipeline timed out\"}\n\n"
                break
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] in ("complete", "error"):
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.get("/sessions")
def get_sessions(authorization: Optional[str] = Header(None), user=Depends(require_auth)):
    try:
        if authorization:
            supabase.postgrest.auth(authorization.split(" ")[1])
        res = supabase.table("sessions") \
            .select("id, created_at, source_code, final_report") \
            .eq("user_id", user.id) \
            .order("created_at", desc=True) \
            .limit(_SESSION_LIST_LIMIT) \
            .execute()
        supabase.postgrest.auth(SUPABASE_ANON_KEY)
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/stats")
def get_stats(authorization: Optional[str] = Header(None), user=Depends(require_auth)):
    try:
        if authorization:
            supabase.postgrest.auth(authorization.split(" ")[1])
        res = supabase.table("sessions") \
            .select("final_report, created_at") \
            .eq("user_id", user.id) \
            .order("created_at", desc=True) \
            .execute()
        supabase.postgrest.auth(SUPABASE_ANON_KEY)
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
                total_memory_saved += orig_mem * _MEM_SAVING_FRACTION
            for bug in bug_report.get("bugs", []):
                if bug.get("category"):
                    bug_types.append(bug["category"])
            optimized_dna = r.get("optimized_dna", {})
            if optimized_dna:
                scores = [optimized_dna.get(k, 0) for k in ["complexity","security","performance","readability","bug_density","optimization"]]
                dna_scores.append(sum(scores) / len(scores))
        most_common = Counter(bug_types).most_common(1)[0][0] if bug_types else None
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
def get_session(session_id: str, authorization: Optional[str] = Header(None), user=Depends(require_auth)):
    try:
        if authorization:
            supabase.postgrest.auth(authorization.split(" ")[1])
        res = supabase.table("sessions") \
            .select("*") \
            .eq("id", session_id) \
            .eq("user_id", user.id) \
            .limit(1) \
            .execute()
        supabase.postgrest.auth(SUPABASE_ANON_KEY)
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
