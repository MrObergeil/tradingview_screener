import { useState, useEffect, useCallback, useRef } from "react";
import { getFields, type FieldInfo } from "../lib/client";

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
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch fields on mount
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await getFields();
        setFields(response.fields);
        setCategories(response.categories);
      } catch (error) {
        console.error("Failed to fetch fields:", error);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchFields();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Get display name for a column
  const getDisplayName = useCallback(
    (columnName: string): string => {
      const field = fields.find((f) => f.name === columnName);
      return field?.displayName ?? columnName;
    },
    [fields]
  );

  // Group fields by category
  const fieldsByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = fields.filter((f) => f.category === category);
      return acc;
    },
    {} as Record<string, FieldInfo[]>
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
          <div className="absolute z-20 mt-1 w-72 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-auto">
            {categories.map((category) => (
              <div key={category}>
                <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide sticky top-0">
                  {category}
                </div>
                {fieldsByCategory[category]?.map((field) => (
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
                    <span className="text-sm">{field.displayName}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {field.type}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_COLUMNS };
