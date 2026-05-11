"""
Entry Point
===========
Run the FastAPI server with settings from core/config.py (.env).

Usage:
    python main.py
"""

import uvicorn
from core.config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run("api.app:app", host=HOST, port=PORT, reload=True)
