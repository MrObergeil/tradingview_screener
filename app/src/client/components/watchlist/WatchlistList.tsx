import { useState, useEffect, useCallback } from "react";
import {
  getWatchlists,
  createWatchlist,
  deleteWatchlist,
  type WatchlistSummary,
} from "../../lib/client";

interface WatchlistListProps {
  onSelect: (watchlist: WatchlistSummary) => void;
  onImport: () => void;
}

/**
 * Component to display list of all watchlists.
 */
export default function WatchlistList({ onSelect, onImport }: WatchlistListProps) {
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch watchlists on mount
  const fetchWatchlists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWatchlists();
      setWatchlists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlists");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWatchlists();
  }, [fetchWatchlists]);

  // Handle create watchlist
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    try {
      const desc = newDescription.trim();
      await createWatchlist({
        name: newName.trim(),
        ...(desc && { description: desc }),
      });
      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      await fetchWatchlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create watchlist");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete watchlist
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete watchlist "${name}"? This cannot be undone.`)) return;

    try {
      await deleteWatchlist(id);
      await fetchWatchlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete watchlist");
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading watchlists...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">My Watchlists</h3>
        <div className="flex gap-2">
          <button
            onClick={onImport}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + New
          </button>
        </div>
      </div>

      {/* Error message */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Create form */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Tech Stocks"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., My favorite tech companies"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newName.trim() || isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
                setNewDescription("");
              }}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* Watchlist cards */}
      {watchlists.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No watchlists yet</p>
          <p className="text-sm">Create one to start tracking your favorite stocks</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {watchlists.map((wl) => (
            <div
              key={wl.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => onSelect(wl)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{wl.name}</h4>
                  {wl.description ? (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {wl.description}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(wl.id, wl.name);
                  }}
                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete watchlist"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex items-center text-sm text-gray-500">
                <span className="bg-gray-100 px-2 py-0.5 rounded">
                  {wl.itemCount} {wl.itemCount === 1 ? "ticker" : "tickers"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
