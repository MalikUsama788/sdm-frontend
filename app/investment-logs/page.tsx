'use client';

import { useEffect, useState } from 'react';
import type { InvestmentLog } from '@/types/investmentLog';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Table from '@/app/components/Table';
import LineGraph from '@/app/components/LineGraph';
import BarGraph from '@/app/components/BarGraph';
import { parse, isValid, format } from 'date-fns';

type DateFilterType = 'Monthly' | 'Yearly';

type GraphData = {
  year: string;
  cumulativeInvestment: number;
};

type InvestmentGraphData = {
  type: string;
  records: InvestmentLog[];
  showTable: boolean;
  currentPage: number;
};

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

export default function InvestmentLogsPage() {
  const { data: session } = useSession();

  const [investmentData, setInvestmentData] = useState<InvestmentGraphData[]>(
    []
  );
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<DateFilterType>('Monthly');

  // Date Formatting
  const formatDateSafe = (d: string) => {
    if (!d) return null;
    let dateObj = parse(d, 'MM/dd/yyyy', new Date());
    if (!isValid(dateObj)) {
      dateObj = new Date(d);
    }
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : '-';
  };

  // Get Dividends
  const fetchAllInvestmentLogs = async () => {
    if (!session?.jwt) return;

    try {
      setLoading(true);
      setError(null);

      let allRecords: InvestmentLog[] = [];
      let page = 1;
      let totalPages = 1;
      const pageSize = 100;

      while (page <= totalPages) {
        const resp = await axios.get<{ data: InvestmentLog[]; meta?: any }>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/investment-logs`,
          {
            headers: { Authorization: `Bearer ${session.jwt}` },
            params: {
              'pagination[page]': page,
              'pagination[pageSize]': pageSize,
              sort: 'dateOfInvestment:asc',
              'filters[investmentType][$eq]': 'SIP',
            },
          }
        );

        allRecords = allRecords.concat(resp.data.data);
        totalPages = resp.data.meta?.pagination?.pageCount || 1;
        page++;
      }

      setInvestmentData([
        {
          type: 'SIP',
          records: allRecords,
          showTable: false,
          currentPage: 1,
        },
      ]);
    } catch (err: any) {
      setError('Failed to load investment logs: ' + (err.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  // On Page Load
  useEffect(() => {
    fetchAllInvestmentLogs();
  }, [session]);

  // Date filter change
  const handleDateFilterChange = (filter: DateFilterType) => {
    setSelectedDateFilter(filter);
  };

  // Show/Hide Table
  const toggleTable = (type: string) => {
    setInvestmentData((prev) =>
      prev.map((d) => (d.type === type ? { ...d, showTable: !d.showTable } : d))
    );
  };

  // Page Change
  const handlePageChange = (type: string, page: number) => {
    setInvestmentData((prev) =>
      prev.map((d) => (d.type === type ? { ...d, currentPage: page } : d))
    );
  };

  // Prepare Yearly Data for Graph
  const getYearlyCumulative = (records: InvestmentLog[]): GraphData[] => {
    const sorted = records
      .map((r) => {
        let dateObj = new Date(r.dateOfInvestment);
        if (!isValid(dateObj)) {
          dateObj = parse(r.dateOfInvestment, 'MM/dd/yyyy', new Date());
        }
        return {
          ...r,
          dateObj,
          amount: Number(r.amountInvested ?? 0),
        };
      })
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    if (selectedDateFilter === 'Yearly') {
      const yearMap = new Map<string, number>();
      let cumulative = 0;
      sorted.forEach((r) => {
        const yr = String(r.dateObj.getFullYear());
        cumulative += r.amount;
        yearMap.set(yr, cumulative);
      });

      return Array.from(yearMap.entries())
        .sort(([y1], [y2]) => y1.localeCompare(y2))
        .map(([year, cumulativeInvestment]) => ({
          year,
          cumulativeInvestment,
        }));
    } else {
      const monthMap = new Map<string, number>();
      let cumulative = 0;
      sorted.forEach((r) => {
        const monthKey = format(r.dateObj, 'yyyy-MM');
        cumulative += r.amount;
        monthMap.set(monthKey, cumulative);
      });

      return Array.from(monthMap.entries())
        .sort(([m1], [m2]) => m1.localeCompare(m2))
        .map(([month, cumulativeInvestment]) => ({
          year: month,
          cumulativeInvestment,
        }));
    }
  };

  const columns = [
    {
      key: 'dateOfInvestment',
      header: 'Date of Investment',
      accessor: (row: InvestmentLog) => formatDateSafe(row.dateOfInvestment),
    },
    {
      key: 'amountInvested',
      header: 'Amount Invested',
      accessor: (row: InvestmentLog) =>
        new Intl.NumberFormat('en-PK', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 0,
        }).format(Number(row.amountInvested)),
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
          SIP Investment Logs
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

      {/* Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        <label>Date Range:</label>
        <select
          value={selectedDateFilter}
          onChange={(e) =>
            handleDateFilterChange(e.target.value as DateFilterType)
          }
          className="border border-gray-300 rounded-md p-2 text-sm w-full sm:w-auto"
        >
          <option value="Monthly">Monthly</option>
          <option value="Yearly">Yearly</option>
        </select>
      </div>

      {investmentData.map((data) => {
        const startIdx = (data.currentPage - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const tableData = [...data.records].sort(
          (a, b) =>
            new Date(b.dateOfInvestment).getTime() -
            new Date(a.dateOfInvestment).getTime()
        );
        const paginatedData = tableData.slice(startIdx, endIdx);
        const totalPages = Math.ceil(data.records.length / PAGE_SIZE);

        const yearlyData = getYearlyCumulative(data.records).map((d) => ({
          year: String(d.year),
          cumulativeInvestment: d.cumulativeInvestment,
        }));

        return (
          <div key={data.type} className="mb-10">
            <div className="flex items-center mb-2 gap-4">
              <h3 className="text-lg font-bold">{data.type}</h3>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={data.showTable}
                  onChange={() => toggleTable(data.type)}
                />
                <span>Show Table</span>
              </label>
            </div>

            {yearlyData.length > 0 ? (
              <>
                {graphType === 'line' ? (
                  <LineGraph
                    data={yearlyData}
                    xKey="year"
                    lines={[
                      {
                        dataKey: 'cumulativeInvestment',
                        color: '#82ca9d',
                        name: 'Total Investment',
                      },
                    ]}
                    xFormatter={(d) => d}
                    height={300}
                  />
                ) : (
                  <BarGraph
                    data={yearlyData}
                    xKey="year"
                    bars={[
                      {
                        dataKey: 'cumulativeInvestment',
                        color: '#82ca9d',
                        name: 'Total Investment',
                      },
                    ]}
                    xFormatter={(d) => d}
                    height={300}
                  />
                )}

                {data.showTable && (
                  <Table
                    data={paginatedData}
                    columns={columns}
                    currentPage={data.currentPage}
                    pageCount={totalPages}
                    onPageChange={(page) => handlePageChange(data.type, page)}
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
