"""
Configuration
=============
Author: Asaad

Loads all settings from .env file. Every module imports from here.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ─── API Keys ────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── Database ────────────────────────────────────────────

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./datasets/chroma_db")

# ─── Server ──────────────────────────────────────────────

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ─── Sandbox Settings ────────────────────────────────────

SANDBOX_TIMEOUT_SECONDS = int(os.getenv("SANDBOX_TIMEOUT", "10"))
SANDBOX_MEMORY_LIMIT_MB = int(os.getenv("SANDBOX_MEMORY_LIMIT", "128"))

# ─── Supabase ────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# ─── Validation ──────────────────────────────────────────

if not GEMINI_API_KEY:
    print("⚠️  WARNING: GEMINI_API_KEY not set. Agents will fail.")
