import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFields } from "../hooks/useFields";
import type { Filter, FilterOperator, FieldInfo } from "../lib/client";

/** Operators available for numeric fields */
const NUMERIC_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "gte", label: ">=" },
  { value: "gt", label: ">" },
  { value: "lte", label: "<=" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
  { value: "between", label: "Between" },
];

const STRING_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "in", label: "Is" },
  { value: "not_in", label: "Is not" },
];

/** Predefined sector values */
const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Basic Materials",
  "Real Estate",
  "Utilities",
  "Communication Services",
];

/** Common industry values */
const INDUSTRIES = [
  "Software",
  "Semiconductors",
  "Internet Content & Information",
  "Computer Hardware",
  "Biotechnology",
  "Drug Manufacturers",
  "Banks",
  "Insurance",
  "Capital Markets",
  "Retail",
  "Auto Manufacturers",
  "Aerospace & Defense",
  "Oil & Gas",
  "Renewable Energy",
];

/** Exchange values */
const EXCHANGES = [
  "NASDAQ",
  "NYSE",
  "AMEX",
  "OTC",
];

/** Default filters to show (like TradingView) */
const DEFAULT_FILTER_FIELDS = [
  "close",      // Price
  "change",     // Change % (Today)
  "volume",     // Volume
  "market_cap_basic", // Market Cap
];

interface FilterBuilderProps {
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
  isLoading?: boolean;
}

/** Check if a field should display large number formatting */
function isLargeNumberField(fieldInfo?: FieldInfo): boolean {
  return fieldInfo?.name === "market_cap_basic" ||
    fieldInfo?.name?.includes("market_cap") ||
    fieldInfo?.name?.includes("volume") ||
    fieldInfo?.name === "volume";
}

/** Format a large number with K/M/B/T suffix */
function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

/** Parse a number string that may contain K/M/B/T suffix */
function parseNumberWithSuffix(value: string): number {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return 0;

  // Check for suffix
  const match = trimmed.match(/^([\d.]+)\s*([KMBT])?$/);
  if (!match) {
    // Try parsing as regular number
    const num = parseFloat(trimmed);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(match[1] ?? "0");
  const suffix = match[2];

  if (isNaN(num)) return 0;

  switch (suffix) {
    case "K": return num * 1e3;
    case "M": return num * 1e6;
    case "B": return num * 1e9;
    case "T": return num * 1e12;
    default: return num;
  }
}

/** Format a filter value for display in pill */
function formatFilterValue(filter: Filter, fieldInfo?: FieldInfo): string {
  const { op, value } = filter;

  if (op === "between" && Array.isArray(value)) {
    if (isLargeNumberField(fieldInfo)) {
      return `${formatLargeNumber(value[0] as number)} - ${formatLargeNumber(value[1] as number)}`;
    }
    return `${value[0]} - ${value[1]}`;
  }

  if (op === "in" || op === "not_in") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "Any";
      if (value.length === 1) return String(value[0]);
      return `${value.length} selected`;
    }
    return String(value);
  }

  const opSymbol = op === "gte" ? "≥" : op === "gt" ? ">" : op === "lte" ? "≤" : op === "lt" ? "<" : op === "eq" ? "=" : "";

  // Format numbers nicely
  let displayValue = String(value);
  if (typeof value === "number") {
    if (isLargeNumberField(fieldInfo)) {
      displayValue = formatLargeNumber(value);
    } else if (fieldInfo?.type === "percent") {
      displayValue = `${value}%`;
    }
  }

  return `${opSymbol} ${displayValue}`;
}

/**
 * TradingView-style pill-based filter builder.
 */
