export type DailySale = {
  date: string;
  modalQty: number;
  modalTotal: number;
  saleQty: number;
  saleTotal: number;
  shrink: number;
  target: number;
  grossProfit: number;
  difference: number;
  operational: number;
  netProfit: number;
  note: string;
};

export type BakulRecord = {
  date: string;
  name: string;
  bill: number;
  paid: number;
  balance: number;
  note: string;
};

export type OperationalRecord = {
  date: string;
  description: string;
  amount: number;
  note: string;
};

export type Role = "user" | "admin";

export type FinanceSummary = {
  modal: number;
  penjualan: number;
  opFromSales: number;
  opDetail: number;
  labaKotor: number;
  labaBersih: number;
  piutang: number;
  dibayar: number;
  target: number;
  penyusutan: number;
};

export type BakulSummaryItem = {
  name: string;
  bill: number;
  paid: number;
  balance: number;
  count: number;
};
