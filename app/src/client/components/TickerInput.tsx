import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { searchTickers, type TickerResult } from "../lib/client";

interface TickerInputProps {
  onScan: (tickers: string[]) => void;
  isLoading?: boolean;
}

/**
 * Input component for entering comma-separated ticker symbols with autocomplete.
 */
export default function TickerInput({ onScan, isLoading = false }: TickerInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<TickerResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the current word being typed (after the last comma)
  const getCurrentWord = useCallback(() => {
    const parts = inputValue.split(",");
    const lastPart = parts[parts.length - 1] ?? "";
    return lastPart.trim().toUpperCase();
  }, [inputValue]);

  // Fetch suggestions when current word changes
  useEffect(() => {
    const currentWord = getCurrentWord();

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't search if word is too short
    if (currentWord.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce the search
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await searchTickers(currentWord, 8);
        setSuggestions(response.results);
        setShowSuggestions(response.results.length > 0);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [getCurrentWord]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleSelectSuggestion = useCallback(
    (ticker: string) => {
      // Replace the current word with the selected ticker
      const parts = inputValue.split(",");
      parts[parts.length - 1] = " " + ticker;
      setInputValue(parts.join(",") + ", ");
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    },
    [inputValue]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          handleSelectSuggestion(selected.name);
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    },
    [showSuggestions, suggestions, selectedIndex, handleSelectSuggestion]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const tickers = parseTickers(inputValue);
      if (tickers.length > 0) {
        setShowSuggestions(false);
        onScan(tickers);
      }
    },
    [inputValue, onScan]
  );

  const handleBlur = useCallback(() => {
    // Delay hiding to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0 && getCurrentWord().length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length, getCurrentWord]);

  const tickers = parseTickers(inputValue);
  const isDisabled = tickers.length === 0 || isLoading;

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="Enter tickers (e.g., AAPL, MSFT, GOOGL)"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          disabled={isLoading}
          aria-label="Ticker symbols"
          autoComplete="off"
        />

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.name}
                className={`px-4 py-2 cursor-pointer flex justify-between items-center ${
                  index === selectedIndex
                    ? "bg-blue-100"
                    : "hover:bg-gray-100"
                }`}
                onMouseDown={() => handleSelectSuggestion(suggestion.name)}
              >
                <div>
                  <span className="font-medium">{suggestion.name}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    {suggestion.description}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{suggestion.exchange}</span>
              </li>
            ))}
          </ul>
        )}

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