export default function FilterBuilder({
  filters,
  onFiltersChange,
  isLoading = false,
}: FilterBuilderProps) {
  // Use shared fields hook (cached across components)
  const { fields, categories, isLoading: isFieldsLoading } = useFields();

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const addFilterRef = useRef<HTMLDivElement>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popup on click outside - use refs to avoid re-registering listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Close add filter dropdown if clicking outside
      if (addFilterRef.current && !addFilterRef.current.contains(target)) {
        setShowAddFilter(false);
        setFilterSearch("");
      }

      // Close filter popup if clicking outside
      if (filterPopupRef.current && !filterPopupRef.current.contains(target)) {
        setActiveFilter(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []); // Empty dependency array - handler uses refs, not state

  // Focus search input when add filter dropdown opens
  useEffect(() => {
    if (showAddFilter && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showAddFilter]);

  // Get field info by name
  const getFieldInfo = useCallback(
    (fieldName: string) => fields.find((f) => f.name === fieldName),
    [fields]
  );

  // Get filter by field name
  const getFilter = useCallback(
    (fieldName: string) => filters.find((f) => f.field === fieldName),
    [filters]
  );

  // Update a filter
  const updateFilter = useCallback(
    (fieldName: string, updates: Partial<Filter>) => {
      const existing = filters.find((f) => f.field === fieldName);
      if (existing) {
        onFiltersChange(
          filters.map((f) =>
            f.field === fieldName ? { ...f, ...updates } : f
          )
        );
      } else {
        // Add new filter with defaults
        const fieldInfo = getFieldInfo(fieldName);
        const isString = fieldInfo?.type === "string";
        const newFilter: Filter = {
          field: fieldName,
          op: isString ? "in" : "gte",
          value: isString ? [] : 0,
          ...updates,
        };
        onFiltersChange([...filters, newFilter]);
      }
    },
    [filters, onFiltersChange, getFieldInfo]
  );

  // Remove a filter
  const removeFilter = useCallback(
    (fieldName: string) => {
      onFiltersChange(filters.filter((f) => f.field !== fieldName));
      setActiveFilter(null);
    },
    [filters, onFiltersChange]
  );

  // Add a new filter field
  const addFilter = useCallback(
    (fieldName: string) => {
      const fieldInfo = getFieldInfo(fieldName);
      const isString = fieldInfo?.type === "string";
      const newFilter: Filter = {
        field: fieldName,
        op: isString ? "in" : "gte",
        value: isString ? [] : 0,
      };
      onFiltersChange([...filters, newFilter]);
      setShowAddFilter(false);
      setActiveFilter(fieldName);
    },
    [filters, onFiltersChange, getFieldInfo]
  );

  // Group fields by category (memoized)
  const fieldsByCategory = useMemo(
    () =>
      categories.reduce(
        (acc, category) => {
          acc[category] = fields.filter((f) => f.category === category);
          return acc;
        },
        {} as Record<string, FieldInfo[]>
      ),
    [categories, fields]
  );

  // Get active filter fields (ones that have filters OR are defaults) - memoized
  const activeFields = useMemo(
    () => new Set(filters.map((f) => f.field)),
    [filters]
  );

  const displayFields = useMemo(
    () => [...new Set([...DEFAULT_FILTER_FIELDS, ...activeFields])],
    [activeFields]
  );

  if (isFieldsLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-300">Loading filters...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 items-center">
        {displayFields.map((fieldName) => {
          const fieldInfo = getFieldInfo(fieldName);
          const filter = getFilter(fieldName);
          const hasValue = filter && (
            (typeof filter.value === "number" && filter.value !== 0) ||
            (Array.isArray(filter.value) && filter.value.length > 0) ||
            (typeof filter.value === "string" && filter.value !== "")
          );

          return (
            <div key={fieldName} className="relative">
              {/* Pill button */}
              <button
                type="button"
                onClick={() => setActiveFilter(activeFilter === fieldName ? null : fieldName)}
                disabled={isLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  hasValue
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                } disabled:opacity-50`}
              >
                <span>{fieldInfo?.displayName ?? fieldName}</span>
                {hasValue && filter && (
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatFilterValue(filter, fieldInfo)}
                  </span>
                )}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Filter popup */}
              {activeFilter === fieldName && (
                <div ref={filterPopupRef}>
                  <FilterPopup
                    {...(fieldInfo && { fieldInfo })}
                    {...(filter && { filter })}
                    onUpdate={(updates) => updateFilter(fieldName, updates)}
                    {...(hasValue && { onRemove: () => removeFilter(fieldName) })}
                    onClose={() => setActiveFilter(null)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add filter button */}
        <div className="relative" ref={addFilterRef}>
          <button
            type="button"
            onClick={() => setShowAddFilter(!showAddFilter)}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Filter</span>
          </button>

          {/* Add filter dropdown */}
          {showAddFilter && (
            <div
              className="absolute z-30 mt-2 left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 flex flex-col"
            >
              {/* Search input */}
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search filters..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {/* Fields list */}
              <div className="overflow-auto flex-1">
                {categories.map((category) => {
                  const searchLower = filterSearch.toLowerCase();
                  const filteredFields = fieldsByCategory[category]
                    ?.filter((f) => !activeFields.has(f.name))
                    .filter((f) =>
                      filterSearch === "" ||
                      f.displayName.toLowerCase().includes(searchLower) ||
                      f.name.toLowerCase().includes(searchLower)
                    );

                  if (!filteredFields?.length) return null;

                  return (
                    <div key={category}>
                      <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0">
                        {category}
                      </div>
                      {filteredFields.map((field) => (
                        <button
                          key={field.name}
                          type="button"
                          onClick={() => {
                            addFilter(field.name);
                            setFilterSearch("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex justify-between items-center"
                        >
                          <span>{field.displayName}</span>
                          <span className="text-xs text-gray-400">{field.type}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help text */}
      {filters.length === 0 && (
        <p className="text-sm text-gray-500">
          Click on a filter pill to set conditions, or add more filters.
        </p>
      )}
    </div>
  );
}

/** Filter configuration popup */
interface FilterPopupProps {
  fieldInfo?: FieldInfo;
  filter?: Filter;
  onUpdate: (updates: Partial<Filter>) => void;
  onRemove?: () => void;
  onClose: () => void;
}

const FilterPopup = ({
  fieldInfo,
  filter,
  onUpdate,
  onRemove,
  onClose,
}: FilterPopupProps) => {
  const isString = fieldInfo?.type === "string";
  const isMultiSelect = fieldInfo?.name === "sector" || fieldInfo?.name === "industry" || fieldInfo?.name === "exchange";
  const operators = isString ? STRING_OPERATORS : NUMERIC_OPERATORS;

  const currentOp = filter?.op ?? (isString ? "in" : "gte");
  const currentValue = filter?.value ?? (isString ? [] : "");
  const isBetween = currentOp === "between";

  // For between operator, we need two values
  const [minValue, setMinValue] = useState(() => {
    if (isBetween && Array.isArray(currentValue)) return String(currentValue[0] ?? "");
    return String(currentValue);
  });
  const [maxValue, setMaxValue] = useState(() => {
    if (isBetween && Array.isArray(currentValue)) return String(currentValue[1] ?? "");
    return "";
  });

  // Check if this field supports K/M/B/T suffix input
  const supportsLargeNumberInput = isLargeNumberField(fieldInfo);

  // Parse numeric value (with optional K/M/B/T suffix for large number fields)
  const parseValue = (value: string): number => {
    if (supportsLargeNumberInput) {
      return parseNumberWithSuffix(value);
    }
    return parseFloat(value) || 0;
  };

  // Handle value change for numeric fields
  const handleNumericChange = (value: string, isMax = false) => {
    if (isMax) {
      setMaxValue(value);
      if (isBetween) {
        const min = parseValue(minValue);
        const max = parseValue(value);
        onUpdate({ value: [min, max] });
      }
    } else {
      setMinValue(value);
      if (isBetween) {
        const min = parseValue(value);
        const max = parseValue(maxValue);
        onUpdate({ value: [min, max] });
      } else {
        const numValue = parseValue(value);
        onUpdate({ value: numValue });
      }
    }
  };

  // Handle operator change
  const handleOpChange = (newOp: FilterOperator) => {
    if (newOp === "between") {
      const val = parseValue(minValue);
      onUpdate({ op: newOp, value: [val, val * 2] });
    } else {
      const val = parseValue(minValue);
      onUpdate({ op: newOp, value: val });
    }
  };

  // Handle multi-select for sectors/industries
  const handleMultiSelect = (option: string) => {
    const currentArr: string[] = Array.isArray(currentValue) ? currentValue.map(String) : [];
    if (currentArr.includes(option)) {
      onUpdate({ value: currentArr.filter((v) => v !== option) });
    } else {
      onUpdate({ value: [...currentArr, option] });
    }
  };

  const options = fieldInfo?.name === "sector" ? SECTORS : fieldInfo?.name === "exchange" ? EXCHANGES : INDUSTRIES;

  return (
    <div className="absolute z-30 mt-2 left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="font-medium text-sm dark:text-white">{fieldInfo?.displayName}</span>
        <div className="flex gap-1">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
              title="Clear filter"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {isMultiSelect ? (
        /* Multi-select for sector/industry */
        <div className="space-y-2 max-h-48 overflow-auto">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
              <input
                type="checkbox"
                checked={Array.isArray(currentValue) && currentValue.map(String).includes(option)}
                onChange={() => handleMultiSelect(option)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:bg-gray-700"
              />
              <span className="text-sm dark:text-gray-200">{option}</span>
            </label>
          ))}
        </div>
      ) : isString ? (
        /* Text input for other string fields */
        <input
          type="text"
          value={Array.isArray(currentValue) ? currentValue.join(", ") : String(currentValue)}
          onChange={(e) => onUpdate({ value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Enter values (comma-separated)"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
        />
      ) : (
        /* Numeric filter */
        <div className="space-y-3">
          {/* Operator selector */}
          <select
            value={currentOp}
            onChange={(e) => handleOpChange(e.target.value as FilterOperator)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {/* Value input(s) */}
          <div className={isBetween ? "flex gap-2 items-center" : ""}>
            <input
              type={supportsLargeNumberInput ? "text" : "number"}
              value={minValue}
              onChange={(e) => handleNumericChange(e.target.value)}
              placeholder={isBetween ? (supportsLargeNumberInput ? "e.g. 1B" : "Min") : (supportsLargeNumberInput ? "e.g. 10B" : "Value")}
              step="any"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            {isBetween && (
              <>
                <span className="text-gray-400">to</span>
                <input
                  type={supportsLargeNumberInput ? "text" : "number"}
                  value={maxValue}
                  onChange={(e) => handleNumericChange(e.target.value, true)}
                  placeholder={supportsLargeNumberInput ? "e.g. 100B" : "Max"}
                  step="any"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </>
            )}
          </div>
          {supportsLargeNumberInput && (
            <p className="text-xs text-gray-500">
              Use K, M, B, T for thousands, millions, billions, trillions
            </p>
          )}
        </div>
      )}
    </div>
  );
};
