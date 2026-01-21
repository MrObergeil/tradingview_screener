import { useCallback } from "react";

/** Market/exchange option */
export interface MarketOption {
  value: string;
  label: string;
  markets: string[];
}

/** Market option group for organized display */
export interface MarketOptionGroup {
  label: string;
  options: MarketOption[];
}

/** Available market options organized by region */
export const MARKET_OPTION_GROUPS: MarketOptionGroup[] = [
  {
    label: "US Markets",
    options: [
      { value: "america", label: "US Stocks (All)", markets: ["america"] },
      { value: "nasdaq", label: "NASDAQ", markets: ["america"] },
      { value: "nyse", label: "NYSE", markets: ["america"] },
      { value: "amex", label: "AMEX", markets: ["america"] },
    ],
  },
  {
    label: "Global",
    options: [
      { value: "crypto", label: "Crypto", markets: ["crypto"] },
      { value: "forex", label: "Forex", markets: ["forex"] },
    ],
  },
  {
    label: "International",
    options: [
      { value: "uk", label: "UK Stocks", markets: ["uk"] },
      { value: "germany", label: "Germany", markets: ["germany"] },
      { value: "india", label: "India", markets: ["india"] },
      { value: "canada", label: "Canada", markets: ["canada"] },
      { value: "australia", label: "Australia", markets: ["australia"] },
    ],
  },
];

/** Flat list of all market options (for backwards compatibility) */
export const MARKET_OPTIONS: MarketOption[] = MARKET_OPTION_GROUPS.flatMap((g) => g.options);

/** Exchange filter values for specific US exchanges */
export const EXCHANGE_FILTERS: Record<string, string[]> = {
  nasdaq: ["NASDAQ"],
  nyse: ["NYSE"],
  amex: ["AMEX"],
};

interface MarketSelectorProps {
  selectedMarket: string;
  onMarketChange: (market: string, markets: string[], exchangeFilter?: string[]) => void;
  disabled?: boolean;
}

/**
 * Market/exchange selector dropdown.
 * Required for market-wide scans.
 */
export default function MarketSelector({
  selectedMarket,
  onMarketChange,
  disabled = false,
}: MarketSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      const option = MARKET_OPTIONS.find((o) => o.value === value);
      if (option) {
        const exchangeFilter = EXCHANGE_FILTERS[value];
        onMarketChange(value, option.markets, exchangeFilter);
      }
    },
    [onMarketChange]
  );

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="market-select" className="text-sm font-medium text-gray-700">
        Market:
      </label>
      <select
        id="market-select"
        value={selectedMarket}
        onChange={handleChange}
        disabled={disabled}
        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm min-w-[180px]"
      >
        {MARKET_OPTION_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/** Get markets array for a market value */
export function getMarketsForValue(value: string): string[] {
  const option = MARKET_OPTIONS.find((o) => o.value === value);
  return option?.markets ?? ["america"];
}

/** Get exchange filter for a market value (if applicable) */
export function getExchangeFilterForValue(value: string): string[] | undefined {
  return EXCHANGE_FILTERS[value];
}
