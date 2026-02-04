'use client';

import { useEffect, useState } from 'react';
import type { MutualFundsTotal } from '@/types/mutualFundsTotal';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Table from '@/app/components/Table';
import LineGraph from '@/app/components/LineGraph';
import BarGraph from '@/app/components/BarGraph';
import { format, startOfMonth, startOfYear, subDays } from 'date-fns';

type DateFilterType = 'L30' | 'MTD' | 'YTD' | 'FYTD';

type FundGraphData = {
  fund: string;
  records: MutualFundsTotal[];
  showTable: boolean;
  currentPage: number;
  dateFilter: DateFilterType;
};

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

export default function MutualFundsTotalsPage() {
  const { data: session } = useSession();

  const [fundGraphs, setFundGraphs] = useState<FundGraphData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<DateFilterType>('L30');

  // Date filter
  const getStartDate = (filter: DateFilterType): string => {
    const today = new Date();
    let startDate: Date;

    switch (filter) {
      case 'L30':
        startDate = subDays(today, 30);
        break;
      case 'MTD':
        startDate = startOfMonth(today);
        break;
      case 'YTD':
        startDate = startOfYear(today);
        break;
      case 'FYTD':
        startDate =
          today.getMonth() >= 6
            ? new Date(today.getFullYear(), 6, 1)
            : new Date(today.getFullYear() - 1, 6, 1);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return format(startDate, 'yyyy-MM-dd');
  };

  // Get Funds
  const fetchFundData = async (dateFilter: DateFilterType) => {
    if (!session?.jwt) return;

    try {
      setLoading(true);
      setError(null);
      setSelectedDateFilter(dateFilter);

      const startDate = getStartDate(dateFilter);
      const pageSize = 100;
      let page = 1;
      let allRecords: MutualFundsTotal[] = [];
      let totalPages = 1;

      while (page <= totalPages) {
        const query = new URLSearchParams({
          sort: 'date:asc',
          'pagination[page]': page.toString(),
          'pagination[pageSize]': pageSize.toString(),
          'filters[date][$gte]': format(startDate, 'yyyy-MM-dd'),
        });

        const response = await axios.get<{
          data: MutualFundsTotal[];
          meta: { pagination: { pageCount: number } };
        }>(
          `${
            process.env.NEXT_PUBLIC_STRAPI_URL
          }/api/my-mutual-funds-totals?${query.toString()}`,
          {
            headers: { Authorization: `Bearer ${session.jwt}` },
          }
        );

        allRecords = allRecords.concat(response.data.data);
        totalPages = response.data.meta.pagination.pageCount;
        page++;
      }

      if (allRecords.length === 0) {
        setFundGraphs([]);
      } else {
        const allFunds = Array.from(new Set(allRecords.map((r) => r.fund)));
        const grouped: FundGraphData[] = allFunds.map((f) => ({
          fund: f,
          records: allRecords.filter((r) => r.fund === f),
          showTable: false,
          currentPage: 1,
          dateFilter,
        }));
        setFundGraphs(grouped);
      }
    } catch (err) {
      setError('Failed to load fund data: ' + err);
    } finally {
      setLoading(false);
    }
  };

  // On Page Load
  useEffect(() => {
    fetchFundData('L30');
  }, [session]);

  // Date filter change
  const handleDateFilterChange = (filter: DateFilterType) => {
    fetchFundData(filter);
  };

  // Show/Hide Table
  const toggleTable = (fund: string) => {
    setFundGraphs((prev) =>
      prev.map((g) => (g.fund === fund ? { ...g, showTable: !g.showTable } : g))
    );
  };

  // Page Change
  const handlePageChange = (fund: string, page: number) => {
    setFundGraphs((prev) =>
      prev.map((g) => (g.fund === fund ? { ...g, currentPage: page } : g))
    );
  };

  const columns = [
    {
      key: 'date',
      header: 'Date',
      accessor: (row: MutualFundsTotal) =>
        format(new Date(row.date), 'MMM d, yyyy'),
    },
    {
      key: 'fund',
      header: 'Fund Type',
      accessor: (row: MutualFundsTotal) => row.fund,
    },
    {
      key: 'totalAtTime',
      header: 'Investment',
      accessor: (row: MutualFundsTotal) => row.totalAtTime,
    },
    {
      key: 'amount',
      header: 'Total Value',
      accessor: (row: MutualFundsTotal) => row.amount,
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
          Mutual Funds Performance
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
          onChange={(e) =>
            handleDateFilterChange(e.target.value as DateFilterType)
          }
          className="border border-gray-300 rounded-md p-2 text-sm w-full sm:w-auto"
        >
          <option value="L30">Last 30 Days (L30)</option>
          <option value="MTD">Month to Date (MTD)</option>
          <option value="YTD">Year to Date (YTD)</option>
          <option value="FYTD">Fiscal Year to Date (FYTD)</option>
        </select>
      </div>

      {/* No records for date range */}
      {fundGraphs.length === 0 && (
        <div className="text-center text-gray-500 mt-4">No Records found.</div>
      )}

      {fundGraphs.map((g) => {
        const startIdx = (g.currentPage - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const tableData = [...g.records].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const paginatedData = tableData.slice(startIdx, endIdx);
        const totalPages = Math.ceil(g.records.length / PAGE_SIZE);

        return (
          <div key={g.fund} className="mb-10">
            <div className="flex items-center mb-2 gap-4">
              <h3 className="text-lg font-bold">{g.fund}</h3>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={g.showTable}
                  onChange={() => toggleTable(g.fund)}
                />
                <span>Show Table</span>
              </label>
            </div>

            {g.records.length > 0 ? (
              <>
                {graphType === 'line' ? (
                  <LineGraph
                    data={g.records}
                    xKey="date"
                    lines={[
                      {
                        dataKey: 'totalAtTime',
                        color: '#8884d8',
                        name: 'Investment',
                      },
                      {
                        dataKey: 'amount',
                        color: '#82ca9d',
                        name: 'Total Value',
                      },
                    ]}
                    xFormatter={(d) => format(new Date(d), 'MMM d')}
                    height={300}
                  />
                ) : (
                  <BarGraph
                    data={g.records}
                    xKey="date"
                    bars={[
                      {
                        dataKey: 'totalAtTime',
                        color: '#8884d8',
                        name: 'Investment',
                      },
                      {
                        dataKey: 'amount',
                        color: '#82ca9d',
                        name: 'Total Value',
                      },
                    ]}
                    xFormatter={(d) => format(new Date(d), 'MMM d')}
                    height={300}
                  />
                )}

                {g.showTable && (
                  <Table
                    data={paginatedData}
                    columns={columns}
                    currentPage={g.currentPage}
                    pageCount={totalPages}
                    onPageChange={(page) => handlePageChange(g.fund, page)}
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
