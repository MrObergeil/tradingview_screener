import { useMemo } from "react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

/**
 * Pagination component with prev/next buttons and page numbers.
 */
export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Calculate which page numbers to show
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    const maxVisible = 7; // Max page buttons to show

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  // Don't render if only one page
  if (totalPages <= 1) {
    return null;
  }

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Calculate item range for display
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {/* Item count info */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Showing {startItem.toLocaleString()} - {endItem.toLocaleString()} of{" "}
        {totalItems.toLocaleString()} results
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev || isLoading}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          ← Prev
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((page, index) =>
            page === "..." ? (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-400 dark:text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                disabled={isLoading}
                className={`min-w-[36px] px-3 py-1.5 text-sm font-medium rounded-md ${
                  page === currentPage
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                } disabled:cursor-not-allowed`}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext || isLoading}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
