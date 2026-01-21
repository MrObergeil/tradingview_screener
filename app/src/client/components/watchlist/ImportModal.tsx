import { useState, useRef } from "react";
import { importWatchlist, type ImportResponse } from "../../lib/client";

interface ImportModalProps {
  onClose: () => void;
  onSuccess: (result: ImportResponse) => void;
}

type ImportFormat = "text" | "csv" | "json" | "tradingview";

/**
 * Modal for importing tickers into a new watchlist.
 */
export default function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [data, setData] = useState("");
  const [format, setFormat] = useState<ImportFormat>("text");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview tickers from input
  const updatePreview = (inputData: string, inputFormat: ImportFormat) => {
    try {
      let tickers: string[] = [];

      if (inputFormat === "json") {
        const parsed = JSON.parse(inputData);
        if (Array.isArray(parsed)) {
          tickers = parsed.filter((t) => typeof t === "string");
        } else if (parsed.tickers) {
          tickers = parsed.tickers;
        } else if (parsed.items) {
          tickers = parsed.items.map((i: { ticker: string }) => i.ticker);
        }
      } else if (inputFormat === "tradingview") {
        tickers = inputData
          .split(/[,\n\r\s]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => (t.includes(":") ? t.split(":")[1] ?? t : t))
          .map((t) => t.toUpperCase());
      } else {
        // text or csv
        tickers = inputData
          .split(/[,\n\r]+/)
          .map((t) => t.split(",")[0]?.trim() ?? "")
          .filter(Boolean)
          .map((t) => t.toUpperCase())
          .filter((t) => /^[A-Z]+$/.test(t));
      }

      // Remove duplicates and limit preview
      setPreview([...new Set(tickers)].slice(0, 20));
    } catch {
      setPreview([]);
    }
  };

  // Handle data change
  const handleDataChange = (value: string) => {
    setData(value);
    updatePreview(value, format);
  };

  // Handle format change
  const handleFormatChange = (newFormat: ImportFormat) => {
    setFormat(newFormat);
    updatePreview(data, newFormat);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setData(content);

      // Auto-detect format from file extension
      if (file.name.endsWith(".json")) {
        setFormat("json");
        updatePreview(content, "json");
      } else if (file.name.endsWith(".csv")) {
        setFormat("csv");
        updatePreview(content, "csv");
      } else {
        updatePreview(content, format);
      }
    };
    reader.readAsText(file);
  };

  // Handle import
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !data.trim()) return;

    setIsImporting(true);
    setError(null);

    try {
      const desc = description.trim();
      const result = await importWatchlist({
        name: name.trim(),
        ...(desc && { description: desc }),
        data: data.trim(),
        format,
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Import Watchlist</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleImport} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Watchlist Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Imported Tech Stocks"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Imported from TradingView"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Import Format
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["text", "csv", "json", "tradingview"] as ImportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFormatChange(f)}
                  className={`px-3 py-1.5 text-sm rounded-md border ${
                    format === f
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {f === "text" && "Plain Text"}
                  {f === "csv" && "CSV"}
                  {f === "json" && "JSON"}
                  {f === "tradingview" && "TradingView"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {format === "text" && "One ticker per line or comma-separated (e.g., AAPL, MSFT, GOOGL)"}
              {format === "csv" && "CSV with ticker column (header optional)"}
              {format === "json" && 'JSON array ["AAPL", "MSFT"] or {tickers: [...]}'}
              {format === "tradingview" && "TradingView format with exchange prefix (e.g., NASDAQ:AAPL)"}
            </p>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Text input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Or Paste Data *
            </label>
            <textarea
              value={data}
              onChange={(e) => handleDataChange(e.target.value)}
              placeholder={
                format === "tradingview"
                  ? "NASDAQ:AAPL, NYSE:MSFT, NASDAQ:GOOGL"
                  : "AAPL\nMSFT\nGOOGL"
              }
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              required
            />
          </div>

          {/* Preview */}
          {preview.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preview ({preview.length} tickers)
              </label>
              <div className="flex flex-wrap gap-1 p-3 bg-gray-50 rounded-md max-h-24 overflow-y-auto">
                {preview.map((ticker) => (
                  <span
                    key={ticker}
                    className="px-2 py-0.5 bg-white border border-gray-200 rounded text-sm"
                  >
                    {ticker}
                  </span>
                ))}
                {preview.length === 20 && (
                  <span className="text-gray-500 text-sm">...and more</span>
                )}
              </div>
            </div>
          ) : null}

          {/* Error */}
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
              {error}
            </div>
          ) : null}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!name.trim() || !data.trim() || isImporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
