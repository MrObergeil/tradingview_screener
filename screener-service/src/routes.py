"""
API routes for the screener service.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from models import ScanRequest, ScanResponse
from screener import screener_service


router = APIRouter()

# Ticker data cache
_tickers_cache: Optional[list[dict]] = None
TICKERS_FILE = Path(__file__).parent.parent / "data" / "tickers.json"


def _load_tickers() -> list[dict]:
    """Load tickers from JSON file (cached)."""
    global _tickers_cache
    if _tickers_cache is None:
        if not TICKERS_FILE.exists():
            return []
        with open(TICKERS_FILE) as f:
            data = json.load(f)
            _tickers_cache = data.get("tickers", [])
    return _tickers_cache


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.
    Returns current status and timestamp.
    """
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


class TickerResult(BaseModel):
    """Ticker search result."""

    name: str
    description: str
    exchange: str
    type: str


class TickerSearchResponse(BaseModel):
    """Ticker search response."""

    results: list[TickerResult]
    count: int


@router.get("/tickers/search", response_model=TickerSearchResponse)
async def search_tickers(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results to return"),
) -> TickerSearchResponse:
    """
    Search for tickers by name or description.
    Used for autocomplete functionality.
    """
    tickers = _load_tickers()
    query = q.upper()

    # Search by name (exact prefix match first) then description
    results = []
    seen = set()

    # First pass: exact prefix match on name
    for t in tickers:
        if t["name"].upper().startswith(query):
            if t["name"] not in seen:
                results.append(TickerResult(
                    name=t["name"],
                    description=t["description"],
                    exchange=t["exchange"],
                    type=t["type"],
                ))
                seen.add(t["name"])
                if len(results) >= limit:
                    break

    # Second pass: contains match on name or description (if not enough results)
    if len(results) < limit:
        for t in tickers:
            if t["name"] in seen:
                continue
            if query in t["name"].upper() or query in t["description"].upper():
                results.append(TickerResult(
                    name=t["name"],
                    description=t["description"],
                    exchange=t["exchange"],
                    type=t["type"],
                ))
                seen.add(t["name"])
                if len(results) >= limit:
                    break

    return TickerSearchResponse(results=results, count=len(results))


@router.post("/scan", response_model=ScanResponse)
async def scan(request: ScanRequest) -> ScanResponse:
    """
    Execute a screener scan against TradingView.

    Args:
        request: Scan parameters including columns, filters, and sorting.

    Returns:
        ScanResponse with matching stocks and metadata.
    """
    try:
        return screener_service.scan(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")
