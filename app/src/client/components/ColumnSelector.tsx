import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFields } from "../hooks/useFields";

/** Default columns to show */
const DEFAULT_COLUMNS = ["name", "close", "change", "change_abs", "volume", "market_cap_basic"];

interface ColumnSelectorProps {
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

/**
 * Column selector component with dropdown and category grouping.
 */
export default function ColumnSelector({
  selectedColumns,
  onColumnsChange,
}: ColumnSelectorProps) {
  // Use shared fields hook (cached across components)
  const { fields, categories, isLoading } = useFields();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggleColumn = useCallback(
    (columnName: string) => {
      if (selectedColumns.includes(columnName)) {
        // Don't allow removing the last column
        if (selectedColumns.length > 1) {
          onColumnsChange(selectedColumns.filter((c) => c !== columnName));
        }
      } else {
        onColumnsChange([...selectedColumns, columnName]);
      }
    },
    [selectedColumns, onColumnsChange]
  );

  const handleReset = useCallback(() => {
    onColumnsChange(DEFAULT_COLUMNS);
  }, [onColumnsChange]);

  const handleRemoveColumn = useCallback(
    (columnName: string) => {
      if (selectedColumns.length > 1) {
        onColumnsChange(selectedColumns.filter((c) => c !== columnName));
      }
    },
    [selectedColumns, onColumnsChange]
  );

  // Create a Map for O(1) display name lookups (memoized)
  const displayNameMap = useMemo(
    () => new Map(fields.map((f) => [f.name, f.displayName])),
    [fields]
  );

  // Get display name for a column - O(1) lookup
  const getDisplayName = useCallback(
    (columnName: string): string => {
      return displayNameMap.get(columnName) ?? columnName;
    },
    [displayNameMap]
  );

  // Filter fields based on search query (memoized)
  const filteredFields = useMemo(() => {
    if (!searchQuery) return fields;
    const lowerQuery = searchQuery.toLowerCase();
    return fields.filter(
      (f) =>
        f.displayName.toLowerCase().includes(lowerQuery) ||
        f.name.toLowerCase().includes(lowerQuery)
    );
  }, [fields, searchQuery]);

  // Group filtered fields by category (memoized)
  const fieldsByCategory = useMemo(
    () =>
      categories.reduce(
        (acc, category) => {
          acc[category] = filteredFields.filter((f) => f.category === category);
          return acc;
        },
        {} as Record<string, { name: string; displayName: string; type: string; category: string }[]>
      ),
    [categories, filteredFields]
  );

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">Loading columns...</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected columns as chips */}
      <div className="flex flex-wrap gap-2">
        {selectedColumns.map((col) => (
          <span
            key={col}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
          >
            {getDisplayName(col)}
            {selectedColumns.length > 1 && (
              <button
                onClick={() => handleRemoveColumn(col)}
                className="hover:text-blue-600 font-bold"
                aria-label={`Remove ${getDisplayName(col)}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Dropdown trigger and menu */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
          >
            <span>Add Columns</span>
            <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Reset
          </button>
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-20 mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 flex flex-col">
            {/* Search input */}
            <div className="p-2 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search columns..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Fields list */}
            <div className="overflow-auto flex-1">
              {categories.map((category) => {
                const categoryFields = fieldsByCategory[category];
                if (!categoryFields?.length) return null;

                return (
                  <div key={category}>
                    <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide sticky top-0">
                      {category}
                    </div>
                    {categoryFields.map((field) => (
                      <label
                        key={field.name}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(field.name)}
                          onChange={() => handleToggleColumn(field.name)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm flex-1">{field.displayName}</span>
                        <span className="text-xs text-gray-400">
                          {field.type}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
              {filteredFields.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No columns match "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_COLUMNS };
