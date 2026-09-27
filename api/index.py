"""
Vercel serverless entry point — exposes the FastAPI app from backend/.
All /api/* requests are rewritten here (see vercel.json).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from main import app  # noqa: E402,F401
