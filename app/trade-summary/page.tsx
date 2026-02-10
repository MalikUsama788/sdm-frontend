'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Table from '@/app/components/Table';
import { Trade } from '@/types/trades';

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

type StockSummary = {
  stockCode: string;
  netQuantity: number;
  avgPrice: number;
  totalPrice: number;
};

function calculateStockSummaries(trades: Trade[]): StockSummary[] {
  const summaryMap: Record<
    string,
    { netQty: number; totalBuyQty: number; totalBuyCost: number }
  > = {};

  for (const trade of trades) {
    const code = trade.stock?.stockCode || 'N/A';
    if (!summaryMap[code]) {
      summaryMap[code] = { netQty: 0, totalBuyQty: 0, totalBuyCost: 0 };
    }
    const entry = summaryMap[code];

    const shares = Number(trade.numberOfShares);
    const rate = Number(trade.tradeRate);
    const type = String(trade.tradeType).toLowerCase();

    if (type === 'bought') {
      entry.netQty += shares;
      entry.totalBuyQty += shares;
      entry.totalBuyCost += shares * rate;
    } else if (type === 'sold') {
      entry.netQty -= shares;
    }
  }

  return Object.entries(summaryMap)
    .map(([stockCode, { netQty, totalBuyQty, totalBuyCost }]) => {
      const avgPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
      return {
        stockCode,
        netQuantity: netQty,
        avgPrice: Number(avgPrice.toFixed(2)),
        totalPrice: Number((avgPrice * netQty).toFixed(2)),
      };
    })
    .filter((s) => s.netQuantity !== 0);
}

export default function TradeSummaryPage() {
  const { data: session } = useSession();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const fetchTrades = useCallback(
    async (page: number) => {
      if (!session?.jwt) return;

      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/trades?populate=stock&sort=createdAt:asc&filters[user][id]=${session.user?.id}&pagination[pageSize]=${PAGE_SIZE}&pagination[page]=${page}`,
          {
            headers: { Authorization: `Bearer ${session.jwt}` },
          }
        );

        setTrades(response.data.data);
        setPageCount(response.data.meta?.pagination?.pageCount || 1);
      } catch {
        setError('Failed to fetch trades');
      } finally {
        setLoading(false);
      }
    },
    [session, PAGE_SIZE]
  );

  useEffect(() => {
    fetchTrades(page);
  }, [fetchTrades, page]);

  const summaries = calculateStockSummaries(trades);

  const columns = [
    {
      key: 'stock',
      header: 'Stock',
      accessor: (row: StockSummary) => row.stockCode,
    },
    {
      key: 'netQty',
      header: 'Net Quantity',
      accessor: (row: StockSummary) => row.netQuantity,
    },
    {
      key: 'avgPrice',
      header: 'Avg Price',
      accessor: (row: StockSummary) => row.avgPrice,
    },
    {
      key: 'totalPrice',
      header: 'Total Price',
      accessor: (row: StockSummary) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'PKR',
        }).format(row.totalPrice),
    },
  ];

  if (loading)
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        Loading stock summary...
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
        Stock Holdings Summary
      </h2>

      {summaries.length > 0 ? (
        <Table
          data={summaries}
          columns={columns}
          currentPage={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      ) : (
        <p className="text-gray-500 text-center py-4">No holdings found</p>
      )}
    </div>
  );
}
