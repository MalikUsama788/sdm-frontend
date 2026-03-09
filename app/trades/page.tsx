'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { formatDateWithSuffix } from '@/utils/format';
import Table from '@/app/components/Table';
import { Trade, TradesResponse } from '@/types/trades';

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

export default function Trades() {
  const { data: session } = useSession();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const [search, setSearch] = useState('');
  const [tradeType, setTradeType] = useState('');

  const fetchTrades = useCallback(
    async (page: number) => {
      if (!session?.jwt) return;

      try {
        setLoadingTrades(true);
        setError(null);

        const params: any = {
          'pagination[pageSize]': PAGE_SIZE,
          'pagination[page]': page,
          sort: 'createdAt:desc',
          populate: 'stock',
          'filters[user][id]': session.user.id,
        };

        if (search) {
          params['filters[stock][stockCode][$containsi]'] = search;
        }

        if (tradeType) {
          params['filters[tradeType][$eq]'] = tradeType;
        }

        const response = await axios.get<TradesResponse>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/trades`,
          {
            headers: {
              Authorization: `Bearer ${session.jwt}`,
            },
            params,
          }
        );

        setTrades(response.data.data);
        setPageCount(response.data.meta?.pagination?.pageCount || 1);
      } catch (err: unknown) {
        if (err instanceof Error)
          setError('Failed to fetch trades: ' + err.message);
        else setError('Failed to fetch trades');
      } finally {
        setLoadingTrades(false);
      }
    },
    [session, search, tradeType]
  );

  useEffect(() => {
    fetchTrades(page);
  }, [fetchTrades, page]);

  const tradeColumns = [
    {
      key: 'stock',
      header: 'Stock',
      accessor: (row: Trade) =>
        `${row.stock?.stockCode || 'N/A'} - ${row.stock?.stockTitle || ''}`,
    },
    {
      key: 'shares',
      header: 'Shares',
      accessor: (row: Trade) => row.numberOfShares,
    },
    { key: 'rate', header: 'Rate', accessor: (row: Trade) => row.tradeRate },
    { key: 'type', header: 'Type', accessor: (row: Trade) => row.tradeType },
    {
      key: 'investment',
      header: 'Investment',
      accessor: (row: Trade) => row.totalInvestmentAtTime,
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (row: Trade) => formatDateWithSuffix(row.createdAt),
    },
  ];

  if (loadingTrades)
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        Loading Table...
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
      <h2 className="text-xl font-semibold mb-4 text-center sm:text-left">
        Trades
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        {/* Stock Search */}
        <input
          type="text"
          placeholder="Search Stock (e.g. OGDC)"
          defaultValue={search}
          onBlur={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch((e.target as HTMLInputElement).value);
              setPage(1);
            }
          }}
          className="border border-gray-300 rounded-md p-1 w-full sm:w-auto md:w-64"
        />

        {/* Trade Type Filter */}
        <select
          value={tradeType}
          onChange={(e) => {
            setTradeType(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md p-2 text-sm w-full sm:w-auto"
        >
          <option value="">All</option>
          <option value="Bought">Bought</option>
          <option value="Sold">Sold</option>
        </select>
      </div>

      {trades.length > 0 ? (
        <Table
          data={trades}
          columns={tradeColumns}
          currentPage={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      ) : (
        <p className="text-gray-500 text-center py-4">No Records found.</p>
      )}
    </div>
  );
}
