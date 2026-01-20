"""
Tests for the /scan endpoint.
Uses real TradingView API calls.
"""

import pytest
from httpx import AsyncClient, ASGITransport

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_scan_basic_columns():
    """Test basic scan with simple columns."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "close", "volume"],
                "limit": 5
            }
        )

    assert response.status_code == 200
    data = response.json()

    assert "totalCount" in data
    assert "results" in data
    assert "timestamp" in data
    assert "durationMs" in data

    assert data["totalCount"] > 0
    assert len(data["results"]) == 5

    # Check that results have the requested columns
    first_result = data["results"][0]
    assert "name" in first_result
    assert "close" in first_result
    assert "volume" in first_result


@pytest.mark.anyio
async def test_scan_with_filter_gt():
    """Test scan with greater-than filter."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "close", "volume", "market_cap_basic"],
                "filters": [
                    {"field": "market_cap_basic", "op": "gt", "value": 100000000000}  # > 100B
                ],
                "limit": 10
            }
        )

    assert response.status_code == 200
    data = response.json()

    # All results should have market cap > 100B
    for result in data["results"]:
        if result.get("market_cap_basic"):  # Skip if null
            assert result["market_cap_basic"] > 100000000000


@pytest.mark.anyio
async def test_scan_with_filter_between():
    """Test scan with between filter."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "close"],
                "filters": [
                    {"field": "close", "op": "between", "value": [50, 100]}
                ],
                "limit": 10
            }
        )

    assert response.status_code == 200
    data = response.json()

    # All results should have close price between 50 and 100
    for result in data["results"]:
        close = result.get("close")
        if close:
            assert 50 <= close <= 100


@pytest.mark.anyio
async def test_scan_with_ordering():
    """Test scan with ordering."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "volume"],
                "orderBy": {"field": "volume", "direction": "desc"},
                "limit": 10
            }
        )

    assert response.status_code == 200
    data = response.json()

    # Results should be ordered by volume descending
    volumes = [r["volume"] for r in data["results"] if r.get("volume")]
    assert volumes == sorted(volumes, reverse=True)


@pytest.mark.anyio
async def test_scan_with_multiple_filters():
    """Test scan with multiple filters."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "close", "volume", "market_cap_basic"],
                "filters": [
                    {"field": "close", "op": "gt", "value": 10},
                    {"field": "close", "op": "lt", "value": 500},
                    {"field": "volume", "op": "gt", "value": 1000000}
                ],
                "limit": 10
            }
        )

    assert response.status_code == 200
    data = response.json()

    # All filters should be applied
    for result in data["results"]:
        close = result.get("close")
        volume = result.get("volume")
        if close and volume:
            assert 10 < close < 500
            assert volume > 1000000


@pytest.mark.anyio
async def test_scan_empty_columns_rejected():
    """Test that empty columns list is rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": [],
                "limit": 5
            }
        )

    assert response.status_code == 422  # Validation error


@pytest.mark.anyio
async def test_scan_invalid_between_value():
    """Test that invalid between value is rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "close"],
                "filters": [
                    {"field": "close", "op": "between", "value": 50}  # Should be list
                ],
                "limit": 5
            }
        )

    assert response.status_code == 400  # Bad request


@pytest.mark.anyio
async def test_scan_response_timing():
    """Test that scan response includes timing information."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/scan",
            json={
                "columns": ["name", "close"],
                "limit": 5
            }
        )

    assert response.status_code == 200
    data = response.json()

    # Duration should be reasonable (less than 30 seconds)
    assert data["durationMs"] > 0
    assert data["durationMs"] < 30000
