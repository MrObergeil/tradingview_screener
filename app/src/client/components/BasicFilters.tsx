import { useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import type { Filter } from "../api/client";

export interface FilterValues {
  priceMin: string;
  priceMax: string;
  volumeMin: string;
}

interface BasicFiltersProps {
  onApply: (filters: Filter[]) => void;
  isLoading?: boolean;
}

const INITIAL_VALUES: FilterValues = {
  priceMin: "",
  priceMax: "",
  volumeMin: "",
};

/**
 * Basic filters component for price range and volume filtering.
 */
export default function BasicFilters({ onApply, isLoading = false }: BasicFiltersProps) {
  const [values, setValues] = useState<FilterValues>(INITIAL_VALUES);

  const handleChange = useCallback(
    (field: keyof FilterValues) => (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const filters = buildFilters(values);
      onApply(filters);
    },
    [values, onApply]
  );

  const handleClear = useCallback(() => {
    setValues(INITIAL_VALUES);
    onApply([]);
  }, [onApply]);

  const hasFilters =
    values.priceMin !== "" || values.priceMax !== "" || values.volumeMin !== "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Price Min */}
        <div>
          <label
            htmlFor="priceMin"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Min Price
          </label>
          <input
            type="number"
            id="priceMin"
            value={values.priceMin}
            onChange={handleChange("priceMin")}
            placeholder="0"
            min="0"
            step="0.01"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* Price Max */}
        <div>
          <label
            htmlFor="priceMax"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Max Price
          </label>
          <input
            type="number"
            id="priceMax"
            value={values.priceMax}
            onChange={handleChange("priceMax")}
            placeholder="No limit"
            min="0"
            step="0.01"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* Volume Min */}
        <div>
          <label
            htmlFor="volumeMin"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Min Volume
          </label>
          <input
            type="number"
            id="volumeMin"
            value={values.volumeMin}
            onChange={handleChange("volumeMin")}
            placeholder="0"
            min="0"
            step="1000"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Apply Filters
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/**
 * Convert form values to API filter objects.
 */
function buildFilters(values: FilterValues): Filter[] {
  const filters: Filter[] = [];

  const priceMin = parseFloat(values.priceMin);
  const priceMax = parseFloat(values.priceMax);
  const volumeMin = parseFloat(values.volumeMin);

  // Price min filter
  if (!isNaN(priceMin) && priceMin > 0) {
    filters.push({ field: "close", op: "gte", value: priceMin });
  }

  // Price max filter
  if (!isNaN(priceMax) && priceMax > 0) {
    filters.push({ field: "close", op: "lte", value: priceMax });
  }

  // Volume min filter
  if (!isNaN(volumeMin) && volumeMin > 0) {
    filters.push({ field: "volume", op: "gte", value: volumeMin });
  }

  return filters;
}
