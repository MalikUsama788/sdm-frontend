'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Dividend } from '@/types/dividends';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Table from '@/app/components/Table';
import LineGraph from '@/app/components/LineGraph';
import BarGraph from '@/app/components/BarGraph';
import { format, subMonths, subYears } from 'date-fns';
import { formatDateWithSuffix } from '@/utils/format';

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

type DateFilterType = '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'ALL';

type GraphData = {
  stock: string;
  dividendValue: number;
  dividendPercentage: number;
  numberOfShares: number;
  amountBeforeTax: number;
  amountAfterTax: number;
};

type DividendGraphData = {
  type: string;
  records: Dividend[];
  showTable: boolean;
  currentPage: number;
  dateFilter: DateFilterType;
};

interface StrapiMeta {
  pagination?: { pageCount: number };
}

export default function DividendsPage() {
  const { data: session } = useSession();

  const [dividendGraphs, setDividendGraphs] = useState<DividendGraphData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<DateFilterType>('1Y');

  // Number Formatting
  const parseNumber = (v: unknown): number => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const cleaned = v.replace(/,/g, '').replace(/[^\d.-]/g, '');
      const n = Number(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  // Date filter
  const getStartDate = (filter: DateFilterType): string | null => {
    const today = new Date();
    let startDate: Date;
    switch (filter) {
      case '3M':
        startDate = subMonths(today, 3);
        break;
      case '6M':
        startDate = subMonths(today, 6);
        break;
      case '1Y':
        startDate = subYears(today, 1);
        break;
      case '2Y':
        startDate = subYears(today, 2);
        break;
      case '5Y':
        startDate = subYears(today, 5);
        break;
      case 'ALL':
        return null;
      default:
        startDate = subYears(today, 1);
    }
    return format(startDate, 'yyyy-MM-dd');
  };

  // Get all Records
  const fetchAllPages = useCallback(
    async (startDate: string | null): Promise<Dividend[]> => {
      if (!session?.jwt) return [];

      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      let all: Dividend[] = [];

      while (page <= totalPages) {
        const params: Record<string, string | number> = {
          'pagination[page]': page,
          'pagination[pageSize]': pageSize,
          sort: 'creditDate:asc',
          populate: 'stock',
        };
        if (startDate) {
          params['filters[creditDate][$gte]'] = startDate;
        }

        const resp = await axios.get<{ data: Dividend[]; meta?: StrapiMeta }>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/dividends`,
          {
            headers: { Authorization: `Bearer ${session.jwt}` },
            params,
          }
        );

        all = all.concat(resp.data.data);
        totalPages = resp.data.meta?.pagination?.pageCount || 1;
        page++;
      }

      return all;
    },
    [session?.jwt]
  );

  // Get Dividends
  const fetchDividendData = useCallback(
    async (dateFilter: DateFilterType) => {
      if (!session?.jwt) return;

      try {
        setLoading(true);
        setError(null);
        setSelectedDateFilter(dateFilter);

        const startDate = getStartDate(dateFilter);
        const allRecords = await fetchAllPages(startDate);

        if (!allRecords || allRecords.length === 0) {
          setDividendGraphs([]);
        } else {
          const graphItem: DividendGraphData = {
            type: 'Dividend',
            records: allRecords,
            showTable: false,
            currentPage: 1,
            dateFilter,
          };
          setDividendGraphs([graphItem]);
        }
      } catch (err: unknown) {
        if (err instanceof Error)
          setError('Failed to load dividends: ' + (err?.message ?? err));
        else setError('Failed to load dividends');
      } finally {
        setLoading(false);
      }
    },
    [session?.jwt, fetchAllPages]
  );

  // On Page Load
  useEffect(() => {
    fetchDividendData(selectedDateFilter);
  }, [session, selectedDateFilter, fetchDividendData]);

  // Show/Hide Table
  const toggleTable = () => {
    setDividendGraphs((prev) =>
      prev.map((g) => ({ ...g, showTable: !g.showTable }))
    );
  };

  // Page Change
  const handlePageChange = (page: number) => {
    setDividendGraphs((prev) => prev.map((g) => ({ ...g, currentPage: page })));
  };

  // Graph Data Sorted
  const getStockWiseTotals = (records: Dividend[]): GraphData[] => {
    const map: Record<string, GraphData> = {};
    records.forEach((r) => {
      const stock = r.stock?.stockCode?.trim() || 'N/A';
      const dv = parseNumber(r.dividendValue);
      const dp = parseNumber(r.dividendPercentage);
      const ns = parseNumber(r.numberOfShares);
      const ab = parseNumber(r.amountBeforeTax);
      const at = parseNumber(r.amountAfterTax);

      if (!map[stock])
        map[stock] = {
          stock,
          dividendValue: 0,
          dividendPercentage: 0,
          numberOfShares: 0,
          amountBeforeTax: 0,
          amountAfterTax: 0,
        };
      map[stock].dividendValue += dv;
      map[stock].dividendPercentage += dp;
      map[stock].numberOfShares += ns;
      map[stock].amountBeforeTax += ab;
      map[stock].amountAfterTax += at;
    });

    // Return sorted by Stock Name
    return Object.values(map).sort((a, b) => a.stock.localeCompare(b.stock));
  };

  const columns = [
    {
      key: 'stock',
      header: 'Stock',
      accessor: (row: Dividend) => row.stock?.stockCode || 'N/A',
    },
    {
      key: 'dateAnnounced',
      header: 'Date Announced',
      accessor: (row: Dividend) =>
        formatDateWithSuffix(row.dateAnnounced || ''),
    },
    {
      key: 'dateHoldStock',
      header: 'Date Hold Stock',
      accessor: (row: Dividend) =>
        formatDateWithSuffix(row.dateHoldStock || ''),
    },
    {
      key: 'creditDate',
      header: 'Credit Date',
      accessor: (row: Dividend) =>
        formatDateWithSuffix(
          row.creditDate || row.dateHoldStock || row.dateAnnounced || ''
        ),
    },
    {
      key: 'dividendValue',
      header: 'Dividend Value',
      accessor: (row: Dividend) =>
        new Intl.NumberFormat('en-PK', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0,
        }).format(parseNumber(row.dividendValue)),
    },
    {
      key: 'amountBeforeTax',
      header: 'Amount Before Tax',
      accessor: (row: Dividend) =>
        new Intl.NumberFormat('en-PK', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0,
        }).format(parseNumber(row.amountBeforeTax)),
    },
    {
      key: 'amountAfterTax',
      header: 'Amount After Tax',
      accessor: (row: Dividend) =>
        new Intl.NumberFormat('en-PK', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0,
        }).format(parseNumber(row.amountAfterTax)),
    },
  ];

  if (loading)
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        Loading Graphs & Tables...
      </div>
    );
  if (error)
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-8 text-red-500">
        {error}
      </div>
    );

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-center sm:text-left">
          Dividends
        </h2>

        <div className="flex items-center justify-center sm:justify-end space-x-2">
          <span className="text-sm text-gray-600">Line Graph</span>

          <button
            onClick={() => setGraphType(graphType === 'line' ? 'bar' : 'line')}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
              graphType === 'bar' ? 'bg-blue-600' : 'bg-gray-300'
            } `}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                graphType === 'bar' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>

          <span className="text-sm text-gray-600">Bar Graph</span>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        <label>Date Range:</label>
        <select
          value={selectedDateFilter}
          onChange={(e) => {
            const next = e.target.value as DateFilterType;
            fetchDividendData(next);
          }}
          className="border border-gray-300 rounded-md p-2 text-sm w-full sm:w-auto"
        >
          <option value="3M">Last 3 Months (3M)</option>
          <option value="6M">Last 6 Months (6M)</option>
          <option value="1Y">Last 1 Year (1Y)</option>
          <option value="2Y">Last 2 Years (2Y)</option>
          <option value="5Y">Last 5 Years (5Y)</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {/* No records */}
      {dividendGraphs.length === 0 && (
        <div className="text-center text-gray-500 mt-4">No Records found.</div>
      )}

      {dividendGraphs.map((g) => {
        const startIdx = (g.currentPage - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const tableData = [...g.records].sort(
          (a, b) =>
            new Date(b.dateAnnounced).getTime() -
            new Date(a.dateAnnounced).getTime()
        );
        const paginatedData = tableData.slice(startIdx, endIdx);
        const totalPages = Math.ceil(g.records.length / PAGE_SIZE);

        const stockTotals = getStockWiseTotals(g.records);
        const rechartsData = stockTotals.map((s) => ({
          stock: s.stock,
          dividendValue: s.dividendValue,
          dividendPercentage: s.dividendPercentage,
          numberOfShares: s.numberOfShares,
          amountBeforeTax: s.amountBeforeTax,
          amountAfterTax: s.amountAfterTax,
        }));

        return (
          <div key={g.type} className="mb-10">
            <div className="flex items-center mb-2 gap-4">
              <h3 className="text-lg font-bold">Dividend Summary</h3>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={g.showTable}
                  onChange={() => toggleTable()}
                />
                <span>Show Table</span>
              </label>
            </div>

            {rechartsData.length > 0 ? (
              <>
                {graphType === 'line' ? (
                  <LineGraph
                    data={rechartsData}
                    xKey="stock"
                    lines={[
                      {
                        dataKey: 'dividendValue',
                        color: '#8884d8',
                        name: 'Dividend Value',
                      },
                      {
                        dataKey: 'amountBeforeTax',
                        color: '#82ca9d',
                        name: 'Amount Before Tax',
                      },
                      {
                        dataKey: 'amountAfterTax',
                        color: '#0088FE',
                        name: 'Amount After Tax',
                      },
                    ]}
                    xFormatter={(v) => String(v)}
                    height={350}
                  />
                ) : (
                  <BarGraph
                    data={rechartsData}
                    xKey="stock"
                    bars={[
                      {
                        dataKey: 'dividendValue',
                        color: '#8884d8',
                        name: 'Dividend Value',
                      },
                      {
                        dataKey: 'amountBeforeTax',
                        color: '#82ca9d',
                        name: 'Amount Before Tax',
                      },
                      {
                        dataKey: 'amountAfterTax',
                        color: '#0088FE',
                        name: 'Amount After Tax',
                      },
                    ]}
                    xFormatter={(v) => String(v)}
                    height={350}
                  />
                )}

                {g.showTable && (
                  <Table
                    data={paginatedData}
                    columns={columns}
                    currentPage={g.currentPage}
                    pageCount={totalPages}
                    onPageChange={(page) => handlePageChange(page)}
                  />
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 mt-2">
                No Records found.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
