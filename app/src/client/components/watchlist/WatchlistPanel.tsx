import { useState, useCallback } from "react";
import WatchlistList from "./WatchlistList";
import WatchlistDetail from "./WatchlistDetail";
import ImportModal from "./ImportModal";
import type { WatchlistSummary, ImportResponse } from "../../lib/client";

interface WatchlistPanelProps {
  onScanTickers: (tickers: string[]) => void;
}

type View = "list" | "detail";

/**
 * Container component for watchlist management.
 * Manages navigation between list and detail views.
 */
export default function WatchlistPanel({ onScanTickers }: WatchlistPanelProps) {
  const [view, setView] = useState<View>("list");
  const [selectedWatchlist, setSelectedWatchlist] = useState<WatchlistSummary | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  // Handle selecting a watchlist
  const handleSelect = useCallback((watchlist: WatchlistSummary) => {
    setSelectedWatchlist(watchlist);
    setView("detail");
  }, []);

  // Handle going back to list
  const handleBack = useCallback(() => {
    setView("list");
    setSelectedWatchlist(null);
  }, []);

  // Handle import success
  const handleImportSuccess = useCallback((result: ImportResponse) => {
    setImportResult(result);
    setShowImportModal(false);
    // Navigate to the imported watchlist
    setSelectedWatchlist(result.watchlist);
    setView("detail");
  }, []);

  return (
    <div>
      {/* Import success message */}
      {importResult ? (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 flex justify-between items-center">
          <span className="text-green-700">
            Imported {importResult.imported} tickers into "{importResult.watchlist.name}"
            {importResult.skipped.length > 0
              ? ` (${importResult.skipped.length} skipped)`
              : ""}
          </span>
          <button
            onClick={() => setImportResult(null)}
            className="text-green-500 hover:text-green-700"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* View content */}
      {view === "list" ? (
        <WatchlistList
          onSelect={handleSelect}
          onImport={() => setShowImportModal(true)}
        />
      ) : selectedWatchlist ? (
        <WatchlistDetail
          watchlistId={selectedWatchlist.id}
          onBack={handleBack}
          onScanTickers={onScanTickers}
        />
      ) : null}

      {/* Import modal */}
      {showImportModal ? (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      ) : null}
    </div>
  );
}
