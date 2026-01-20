import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ResultsTable, type StockResult } from "../../src/client/components/ResultsTable";

describe("ResultsTable", () => {
  afterEach(() => {
    cleanup();
  });

  const mockResults: StockResult[] = [
    {
      name: "NASDAQ:AAPL",
      close: 185.92,
      change: 2.34,
      change_abs: 4.25,
      volume: 52_000_000,
      market_cap_basic: 2_850_000_000_000,
    },
    {
      name: "NASDAQ:MSFT",
      close: 378.91,
      change: -1.15,
      change_abs: -4.42,
      volume: 18_500_000,
      market_cap_basic: 2_810_000_000_000,
    },
    {
      name: "NASDAQ:GOOGL",
      close: 141.80,
      change: 0,
      change_abs: 0,
      volume: 25_000_000,
      market_cap_basic: 1_780_000_000_000,
    },
  ];

  describe("empty state", () => {
    it("should show empty state when no results", () => {
      render(<ResultsTable results={[]} />);
      expect(screen.getByText("No results")).toBeDefined();
      expect(screen.getByText(/Enter tickers above/i)).toBeDefined();
    });

    it("should not show empty state when loading", () => {
      render(<ResultsTable results={[]} isLoading={true} />);
      expect(screen.queryByText("No results")).toBeNull();
    });
  });

  describe("table rendering", () => {
    it("should render table headers", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("Ticker")).toBeDefined();
      expect(screen.getByText("Price")).toBeDefined();
      expect(screen.getByText("Change %")).toBeDefined();
      expect(screen.getByText("Change")).toBeDefined();
      expect(screen.getByText("Volume")).toBeDefined();
      expect(screen.getByText("Market Cap")).toBeDefined();
    });

    it("should render all result rows", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("NASDAQ:AAPL")).toBeDefined();
      expect(screen.getByText("NASDAQ:MSFT")).toBeDefined();
      expect(screen.getByText("NASDAQ:GOOGL")).toBeDefined();
    });
  });

  describe("number formatting", () => {
    it("should format price with 2 decimals", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("185.92")).toBeDefined();
      expect(screen.getByText("378.91")).toBeDefined();
    });

    it("should format positive change with + sign", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("+2.34%")).toBeDefined();
    });

    it("should format negative change with - sign", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("-1.15%")).toBeDefined();
    });

    it("should format volume with M suffix", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("52.00M")).toBeDefined();
      expect(screen.getByText("18.50M")).toBeDefined();
    });

    it("should format market cap with T/B suffix", () => {
      render(<ResultsTable results={mockResults} />);
      expect(screen.getByText("$2.85T")).toBeDefined();
      expect(screen.getByText("$1.78T")).toBeDefined();
    });
  });

  describe("null value handling", () => {
    it("should display dash for null values", () => {
      const resultsWithNulls: StockResult[] = [
        {
          name: "NASDAQ:TEST",
          close: null,
          change: null,
          volume: null,
          market_cap_basic: null,
        },
      ];
      render(<ResultsTable results={resultsWithNulls} />);
      // Count dashes - should be 5 (close, change, change_abs, volume, market_cap)
      const dashes = screen.getAllByText("-");
      expect(dashes.length).toBe(5);
    });
  });

  describe("color coding", () => {
    it("should apply green color for positive change", () => {
      render(<ResultsTable results={mockResults} />);
      const positiveChange = screen.getByText("+2.34%");
      expect(positiveChange.className).toContain("text-green-600");
    });

    it("should apply red color for negative change", () => {
      render(<ResultsTable results={mockResults} />);
      const negativeChange = screen.getByText("-1.15%");
      expect(negativeChange.className).toContain("text-red-600");
    });

    it("should apply gray color for zero change", () => {
      render(<ResultsTable results={mockResults} />);
      const zeroChange = screen.getByText("+0.00%");
      expect(zeroChange.className).toContain("text-gray-500");
    });
  });

  describe("sorting", () => {
    it("should show sort indicators on headers", () => {
      render(<ResultsTable results={mockResults} />);
      // Initially no active sort, should show inactive indicators
      const sortIndicators = screen.getAllByText("⇅");
      expect(sortIndicators.length).toBeGreaterThan(0);
    });

    it("should sort by column when header clicked", () => {
      render(<ResultsTable results={mockResults} />);

      // Click on Price header to sort
      const priceHeader = screen.getByText("Price");
      fireEvent.click(priceHeader);

      // Get all rows - they should now be sorted by price descending
      const rows = screen.getAllByRole("row");
      // First row is header, data rows start at index 1
      // MSFT (378.91) should be first, then AAPL (185.92), then GOOGL (141.80)
      expect(rows[1]?.textContent).toContain("NASDAQ:MSFT");
      expect(rows[2]?.textContent).toContain("NASDAQ:AAPL");
      expect(rows[3]?.textContent).toContain("NASDAQ:GOOGL");
    });

    it("should reverse sort on second click", () => {
      render(<ResultsTable results={mockResults} />);

      const priceHeader = screen.getByText("Price");

      // First click - descending
      fireEvent.click(priceHeader);

      // Second click - ascending
      fireEvent.click(priceHeader);

      const rows = screen.getAllByRole("row");
      // Should now be ascending: GOOGL, AAPL, MSFT
      expect(rows[1]?.textContent).toContain("NASDAQ:GOOGL");
      expect(rows[2]?.textContent).toContain("NASDAQ:AAPL");
      expect(rows[3]?.textContent).toContain("NASDAQ:MSFT");
    });

    it("should show active sort indicator", () => {
      render(<ResultsTable results={mockResults} />);

      const priceHeader = screen.getByText("Price");
      fireEvent.click(priceHeader);

      // Should show descending indicator
      expect(screen.getByText("↓")).toBeDefined();
    });

    it("should show ascending indicator after double click", () => {
      render(<ResultsTable results={mockResults} />);

      const priceHeader = screen.getByText("Price");
      fireEvent.click(priceHeader);
      fireEvent.click(priceHeader);

      // Should show ascending indicator
      expect(screen.getByText("↑")).toBeDefined();
    });
  });
});
