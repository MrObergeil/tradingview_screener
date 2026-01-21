import { useState, useEffect, useCallback, useRef } from "react";
import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  removeWatchlistItem,
  updateWatchlist,
  getExportUrl,
  searchTickers,
  type Watchlist,
  type WatchlistItem,
  type TickerResult,
} from "../../lib/client";

interface WatchlistDetailProps {
  watchlistId: number;
  onBack: () => void;
  onScanTickers: (tickers: string[]) => void;
}

/**
 * Component to view and edit a single watchlist.
 */
export default function WatchlistDetail({
  watchlistId,
  onBack,
  onScanTickers,
}: WatchlistDetailProps) {
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Add ticker states
  const [newTicker, setNewTicker] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Autocomplete states
  const [suggestions, setSuggestions] = useState<TickerResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerInputRef = useRef<HTMLInputElement>(null);

  // Editing item
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemNotes, setEditItemNotes] = useState("");
  const [editItemTags, setEditItemTags] = useState("");

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWatchlist(watchlistId);
      setWatchlist(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    } finally {
      setIsLoading(false);
    }
  }, [watchlistId]);

  useEffect(() => {
    void fetchWatchlist();
  }, [fetchWatchlist]);

  // Fetch ticker suggestions when input changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (newTicker.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await searchTickers(newTicker, 8);
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
  }, [newTicker]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback((ticker: string) => {
    setNewTicker(ticker);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    tickerInputRef.current?.focus();
  }, []);

  // Handle keyboard navigation in suggestions
  const handleTickerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  // Handle add ticker
  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim() || !watchlist) return;

    setIsAdding(true);
    try {
      const notes = newNotes.trim();
      await addWatchlistItem(watchlist.id, {
        ticker: newTicker.trim().toUpperCase(),
        ...(notes && { notes }),
      });
      setNewTicker("");
      setNewNotes("");
      await fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add ticker");
    } finally {
      setIsAdding(false);
    }
  };

  // Handle remove ticker
  const handleRemove = async (item: WatchlistItem) => {
    if (!watchlist) return;
    if (!confirm(`Remove ${item.ticker} from this watchlist?`)) return;

    try {
      await removeWatchlistItem(watchlist.id, item.id);
      await fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove ticker");
    }
  };

  // Handle edit watchlist name
  const handleSaveName = async () => {
    if (!watchlist || !editName.trim()) return;

    try {
      const desc = editDescription.trim();
      await updateWatchlist(watchlist.id, {
        name: editName.trim(),
        ...(desc && { description: desc }),
      });
      setIsEditingName(false);
      await fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update watchlist");
    }
  };

  // Handle edit item
  const handleSaveItem = async (itemId: number) => {
    if (!watchlist) return;

    try {
      const notes = editItemNotes.trim();
      const tags = editItemTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateWatchlistItem(watchlist.id, itemId, {
        ...(notes && { notes }),
        ...(tags.length > 0 && { tags }),
      });
      setEditingItemId(null);
      await fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    }
  };

  // Start editing item
  const startEditItem = (item: WatchlistItem) => {
    setEditingItemId(item.id);
    setEditItemNotes(item.notes ?? "");
    setEditItemTags(item.tags.join(", "));
  };

  // Handle scan all tickers
  const handleScanAll = () => {
    if (!watchlist || watchlist.items.length === 0) return;
    onScanTickers(watchlist.items.map((i) => i.ticker));
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading watchlist...</div>;
  }

  if (!watchlist) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error ?? "Watchlist not found"}</p>
        <button onClick={onBack} className="text-blue-600 hover:underline">
          Back to watchlists
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700"
          title="Back to watchlists"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {isEditingName ? (
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditingName(false)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex-1">
            <h3
              className="text-lg font-medium cursor-pointer hover:text-blue-600"
              onClick={() => {
                setEditName(watchlist.name);
                setEditDescription(watchlist.description ?? "");
                setIsEditingName(true);
              }}
              title="Click to edit"
            >
              {watchlist.name}
            </h3>
            {watchlist.description ? (
              <p className="text-sm text-gray-500">{watchlist.description}</p>
            ) : null}
          </div>
        )}

        <div className="flex gap-2">
          <a
            href={getExportUrl(watchlist.id, "csv")}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            download
          >
            Export CSV
          </a>
          <button
            onClick={handleScanAll}
            disabled={watchlist.items.length === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Scan All
          </button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Add ticker form */}
      <form onSubmit={handleAddTicker} className="flex gap-2">
        <div className="relative w-48">
          <input
            ref={tickerInputRef}
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={handleTickerKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => {
              if (suggestions.length > 0 && newTicker.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Ticker (e.g., AAPL)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.name}
                  className={`px-3 py-2 cursor-pointer ${
                    index === selectedIndex
                      ? "bg-blue-100"
                      : "hover:bg-gray-100"
                  }`}
                  onMouseDown={() => handleSelectSuggestion(suggestion.name)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{suggestion.name}</span>
                      <span className="text-gray-500 text-sm ml-2 truncate">
                        {suggestion.description}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 ml-2">{suggestion.exchange}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="text"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!newTicker.trim() || isAdding}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
      </form>

      {/* Items list */}
      {watchlist.items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No tickers in this watchlist</p>
          <p className="text-sm mt-1">Add some tickers above to get started</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Ticker
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Tags
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {watchlist.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.ticker}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingItemId === item.id ? (
                      <input
                        type="text"
                        value={editItemNotes}
                        onChange={(e) => setEditItemNotes(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Notes"
                      />
                    ) : (
                      item.notes ?? <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingItemId === item.id ? (
                      <input
                        type="text"
                        value={editItemTags}
                        onChange={(e) => setEditItemTags(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="tag1, tag2"
                      />
                    ) : item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingItemId === item.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveItem(item.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onScanTickers([item.ticker])}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Scan this ticker"
                        >
                          Scan
                        </button>
                        <button
                          onClick={() => startEditItem(item)}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemove(item)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
