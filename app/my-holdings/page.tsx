'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
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

  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summaryPage, setSummaryPage] = useState(1);

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

  const positiveNetData = aggregatedData.filter(
    (item) => item.bought - item.sold > 0
  );

  const summaryTotalPages = Math.ceil(positiveNetData.length / PAGE_SIZE);
  const paginatedSummary = positiveNetData.slice(
    (summaryPage - 1) * PAGE_SIZE,
    summaryPage * PAGE_SIZE
  );

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

  if (loadingSummary)
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
