'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { formatDateWithSuffix } from '@/utils/format';
import Table from '@/app/components/Table';
import { Trade, TradesResponse } from '@/types/trades';

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

interface AggregatedTrade {
  stockCode: string;
  stockTitle: string;
  bought: number;
  sold: number;
}

export default function Trades() {
  const { data: session } = useSession();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const [summaryPage, setSummaryPage] = useState(1);

  const fetchTrades = useCallback(
    async (page: number) => {
      if (!session?.jwt) return;

      try {
        setLoadingTrades(true);
        setError(null);

        const response = await axios.get<TradesResponse>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/trades?populate=stock&sort=createdAt:desc&pagination[pageSize]=${PAGE_SIZE}&pagination[page]=${page}&filters[user][id]=${session.user.id}`,
          {
            headers: {
              Authorization: `Bearer ${session.jwt}`,
            },
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
    [session]
  );

  const fetchAllTrades = useCallback(async () => {
    if (!session?.jwt) return;

    try {
      setLoadingSummary(true);
      setError(null);

      let allRecords: Trade[] = [];
      let page = 1;
      let totalPages = 1;
      const pageSize = 100;

      while (page <= totalPages) {
        const resp = await axios.get<TradesResponse>(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/trades?populate=stock&sort=createdAt:asc&filters[user][id]=${session.user.id}`,
          {
            headers: { Authorization: `Bearer ${session.jwt}` },
            params: {
              'pagination[page]': page,
              'pagination[pageSize]': pageSize,
            },
          }
        );

        allRecords = allRecords.concat(resp.data.data);
        totalPages = resp.data.meta?.pagination?.pageCount || 1;
        page++;
      }

      setAllTrades(allRecords);
    } catch (err: unknown) {
      if (err instanceof Error)
        setError('Failed to fetch all trades: ' + err.message);
      else setError('Failed to fetch all trades');
    } finally {
      setLoadingSummary(false);
    }
  }, [session]);

  useEffect(() => {
    fetchTrades(page);
  }, [fetchTrades, page]);

  useEffect(() => {
    fetchAllTrades();
  }, [fetchAllTrades]);

  // Aggregate Trades per Stock
  const aggregatedData: AggregatedTrade[] = allTrades.reduce((acc, trade) => {
    const stockCode = trade.stock?.stockCode || 'N/A';
    const existing = acc.find((s) => s.stockCode === stockCode);
    const shares = Number(trade.numberOfShares || 0);

    if (existing) {
      if (trade.tradeType === 'Bought') existing.bought += shares;
      else if (trade.tradeType === 'Sold') existing.sold += shares;
    } else {
      acc.push({
        stockCode,
        stockTitle: trade.stock?.stockTitle || '',
        bought: trade.tradeType === 'Bought' ? shares : 0,
        sold: trade.tradeType === 'Sold' ? shares : 0,
      });
    }

    return acc;
  }, [] as AggregatedTrade[]);

  const summaryTotalPages = Math.ceil(aggregatedData.length / PAGE_SIZE);
  const paginatedSummary = aggregatedData.slice(
    (summaryPage - 1) * PAGE_SIZE,
    summaryPage * PAGE_SIZE
  );

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

  const summaryColumns = [
    {
      key: 'stock',
      header: 'Stock',
      accessor: (row: AggregatedTrade) =>
        `${row.stockCode} - ${row.stockTitle}`,
    },
    {
      key: 'bought',
      header: 'Bought',
      accessor: (row: AggregatedTrade) => row.bought,
    },
    {
      key: 'sold',
      header: 'Sold',
      accessor: (row: AggregatedTrade) => row.sold,
    },
    {
      key: 'net',
      header: 'Net',
      accessor: (row: AggregatedTrade) => row.bought - row.sold,
    },
  ];

  if (loadingTrades || loadingSummary)
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

      <h2 className="text-xl font-semibold mb-4 text-center sm:text-left mt-4">
        Trades Summary
      </h2>

      {aggregatedData.length > 0 ? (
        <Table
          data={paginatedSummary}
          columns={summaryColumns}
          currentPage={summaryPage}
          pageCount={summaryTotalPages}
          onPageChange={setSummaryPage}
        />
      ) : (
        <p className="text-gray-500 text-center py-4">No Records found.</p>
      )}
    </div>
  );
}
