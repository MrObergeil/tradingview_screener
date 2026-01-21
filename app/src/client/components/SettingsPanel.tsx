import { useState, useEffect, useCallback } from "react";
import {
  getPreferences,
  setPreference,
  getFavoriteFields,
  addFavoriteField,
  removeFavoriteField,
  getFields,
  type FavoriteField,
  type FieldInfo,
} from "../lib/client";

/**
 * Settings panel for managing user preferences and favorite fields.
 */
export default function SettingsPanel() {
  // Preferences state
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);

  // Favorite fields state
  const [favoriteFields, setFavoriteFields] = useState<FavoriteField[]>([]);
  const [availableFields, setAvailableFields] = useState<FieldInfo[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    setIsLoadingPrefs(true);
    try {
      const prefs = await getPreferences();
      setPreferences(prefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preferences");
    } finally {
      setIsLoadingPrefs(false);
    }
  }, []);

  // Fetch favorite fields and available fields
  const fetchFields = useCallback(async () => {
    setIsLoadingFields(true);
    try {
      const [favorites, fields] = await Promise.all([
        getFavoriteFields(),
        getFields(),
      ]);
      setFavoriteFields(favorites);
      setAvailableFields(fields.fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fields");
    } finally {
      setIsLoadingFields(false);
    }
  }, []);

  useEffect(() => {
    void fetchPreferences();
    void fetchFields();
  }, [fetchPreferences, fetchFields]);

  // Handle preference change
  const handlePrefChange = async (key: string, value: string) => {
    try {
      await setPreference(key, value);
      setPreferences((prev) => ({ ...prev, [key]: value }));
      showSuccess("Preference saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preference");
    }
  };

  // Handle add favorite field
  const handleAddFavorite = async (fieldName: string) => {
    try {
      const field = await addFavoriteField(fieldName);
      setFavoriteFields((prev) => [...prev, field]);
      showSuccess(`Added "${fieldName}" to favorites`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add favorite");
    }
  };

  // Handle remove favorite field
  const handleRemoveFavorite = async (fieldName: string) => {
    try {
      await removeFavoriteField(fieldName);
      setFavoriteFields((prev) => prev.filter((f) => f.field_name !== fieldName));
      showSuccess(`Removed "${fieldName}" from favorites`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove favorite");
    }
  };

  // Show success message briefly
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Get fields that are not already favorites
  const nonFavoriteFields = availableFields.filter(
    (f) => !favoriteFields.some((fav) => fav.field_name === f.name)
  );

  // Group available fields by category
  const fieldsByCategory = nonFavoriteFields.reduce<Record<string, FieldInfo[]>>(
    (acc, field) => {
      const category = field.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category]!.push(field);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* General Preferences */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium mb-4">General Preferences</h3>
        {isLoadingPrefs ? (
          <div className="text-gray-500">Loading preferences...</div>
        ) : (
          <div className="space-y-4">
            {/* Results per page */}
            <div className="flex items-center justify-between">
              <label htmlFor="resultsPerPage" className="text-sm text-gray-700">
                Results per page
              </label>
              <select
                id="resultsPerPage"
                value={preferences["resultsPerPage"] ?? "50"}
                onChange={(e) => handlePrefChange("resultsPerPage", e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>

            {/* Auto refresh */}
            <div className="flex items-center justify-between">
              <label htmlFor="autoRefresh" className="text-sm text-gray-700">
                Auto-refresh results
              </label>
              <input
                type="checkbox"
                id="autoRefresh"
                checked={preferences["autoRefresh"] === "true"}
                onChange={(e) => handlePrefChange("autoRefresh", String(e.target.checked))}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </div>

            {/* Refresh interval */}
            {preferences["autoRefresh"] === "true" && (
              <div className="flex items-center justify-between pl-4">
                <label htmlFor="refreshInterval" className="text-sm text-gray-700">
                  Refresh interval (seconds)
                </label>
                <select
                  id="refreshInterval"
                  value={preferences["refreshInterval"] ?? "30"}
                  onChange={(e) => handlePrefChange("refreshInterval", e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="60">60</option>
                  <option value="120">120</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Favorite Fields */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium mb-4">Favorite Fields</h3>
        <p className="text-sm text-gray-600 mb-4">
          Mark fields as favorites for quick access in the column selector.
        </p>

        {isLoadingFields ? (
          <div className="text-gray-500">Loading fields...</div>
        ) : (
          <div className="space-y-4">
            {/* Current favorites */}
            {favoriteFields.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Favorites
                </label>
                <div className="flex flex-wrap gap-2">
                  {favoriteFields.map((field) => (
                    <span
                      key={field.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {field.field_name}
                      <button
                        onClick={() => handleRemoveFavorite(field.field_name)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Remove from favorites"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add favorites */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add to Favorites
              </label>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white">
                {Object.entries(fieldsByCategory).map(([category, fields]) => (
                  <div key={category}>
                    <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase sticky top-0">
                      {category}
                    </div>
                    {fields.map((field) => (
                      <button
                        key={field.name}
                        onClick={() => handleAddFavorite(field.name)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex justify-between items-center text-sm"
                      >
                        <span>{field.displayName}</span>
                        <span className="text-gray-400 text-xs">{field.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {nonFavoriteFields.length === 0 && (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">
                    All fields are already favorites
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
