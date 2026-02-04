'use client';

import React from 'react';

type Column<T> = {
  header: string;
  accessor: (row: T) => React.ReactNode;
  key: string;
};

type TableProps<T> = {
  data: T[];
  columns: Column<T>[];
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export default function Table<T>({
  data,
  columns,
  currentPage,
  pageCount,
  onPageChange,
}: TableProps<T>) {
  return (
    <div className="w-full">
      {/* Table for medium+ screens */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-2 whitespace-nowrap text-sm text-gray-500"
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card layout for small screens */}
      <div className="sm:hidden space-y-2">
        {data.map((row, idx) => (
          <div
            key={idx}
            className="bg-white shadow rounded-lg p-3 flex flex-col space-y-1"
          >
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between">
                <span className="font-medium text-gray-700">{col.header}:</span>
                <span className="text-gray-500">{col.accessor(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {pageCount > 1 && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1">
            Page {currentPage} of {pageCount}
          </span>
          <button
            disabled={currentPage === pageCount}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
