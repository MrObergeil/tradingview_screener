"""
Wrapper for the tradingview-screener library.
Translates our API format to library calls.
"""

import time
from typing import Any

from tradingview_screener import Query, Column, And

from models import ScanRequest, ScanResponse, Filter


class ScreenerService:
    """Service class for executing TradingView screener queries."""

    def scan(self, request: ScanRequest) -> ScanResponse:
        """
        Execute a screener scan based on the request parameters.

        Args:
            request: ScanRequest with columns, filters, ordering, etc.

        Returns:
            ScanResponse with results and metadata.
        """
        start_time = time.perf_counter()

        # Build query
        query = Query()

        # Set market
        if request.markets:
            query = query.set_markets(*request.markets)

        # Select columns - always include 'name' for ticker identification
        columns_to_select = list(request.columns)
        if "name" not in columns_to_select:
            columns_to_select.insert(0, "name")

        query = query.select(*columns_to_select)

        # Apply filters using where2 with And for proper combination
        if request.filters:
            conditions = [self._build_condition(f) for f in request.filters]
            if len(conditions) == 1:
                query = query.where(conditions[0])
            else:
                query = query.where2(And(*conditions))

        # Apply ordering
        if request.order_by:
            ascending = request.order_by.direction == "asc"
            query = query.order_by(request.order_by.field, ascending=ascending)

        # Apply limit and offset
        query = query.limit(request.limit)
        if request.offset > 0:
            query = query.offset(request.offset)

        # Execute query
        count, df = query.get_scanner_data()

        # Convert DataFrame to list of dicts
        results = df.to_dict(orient="records") if not df.empty else []

        # Calculate duration
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        return ScanResponse.create(
            results=results,
            total_count=count,
            duration_ms=duration_ms,
        )

    def _build_condition(self, filter_item: Filter) -> dict:
        """
        Build a condition dict from a filter.

        Uses Python comparison operators for gt, gte, lt, lte, eq, neq.
        Uses Column methods for between, not_between, isin, not_in.

        Args:
            filter_item: Filter to convert to condition

        Returns:
            Condition dict for use with where/where2
        """
        col = Column(filter_item.field)
        op = filter_item.op
        value = filter_item.value

        # Build condition based on operator
        if op == "gt":
            return col > value
        elif op == "gte":
            return col >= value
        elif op == "lt":
            return col < value
        elif op == "lte":
            return col <= value
        elif op == "eq":
            return col == value
        elif op == "neq":
            return col != value
        elif op == "between":
            if not isinstance(value, list) or len(value) != 2:
                raise ValueError(f"Operator 'between' requires a list of exactly 2 values")
            return col.between(value[0], value[1])
        elif op == "not_between":
            if not isinstance(value, list) or len(value) != 2:
                raise ValueError(f"Operator 'not_between' requires a list of exactly 2 values")
            return col.not_between(value[0], value[1])
        elif op == "in":
            if not isinstance(value, list):
                raise ValueError(f"Operator 'in' requires a list of values")
            return col.isin(value)
        elif op == "not_in":
            if not isinstance(value, list):
                raise ValueError(f"Operator 'not_in' requires a list of values")
            return col.not_in(value)
        else:
            raise ValueError(f"Unknown filter operator: {op}")


# Singleton instance
screener_service = ScreenerService()
