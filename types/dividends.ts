export interface Dividend {
  id: number;
  dateAnnounced: string;
  dateHoldStock: string;
  creditDate: string;
  dividendPercentage: string | number;
  dividendValue: string | number;
  numberOfShares: string | number;
  amountBeforeTax: string | number;
  amountAfterTax: string | number;
  stock: {
    stockCode: string;
  };
}
