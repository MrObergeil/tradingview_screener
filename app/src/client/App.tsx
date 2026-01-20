import TickerInput from "./components/TickerInput";
import { useScreener } from "./hooks/useScreener";

export default function App() {
  const { data, isLoading, error, executeScan, clearError } = useScreener();

  const handleScan = (tickers: string[]) => {
    console.log("Scanning tickers:", tickers);
    void executeScan(tickers);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white py-4 px-6 shadow-md">
        <h1 className="text-2xl font-bold">TV Screener+</h1>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Ticker Input */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Enter Tickers</h2>
          <TickerInput onScan={handleScan} isLoading={isLoading} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results Display */}
        {data && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Results ({data.totalCount} total)
              </h2>
              <span className="text-sm text-gray-500">
                {data.durationMs}ms
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Ticker
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Change %
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Volume
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.results.map((result, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap font-medium">
                        {String(result["name"] ?? "")}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">
                        {formatNumber(result["close"] as number | null)}
                      </td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap text-right ${getChangeColor(result["change"] as number | null)}`}
                      >
                        {formatPercent(result["change"] as number | null)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">
                        {formatVolume(result["volume"] as number | null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatVolume(value: number | null | undefined): string {
  if (value == null) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString();
}

function getChangeColor(value: number | null | undefined): string {
  if (value == null) return "text-gray-500";
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-gray-500";
}
