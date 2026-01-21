import { useState, useEffect } from "react";
import { getFields, type FieldInfo } from "../lib/client";

interface FieldsState {
  fields: FieldInfo[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
}

// Module-level cache to share across all hook instances
let fieldsCache: { fields: FieldInfo[]; categories: string[] } | null = null;
let fetchPromise: Promise<{ fields: FieldInfo[]; categories: string[] }> | null = null;

/**
 * Shared hook for field definitions.
 * Caches the result at module level to prevent duplicate API calls.
 */
export function useFields(): FieldsState {
  const [state, setState] = useState<FieldsState>(() => {
    // Initialize with cached data if available
    if (fieldsCache) {
      return {
        fields: fieldsCache.fields,
        categories: fieldsCache.categories,
        isLoading: false,
        error: null,
      };
    }
    return {
      fields: [],
      categories: [],
      isLoading: true,
      error: null,
    };
  });

  useEffect(() => {
    // If we already have cached data, no need to fetch
    if (fieldsCache) {
      setState({
        fields: fieldsCache.fields,
        categories: fieldsCache.categories,
        isLoading: false,
        error: null,
      });
      return;
    }

    // If a fetch is already in progress, wait for it
    if (!fetchPromise) {
      fetchPromise = getFields().then((response) => {
        fieldsCache = {
          fields: response.fields,
          categories: response.categories,
        };
        return fieldsCache;
      });
    }

    // Wait for the fetch (either new or existing)
    fetchPromise
      .then((data) => {
        setState({
          fields: data.fields,
          categories: data.categories,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch fields",
        }));
      });
  }, []);

  return state;
}

/**
 * Pre-built lookup map for field display names.
 * Use this for O(1) lookups instead of array.find().
 */
export function useFieldDisplayNames(): Map<string, string> {
  const { fields } = useFields();
  const [displayNameMap, setDisplayNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (fields.length > 0) {
      setDisplayNameMap(new Map(fields.map((f) => [f.name, f.displayName])));
    }
  }, [fields]);

  return displayNameMap;
}
