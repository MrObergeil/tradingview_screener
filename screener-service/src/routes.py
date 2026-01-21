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


class FieldInfo(BaseModel):
    """Field metadata."""

    name: str
    displayName: str
    type: str  # "number", "string", "percent"
    category: str


class FieldsResponse(BaseModel):
    """Fields list response."""

    fields: list[FieldInfo]
    categories: list[str]


# Available fields with metadata
AVAILABLE_FIELDS: list[dict] = [
    # Basic Info
    {"name": "name", "displayName": "Ticker", "type": "string", "category": "Basic"},
    {"name": "description", "displayName": "Name", "type": "string", "category": "Basic"},
    {"name": "sector", "displayName": "Sector", "type": "string", "category": "Basic"},
    {"name": "industry", "displayName": "Industry", "type": "string", "category": "Basic"},
    {"name": "exchange", "displayName": "Exchange", "type": "string", "category": "Basic"},
    {"name": "type", "displayName": "Type", "type": "string", "category": "Basic"},

    # Price
    {"name": "close", "displayName": "Price", "type": "number", "category": "Price"},
    {"name": "open", "displayName": "Open", "type": "number", "category": "Price"},
    {"name": "high", "displayName": "High", "type": "number", "category": "Price"},
    {"name": "low", "displayName": "Low", "type": "number", "category": "Price"},
    {"name": "change", "displayName": "Change % (Today)", "type": "percent", "category": "Price"},
    {"name": "change_abs", "displayName": "Change $ (Today)", "type": "number", "category": "Price"},
    {"name": "premarket_change", "displayName": "Pre-Market Change %", "type": "percent", "category": "Price"},
    {"name": "postmarket_change", "displayName": "Post-Market Change %", "type": "percent", "category": "Price"},
    {"name": "premarket_close", "displayName": "Pre-Market Price", "type": "number", "category": "Price"},
    {"name": "postmarket_close", "displayName": "Post-Market Price", "type": "number", "category": "Price"},

    # Volume (in shares)
    {"name": "volume", "displayName": "Volume Today (shares)", "type": "number", "category": "Volume"},
    {"name": "relative_volume_10d_calc", "displayName": "Relative Volume (x avg)", "type": "number", "category": "Volume"},
    {"name": "average_volume_10d_calc", "displayName": "Avg Volume 10d (shares)", "type": "number", "category": "Volume"},
    {"name": "average_volume_30d_calc", "displayName": "Avg Volume 30d (shares)", "type": "number", "category": "Volume"},
    {"name": "average_volume_60d_calc", "displayName": "Avg Volume 60d (shares)", "type": "number", "category": "Volume"},
    {"name": "average_volume_90d_calc", "displayName": "Avg Volume 90d (shares)", "type": "number", "category": "Volume"},
    {"name": "premarket_volume", "displayName": "Pre-Market Vol (shares)", "type": "number", "category": "Volume"},
    {"name": "postmarket_volume", "displayName": "Post-Market Vol (shares)", "type": "number", "category": "Volume"},

    # Fundamental
    {"name": "market_cap_basic", "displayName": "Market Cap", "type": "number", "category": "Fundamental"},
    {"name": "price_earnings_ttm", "displayName": "P/E Ratio", "type": "number", "category": "Fundamental"},
    {"name": "earnings_per_share_basic_ttm", "displayName": "EPS", "type": "number", "category": "Fundamental"},
    {"name": "dividend_yield_recent", "displayName": "Dividend Yield", "type": "percent", "category": "Fundamental"},
    {"name": "beta_1_year", "displayName": "Beta", "type": "number", "category": "Fundamental"},

    # Technical - Oscillators
    {"name": "RSI", "displayName": "RSI (14)", "type": "number", "category": "Technical"},
    {"name": "RSI7", "displayName": "RSI (7)", "type": "number", "category": "Technical"},
    {"name": "MACD.macd", "displayName": "MACD", "type": "number", "category": "Technical"},
    {"name": "Stoch.K", "displayName": "Stochastic %K", "type": "number", "category": "Technical"},
    {"name": "ATR", "displayName": "ATR", "type": "number", "category": "Technical"},
    {"name": "ADR", "displayName": "ADR (Avg Daily Range)", "type": "number", "category": "Technical"},
    {"name": "Volatility.D", "displayName": "Volatility", "type": "percent", "category": "Technical"},

    # Technical - Moving Averages
    {"name": "SMA20", "displayName": "SMA 20", "type": "number", "category": "Moving Averages"},
    {"name": "SMA50", "displayName": "SMA 50", "type": "number", "category": "Moving Averages"},
    {"name": "SMA200", "displayName": "SMA 200", "type": "number", "category": "Moving Averages"},
    {"name": "EMA20", "displayName": "EMA 20", "type": "number", "category": "Moving Averages"},
    {"name": "EMA50", "displayName": "EMA 50", "type": "number", "category": "Moving Averages"},

    # Performance
    {"name": "Perf.W", "displayName": "Change % (Week)", "type": "percent", "category": "Performance"},
    {"name": "Perf.1M", "displayName": "Change % (Month)", "type": "percent", "category": "Performance"},
    {"name": "Perf.3M", "displayName": "Change % (3 Months)", "type": "percent", "category": "Performance"},
    {"name": "Perf.6M", "displayName": "Change % (6 Months)", "type": "percent", "category": "Performance"},
    {"name": "Perf.Y", "displayName": "Change % (Year)", "type": "percent", "category": "Performance"},
    {"name": "Perf.YTD", "displayName": "Change % (YTD)", "type": "percent", "category": "Performance"},
]

FIELD_CATEGORIES = ["Basic", "Price", "Volume", "Fundamental", "Technical", "Moving Averages", "Performance"]


@router.get("/fields", response_model=FieldsResponse)
async def get_fields() -> FieldsResponse:
    """
    Get list of available fields with metadata.
    Used for column selection in the UI.
    """
    fields = [FieldInfo(**f) for f in AVAILABLE_FIELDS]
    return FieldsResponse(fields=fields, categories=FIELD_CATEGORIES)


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
