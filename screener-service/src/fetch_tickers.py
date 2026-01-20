#!/usr/bin/env python3
"""
Fetch all tickers from TradingView and save to JSON file.
Run this daily via cron to keep the ticker list updated.
"""

import json
import time
from pathlib import Path
from datetime import datetime, timezone

from tradingview_screener import Query


# Output file path
DATA_DIR = Path(__file__).parent.parent / "data"
TICKERS_FILE = DATA_DIR / "tickers.json"

# Exchanges to exclude
EXCLUDED_EXCHANGES = {"OTC"}


def fetch_all_tickers() -> list[dict]:
    """
    Fetch all tickers from TradingView API.
    Returns a list of ticker objects with name, description, and exchange.
    """
    print("Fetching tickers from TradingView...")
    start_time = time.perf_counter()

    # Fetch all tickers at once (API supports up to ~20k)
    q = Query().select("name", "description", "exchange", "type").limit(25000)
    total_count, df = q.get_scanner_data()
    print(f"Total available: {total_count}, Fetched: {len(df)}")

    # Filter out excluded exchanges (OTC)
    df = df[~df["exchange"].isin(EXCLUDED_EXCHANGES)]
    print(f"After filtering out {EXCLUDED_EXCHANGES}: {len(df)} tickers")

    # Convert to list of dicts
    tickers = df.to_dict(orient="records")

    duration = time.perf_counter() - start_time
    print(f"Completed in {duration:.1f}s")

    return tickers


def save_tickers(tickers: list[dict]) -> None:
    """Save tickers to JSON file."""
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Build output structure
    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(tickers),
        "tickers": tickers,
    }

    # Write to file
    with open(TICKERS_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Saved {len(tickers)} tickers to {TICKERS_FILE}")


def main():
    """Main entry point."""
    tickers = fetch_all_tickers()
    save_tickers(tickers)
    print("Done!")


if __name__ == "__main__":
    main()
