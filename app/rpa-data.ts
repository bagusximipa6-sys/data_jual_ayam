import {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PiutangPayment,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

export const initialSales: DailySale[] = [];

export const initialOpsCategories: string[] = [
  "Bensin + Parkir",
  "Konsumsi",
  "Perawatan",
  "Gaji",
  "Listrik & Air",
  "Lainnya",
];

export const initialBakulRecords: BakulRecord[] = [];

export const initialOperationalRecords: OperationalRecord[] = [
  { date: "2025-01-05", description: "Bensin + Parkir", amount: 150000, note: "Bensin mobil antar barang" },
];

export const initialItems: ItemMaster[] = [
  { id: "item-1", name: "Telur Ayam Broiler", buyPrice: 26000, sellPrice: 28000 },
  { id: "item-2", name: "Telur Ayam Kampung", buyPrice: 32000, sellPrice: 35000 },
  { id: "item-3", name: "Telur Bebek", buyPrice: 30000, sellPrice: 33000 },
];

export const initialBakulMasters: BakulMaster[] = [
  { id: "bakul-1", name: "Bu Sari", address: "Pasar Induk" },
  { id: "bakul-2", name: "Pak Joko", address: "Toko Sembako" },
];

export const initialStockIn: StockInRecord[] = [
  { id: "in-1", date: "2025-01-05", itemName: "Telur Ayam Broiler", quantity: 100 },
  { id: "in-2", date: "2025-01-05", itemName: "Telur Ayam Kampung", quantity: 50 },
];

export const initialStockOut: StockOutRecord[] = [
  { id: "out-1", date: "2025-01-05", bakulName: "Bu Sari", itemName: "Telur Ayam Broiler", quantity: 40, price: 28000, saleType: "eceran" },
  { id: "out-2", date: "2025-01-05", bakulName: "Pak Joko", itemName: "Telur Ayam Kampung", quantity: 20, price: 35000, saleType: "grosir" },
  { id: "out-3", date: "2025-01-05", bakulName: "Bu Sari", itemName: "Telur Bebek", quantity: 15, price: 33000, saleType: "eceran" },
];

export const initialPiutangPayments: PiutangPayment[] = [];
