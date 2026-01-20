import { useState, useCallback, type FormEvent, type ChangeEvent } from "react";

interface TickerInputProps {
  onScan: (tickers: string[]) => void;
  isLoading?: boolean;
}

/**
 * Input component for entering comma-separated ticker symbols.
 */
export default function TickerInput({ onScan, isLoading = false }: TickerInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const tickers = parseTickers(inputValue);
      if (tickers.length > 0) {
        onScan(tickers);
      }
    },
    [inputValue, onScan]
  );

  const tickers = parseTickers(inputValue);
  const isDisabled = tickers.length === 0 || isLoading;

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="flex-1">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          placeholder="Enter tickers (e.g., AAPL, MSFT, GOOGL)"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          disabled={isLoading}
          aria-label="Ticker symbols"
        />
        {inputValue && tickers.length > 0 && (
          <p className="mt-1 text-sm text-gray-500">
            {tickers.length} ticker{tickers.length !== 1 ? "s" : ""}: {tickers.join(", ")}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isDisabled}
        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Scanning..." : "Scan"}
      </button>
    </form>
  );
}

/**
 * Parse comma-separated tickers into an array.
 * Removes whitespace, converts to uppercase, and filters empty strings.
 */
function parseTickers(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
}
