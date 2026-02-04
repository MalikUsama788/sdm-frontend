export interface Trade {
    id: number;
    documentId: string;
    numberOfShares: number;
    tradeRate: number;
    boughtDate: string;
    totalInvestmentAtTime: string;
    createdAt: string;
    tradeType: string;
    updatedAt: string;
    publishedAt: string;
    stock: {
        id: number;
        documentId: string;
        stockCode: string;
        stockTitle: string;
        createdAt: string;
        updatedAt: string;
        publishedAt: string;
    };
}

export interface TradesResponse {
    data: Trade[];
    meta: {
        pagination: {
            page: number;
            pageSize: number;
            pageCount: number;
            total: number;
        };
    };
}