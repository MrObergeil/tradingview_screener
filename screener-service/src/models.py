"""
Pydantic models for API request/response schemas.
"""

from datetime import datetime, timezone
from typing import Literal, Any
from pydantic import BaseModel, Field


# Filter operators supported by tradingview-screener
FilterOperator = Literal["gt", "gte", "lt", "lte", "eq", "neq", "between", "not_between", "in", "not_in"]
SortDirection = Literal["asc", "desc"]


class Filter(BaseModel):
    """Single filter condition."""

    field: str = Field(..., description="Field name to filter on")
    op: FilterOperator = Field(..., description="Filter operator")
    value: int | float | str | list[int | float] | list[str] = Field(
        ...,
        description="Filter value (single value, or list for between/in operators)"
    )


class OrderBy(BaseModel):
    """Sort configuration."""

    field: str = Field(..., description="Field name to sort by")
    direction: SortDirection = Field(default="desc", description="Sort direction")


class ScanRequest(BaseModel):
    """Request body for /scan endpoint."""

    markets: list[str] = Field(
        default=["america"],
        description="Markets to scan (default: america)"
    )
    columns: list[str] = Field(
        ...,
        description="Fields/columns to retrieve",
        min_length=1
    )
    filters: list[Filter] | None = Field(
        default=None,
        description="Optional list of filter conditions"
    )
    order_by: OrderBy | None = Field(
        default=None,
        alias="orderBy",
        description="Optional sort configuration"
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=1000,
        description="Maximum results to return (1-1000)"
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Offset for pagination"
    )

    model_config = {
        "populate_by_name": True,  # Allow both order_by and orderBy
    }


class ScanResponse(BaseModel):
    """Response body for /scan endpoint."""

    total_count: int = Field(
        ...,
        alias="totalCount",
        description="Total number of results matching query"
    )
    results: list[dict[str, Any]] = Field(
        ...,
        description="List of stock data dictionaries"
    )
    timestamp: str = Field(
        ...,
        description="ISO timestamp of when scan was executed"
    )
    duration_ms: int = Field(
        ...,
        alias="durationMs",
        description="Scan duration in milliseconds"
    )

    model_config = {
        "populate_by_name": True,
    }

    @classmethod
    def create(
        cls,
        results: list[dict[str, Any]],
        total_count: int,
        duration_ms: int
    ) -> "ScanResponse":
        """Factory method to create response with current timestamp."""
        return cls(
            total_count=total_count,
            results=results,
            timestamp=datetime.now(timezone.utc).isoformat(),
            duration_ms=duration_ms,
        )
