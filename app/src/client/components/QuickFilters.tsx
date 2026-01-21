import type { Filter } from "../lib/client";

/** Quick filter preset definition */
export interface QuickFilterPreset {
  id: string;
  label: string;
  description: string;
  filters: Filter[];
}

/** Available quick filter presets */
export const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    id: "up-5",
    label: "Up >5%",
    description: "Stocks up more than 5% today",
    filters: [{ field: "change", op: "gt", value: 5 }],
  },
  {
    id: "down-5",
    label: "Down >5%",
    description: "Stocks down more than 5% today",
    filters: [{ field: "change", op: "lt", value: -5 }],
  },
  {
    id: "high-volume",
    label: "High Volume",
    description: "Stocks with volume above 10M",
    filters: [{ field: "volume", op: "gt", value: 10000000 }],
  },
  {
    id: "under-10",
    label: "Under $10",
    description: "Stocks priced under $10",
    filters: [{ field: "close", op: "lt", value: 10 }],
  },
  {
    id: "large-cap",
    label: "Large Cap",
    description: "Market cap over $10B",
    filters: [{ field: "market_cap_basic", op: "gt", value: 10000000000 }],
  },
  {
    id: "tech-sector",
    label: "Tech Sector",
    description: "Technology sector stocks",
    filters: [{ field: "sector", op: "in", value: ["Technology"] }],
  },
  {
    id: "large-cap-tech",
    label: "Large Cap Tech",
    description: "Large cap technology stocks",
    filters: [
      { field: "market_cap_basic", op: "gt", value: 10000000000 },
      { field: "sector", op: "in", value: ["Technology"] },
    ],
  },
  {
    id: "penny-stocks",
    label: "Penny Stocks",
    description: "Stocks under $5",
    filters: [{ field: "close", op: "lt", value: 5 }],
  },
];

interface QuickFiltersProps {
  onApplyPreset: (filters: Filter[]) => void;
  disabled?: boolean;
}

/**
 * Quick filter preset buttons.
 * One-click filters that add predefined filter sets.
 */
export default function QuickFilters({
  onApplyPreset,
  disabled = false,
}: QuickFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-600">Quick Filters:</div>
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.filters)}
            disabled={disabled}
            title={preset.description}
            className="px-3 py-1.5 text-sm font-medium rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
