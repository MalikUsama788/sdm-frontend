'use client';

import { useEffect, useState, useCallback } from 'react';
import type { MyTotalsWithIndex } from '@/types/myTotalsWithIndex';
import type { InvestmentLog } from '@/types/investmentLog';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Table from '@/app/components/Table';
import LineGraph from '@/app/components/LineGraph';
import BarGraph from '@/app/components/BarGraph';
import { format, startOfMonth, startOfYear, subDays, parse } from 'date-fns';

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

type DateFilterType = 'L30' | 'MTD' | 'YTD' | 'FYTD';

type IndexGraphData = {
  index: string;
  records: (MyTotalsWithIndex & {
    investment: number;
    __dateObj: Date;
    __dateKey: string;
    totatNowValue?: number;
  })[];
  showTable: boolean;
  currentPage: number;
  dateFilter: DateFilterType;
};

type PaginationMeta = {
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
};

type PaginatedResponse<T> = {
  data: T[];
  meta?: PaginationMeta;
};

type InvestmentLogWithTot = Omit<InvestmentLog, 'totatNow'> & {
  totatNow?: number;
};

export default function MyTotalsWithIndexPage() {
  const { data: session } = useSession();

  const [indexGraphs, setIndexGraphs] = useState<IndexGraphData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<DateFilterType>('L30');

  // Date Formatting
  const parseAnyDate = (d: string): Date => {
    const tryMd = parse(d, 'MM/dd/yyyy', new Date());
    if (!isNaN(tryMd.getTime())) return tryMd;
    return new Date(d);
  };

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

  // Get All Pages Records
  const fetchAllPages = useCallback(
    async <T,>(
      urlBase: string,
      commonQuery: Record<string, string>
    ): Promise<T[]> => {
      const pageSize = 100;
      let page = 1;
      let all: T[] = [];
      let totalPages = 1;

      while (page <= totalPages) {
        const params = new URLSearchParams({
          ...commonQuery,
          'pagination[page]': String(page),
          'pagination[pageSize]': String(pageSize),
        });

        const resp = await axios.get<PaginatedResponse<T>>(
          `${urlBase}?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${session?.jwt}` },
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

  // Get My Totals, Investment Logs and Merge
  const fetchData = useCallback(
    async (dateFilter: DateFilterType) => {
      if (!session?.jwt) return;

      try {
        setLoading(true);
        setError(null);
        setSelectedDateFilter(dateFilter);

        const startDate = getStartDate(dateFilter);

        // Fetch all My Totals records
        const myTotalsAll = await fetchAllPages<MyTotalsWithIndex>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/my-total-with-indices`,
          {
            sort: 'date:asc',
            'filters[date][$gte]': startDate,
          }
        );

        // Fetch all Investment Logs records
        const allInvestments = await fetchAllPages<InvestmentLogWithTot>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/investment-logs`,
          {
            sort: 'dateOfInvestment:asc',
            'filters[dateOfInvestment][$gte]': startDate,
          }
        );

        // Fetch last one from Investment Logs records based on applied filter
        const prevInvestmentResp = await axios.get<
          PaginatedResponse<InvestmentLogWithTot>
        >(`${process.env.NEXT_PUBLIC_STRAPI_URL}/api/investment-logs`, {
          headers: { Authorization: `Bearer ${session?.jwt}` },
          params: {
            sort: 'dateOfInvestment:desc',
            'filters[dateOfInvestment][$lt]': startDate,
            'pagination[pageSize]': '1',
          },
        });

        // Embed last one record data into Investments
        const prevInvestment = prevInvestmentResp.data.data[0];
        const investmentsAll = prevInvestment
          ? [prevInvestment, ...allInvestments]
          : allInvestments;

        // Get totatNow value from Investment Logs
        const normalizedInv = investmentsAll
          .map((inv) => {
            const dateObj = parseAnyDate(inv.dateOfInvestment);
            const dateKey = format(dateObj, 'yyyy-MM-dd');
            const tot = Number(inv.totatNow ?? 0);

            return {
              ...inv,
              __dateObj: dateObj,
              __dateKey: dateKey,
              totatNowValue: isNaN(tot) ? 0 : tot,
            };
          })
          // Ascending Order by date
          .sort((a, b) => a.__dateObj.getTime() - b.__dateObj.getTime());

        // Normalize My Totals records parse dates and create DateKey
        const normalizedMyTotals = myTotalsAll
          .map((r) => {
            const dateObj = parseAnyDate(r.date ?? '');
            const dateKey = format(dateObj, 'yyyy-MM-dd');
            return {
              ...r,
              __dateObj: dateObj,
              __dateKey: dateKey,
            };
          })
          .sort((a, b) => a.__dateObj.getTime() - b.__dateObj.getTime());

        // For My Totals records, find last investment Log with date <= record.date
        const mergedRecords = normalizedMyTotals.map((mt) => {
          let lastVal = 0;
          for (let i = 0; i < normalizedInv.length; i++) {
            if (
              normalizedInv[i].__dateObj.getTime() <= mt.__dateObj.getTime()
            ) {
              lastVal = normalizedInv[i].totatNowValue ?? 0;
            } else {
              break;
            }
          }
          return { ...mt, investment: lastVal };
        });

        setIndexGraphs([
          {
            index: 'Stocks',
            records: mergedRecords,
            showTable: false,
            currentPage: 1,
            dateFilter,
          },
        ]);
      } catch (err: unknown) {
        if (err instanceof Error)
          setError('Failed to load data: ' + err.message);
        else setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    },
    [session?.jwt, fetchAllPages]
  );

  // On Page Load
  useEffect(() => {
    fetchData('L30');
  }, [fetchData]);

  // Date filter change
  const handleDateFilterChange = (filter: DateFilterType) => {
    fetchData(filter);
  };

  // Show/Hide Table
  const toggleTable = (index: string) => {
    setIndexGraphs((prev) =>
      prev.map((g) =>
        g.index === index ? { ...g, showTable: !g.showTable } : g
      )
    );
  };

  // Page Change
  const handlePageChange = (index: string, page: number) => {
    setIndexGraphs((prev) =>
      prev.map((g) => (g.index === index ? { ...g, currentPage: page } : g))
    );
  };

  const columns = [
    {
      key: 'date',
      header: 'Date',
      accessor: (row: MyTotalsWithIndex & { investment?: number }) =>
        format(parseAnyDate(row.date), 'MMM d, yyyy'),
    },
    {
      key: 'index',
      header: 'Index',
      accessor: (row: MyTotalsWithIndex) => row.index,
    },
    {
      key: 'change',
      header: 'Index Change',
      accessor: (row: MyTotalsWithIndex) => row.change,
    },
    {
      key: 'type',
      header: 'Change Type',
      accessor: (row: MyTotalsWithIndex) => row.changeType,
    },
    {
      key: 'investment',
      header: 'Investment',
      accessor: (row: MyTotalsWithIndex & { investment?: number }) =>
        row.investment ?? '-',
    },
    {
      key: 'total',
      header: 'Total Value',
      accessor: (row: MyTotalsWithIndex) => row.totalToday,
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
          MyTotals With Index (Performance)
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
      {indexGraphs.length === 0 && (
        <div className="text-center text-gray-500 mt-4">No Records found.</div>
      )}

      {indexGraphs.map((g) => {
        const startIdx = (g.currentPage - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const tableData = [...g.records].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const paginatedData = tableData.slice(startIdx, endIdx);
        const totalPages = Math.ceil(g.records.length / PAGE_SIZE);

        return (
          <div key={g.index} className="mb-10">
            <div className="flex items-center mb-2 gap-4">
              <h3 className="text-lg font-bold">{g.index}</h3>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={g.showTable}
                  onChange={() => toggleTable(g.index)}
                />
                <span>Show Table</span>
              </label>
            </div>

            {g.records.length > 0 ? (
              <>
                {graphType === 'line' ? (
                  <LineGraph
                    data={g.records as unknown as Record<string, unknown>[]}
                    xKey="date"
                    lines={[
                      {
                        dataKey: 'totalToday',
                        color: '#8884d8',
                        name: 'Total Value',
                      },
                      {
                        dataKey: 'investment',
                        color: '#82ca9d',
                        name: 'Investment',
                      },
                    ]}
                    xFormatter={(d) => {
                      const dateObj = parseAnyDate(String(d));
                      return format(dateObj, 'MMM d');
                    }}
                    height={300}
                  />
                ) : (
                  <BarGraph
                    data={g.records as unknown as Record<string, unknown>[]}
                    xKey="date"
                    bars={[
                      {
                        dataKey: 'totalToday',
                        color: '#8884d8',
                        name: 'Total Value',
                      },
                      {
                        dataKey: 'investment',
                        color: '#82ca9d',
                        name: 'Investment',
                      },
                    ]}
                    xFormatter={(d) => {
                      const dateObj = parseAnyDate(String(d));
                      return format(dateObj, 'MMM d');
                    }}
                    height={300}
                  />
                )}

                {g.showTable && (
                  <Table
                    data={paginatedData}
                    columns={columns}
                    currentPage={g.currentPage}
                    pageCount={totalPages}
                    onPageChange={(page) => handlePageChange(g.index, page)}
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
