'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Table from '@/app/components/Table';

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE) || 5;

type Stock = {
  id: number;
  stockCode: string;
  stockTitle: string;
};

type Trade = {
  id: number;
  stock: Stock;
  tradeType: 'Buy' | 'Sell';
  numberOfShares: number;
  tradeRate: number;
};

type Holding = {
  stock: Stock;
  shares: number;
  avgBuyRate: number;
};

function calculateHoldings(trades: Trade[]): Holding[] {
  const holdingsMap: Record<
    string,
    {
      stock: Stock;
      shares: number;
      totalBuyAmount: number;
      totalBuyShares: number;
    }
  > = {};

  trades.forEach((trade) => {
    const key = trade.stock.stockCode;

    if (!holdingsMap[key]) {
      holdingsMap[key] = {
        stock: trade.stock,
        shares: 0,
        totalBuyAmount: 0,
        totalBuyShares: 0,
      };
    }

    if (trade.tradeType === 'Buy') {
      holdingsMap[key].shares += trade.numberOfShares;
      holdingsMap[key].totalBuyAmount += trade.numberOfShares * trade.tradeRate;
      holdingsMap[key].totalBuyShares += trade.numberOfShares;
    } else if (trade.tradeType === 'Sell') {
      holdingsMap[key].shares -= trade.numberOfShares;
    }
  });

  return Object.values(holdingsMap)
    .filter((h) => h.shares > 0)
    .map((h) => ({
      stock: h.stock,
      shares: h.shares,
      avgBuyRate:
        h.totalBuyShares > 0 ? h.totalBuyAmount / h.totalBuyShares : 0,
    }));
}

export default function HoldingsPage() {
  const { data: session } = useSession();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const fetchTrades = useCallback(
    async (page: number) => {
      if (!session?.jwt || !session?.user?.id) return;

      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/trades?populate=stock&sort=createdAt:asc&pagination[pageSize]=${PAGE_SIZE}&pagination[page]=${page}&filters[user][id]=${session.user.id}`,
          {
            headers: { Authorization: `Bearer ${session.jwt}` },
          }
        );

        const trades: Trade[] = response.data.data;
        const calculatedHoldings = calculateHoldings(trades);
        setHoldings(calculatedHoldings);
        setPageCount(response.data.meta?.pagination?.pageCount || 1);
      } catch {
        setError('Failed to fetch holdings');
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    fetchTrades(page);
  }, [fetchTrades, page]);

  const columns = [
    {
      key: 'stock',
      header: 'Stock',
      accessor: (h: Holding) => `${h.stock.stockCode} – ${h.stock.stockTitle}`,
    },
    { key: 'shares', header: 'Shares', accessor: (h: Holding) => h.shares },
    {
      key: 'avgBuyRate',
      header: 'Avg Buy Rate',
      accessor: (h: Holding) =>
        new Intl.NumberFormat('en-PK', {
          style: 'currency',
          currency: 'PKR',
          minimumFractionDigits: 2,
        }).format(h.avgBuyRate),
    },
  ];

  if (loading)
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        Loading holdings...
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
        Current Holdings
      </h2>

      {holdings.length > 0 ? (
        <Table
          data={holdings}
          columns={columns}
          currentPage={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      ) : (
        <p className="text-gray-500 text-center py-4">No holdings available</p>
      )}
    </div>
  );
}
