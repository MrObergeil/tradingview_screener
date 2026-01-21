import { useState, useEffect, useCallback } from "react";
import {
  getConfigs,
  createConfig,
  deleteConfig,
  type ScreenerConfig,
  type ScreenerConfigData,
  type Filter,
} from "../lib/client";

interface ConfigManagerProps {
  currentColumns: string[];
  currentFilters: Filter[];
  onLoadConfig: (config: ScreenerConfigData) => void;
}

/**
 * Component for saving and loading screener configurations.
 */
export default function ConfigManager({
  currentColumns,
  currentFilters,
  onLoadConfig,
}: ConfigManagerProps) {
  const [configs, setConfigs] = useState<ScreenerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch configs on mount
  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getConfigs();
      setConfigs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  // Handle save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const desc = saveDescription.trim();
      await createConfig({
        name: saveName.trim(),
        ...(desc && { description: desc }),
        config: {
          columns: currentColumns,
          filters: currentFilters,
        },
      });
      setSaveName("");
      setSaveDescription("");
      setShowSaveModal(false);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle load
  const handleLoad = (config: ScreenerConfig) => {
    onLoadConfig(config.config);
    setShowDropdown(false);
  };

  // Handle delete
  const handleDelete = async (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete config "${name}"?`)) return;

    try {
      await deleteConfig(id);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config");
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* Load dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Load
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
              {configs.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No saved configs yet
                </div>
              ) : (
                configs.map((config) => (
                  <div
                    key={config.id}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center group"
                    onMouseDown={() => handleLoad(config)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {config.name}
                        {config.is_preset === 1 && (
                          <span className="ml-1 text-xs text-blue-600">(preset)</span>
                        )}
                      </div>
                      {config.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {config.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {config.config.filters.length} filters, {config.config.columns.length} columns
                      </div>
                    </div>
                    {config.is_preset === 0 && (
                      <button
                        onMouseDown={(e) => handleDelete(config.id, config.name, e)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={() => setShowSaveModal(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-red-50 border border-red-200 rounded p-2 text-red-600 text-xs">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">
            Dismiss
          </button>
        </div>
      )}

      {/* Save modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Save Configuration</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., High Volume Tech Stocks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="e.g., Filters for tech stocks with high volume"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="bg-gray-50 rounded-md p-3 text-sm">
                <div className="font-medium text-gray-700 mb-1">Will save:</div>
                <ul className="text-gray-600 space-y-1">
                  <li>{currentColumns.length} columns</li>
                  <li>{currentFilters.length} filters</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!saveName.trim() || isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
