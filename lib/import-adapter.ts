import type {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PenyusutanRecord,
  PriceHistory,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";
import { resolveActiveStockIn } from "@/lib/utils";

// ============================================================
// Adapter & Normalizer untuk Import / Restore Backup JSON.
//
// Masalah: setelah reset database, struktur tabel berubah (kolom baru
// `stock_in_id`, `buy_price`, `sale_type`, `payment_method`, dst.). Backup
// JSON lama tidak memiliki kolom tersebut, sehingga import langsung gagal
// (schema mismatch / missing field / referensi kosong).
//
// Solusi di sini:
//   1. Normalisasi: isi default untuk kolom baru, koersi angka, saring field.
//   2. Sinkronisasi relasi: pastikan setiap transaksi Penjualan (StockOut)
//      tertaut ke Barang Masuk (StockIn) yang aktif pada tanggal transaksi
//      (via `stockInId` + `itemName` + `buyPrice` dari Barang Masuk hari itu).
//   3. Urutan sudah benar karena data penjualan di-insert setelah master &
//      Barang Masuk (lihat saveAllData di lib/db.ts).
// ============================================================

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

const bool = (v: unknown, defaultValue = false): boolean =>
  typeof v === "boolean" ? v : defaultValue;

// === Normalisasi data lama -> struktur baru ===
export type NormalizedDataset = {
  sales: DailySale[];
  bakulRecords: BakulRecord[];
  ops: OperationalRecord[];
  items: ItemMaster[];
  bakulMasters: BakulMaster[];
  stockIn: StockInRecord[];
  stockOut: StockOutRecord[];
  opsCategories: string[];
  penyusutan: PenyusutanRecord[];
  priceHistory: PriceHistory[];
};

export function normalizeImportData(raw: unknown): NormalizedDataset | null {
  if (!raw || typeof raw !== "object") return null;

  const json = raw as Record<string, unknown>;

  // --- Items (Master Barang) ---
  const items: ItemMaster[] = (Array.isArray(json.items) ? json.items : []).map((it: unknown, i: number) => {
    const r = (it ?? {}) as Record<string, unknown>;
    return {
      id: str(r.id) || `import-item-${i}`,
      name: str(r.name) || `Barang ${i + 1}`,
      buyPrice: num(r.buyPrice ?? r.buy_price),
    };
  });

  // --- Bakul Masters (Master Pelanggan) ---
  const bakulMasters: BakulMaster[] = (Array.isArray(json.bakulMasters) ? json.bakulMasters : []).map(
    (b: unknown, i: number) => {
      const r = (b ?? {}) as Record<string, unknown>;
      return {
        id: str(r.id) || `import-bakul-${i}`,
        name: str(r.name) || `Bakul ${i + 1}`,
        sellPrice: num(r.sellPrice ?? r.sell_price),
      };
    }
  );

  // --- Stock In (Barang Masuk / Riwayat penerimaan) ---
  const stockIn: StockInRecord[] = (Array.isArray(json.stockIn) ? json.stockIn : []).map((si: unknown, i: number) => {
    const r = (si ?? {}) as Record<string, unknown>;
    return {
      id: str(r.id) || `import-si-${i}`,
      date: str(r.date),
      itemName: str(r.itemName ?? r.item_name),
      quantity: num(r.quantity),
      buyPrice: num(r.buyPrice ?? r.buy_price),
      birdCount: num(r.birdCount ?? r.bird_count) || undefined,
      weighings: Array.isArray(r.weighings) ? (r.weighings as StockInRecord["weighings"]) : [],
    };
  });

  // --- Stock Out (Barang Keluar / Penjualan) ---
  const stockOut: StockOutRecord[] = (Array.isArray(json.stockOut) ? json.stockOut : []).map(
    (so: unknown, i: number) => {
      const r = (so ?? {}) as Record<string, unknown>;
      return {
        id: str(r.id) || `import-so-${i}`,
        date: str(r.date),
        bakulName: str(r.bakulName ?? r.bakul_name),
        itemName: str(r.itemName ?? r.item_name),
        quantity: num(r.quantity),
        price: num(r.price),
        buyPrice: num(r.buyPrice ?? r.buy_price) || undefined,
        // Kolom baru di skema baru: referensi Barang Masuk (disinkronkan di bawah).
        stockInId: str(r.stockInId ?? r.stock_in_id ?? r.barang_masuk_id ?? "") || undefined,
        saleType: (r.saleType ?? r.sale_type ?? "eceran") === "grosir" ? "grosir" : "eceran",
        paymentMethod: (r.paymentMethod ?? r.payment_method ?? "cash") === "transfer"
          ? "transfer"
          : (r.paymentMethod ?? r.payment_method ?? "cash") === "hutang"
          ? "hutang"
          : "cash",
        birdCount: num(r.birdCount ?? r.bird_count) || undefined,
        weighings: Array.isArray(r.weighings) ? (r.weighings as StockOutRecord["weighings"]) : [],
      };
    }
  );

  // --- Sinkronisasi relasi: StockOut -> StockIn ---
  // Jalin referensi dinamis (foreign key) untuk setiap transaksi penjualan:
  // barang & harga beli (COGS) diambil dari Barang Masuk yang aktif pada
  // tanggal transaksi, supaya laporan modal akurat dan tidak "nyantol".
  if (stockIn.length > 0) {
    for (const so of stockOut) {
      const active = resolveActiveStockIn(stockIn, so.date);
      if (active) {
        so.stockInId = active.id;
        so.itemName = active.itemName;
        if (so.buyPrice == null || so.buyPrice <= 0) so.buyPrice = active.buyPrice;
      }
    }
  }

  // --- Sales (Rekap Penjualan lama) ---
  const sales: DailySale[] = (Array.isArray(json.sales) ? json.sales : []).map((s: unknown, i: number) => {
    const r = (s ?? {}) as Record<string, unknown>;
    return {
      date: str(r.date) || `import-${i}`,
      modalQty: num(r.modalQty ?? r.modal_qty),
      modalTotal: num(r.modalTotal ?? r.modal_total),
      saleQty: num(r.saleQty ?? r.sale_qty),
      saleTotal: num(r.saleTotal ?? r.sale_total),
      shrink: num(r.shrink),
      target: num(r.target),
      grossProfit: num(r.grossProfit ?? r.gross_profit),
      difference: num(r.difference),
      operational: num(r.operational),
      netProfit: num(r.netProfit ?? r.net_profit),
      note: str(r.note),
    };
  });

  // --- Bakul Records (Piutang) ---
  const bakulRecords: BakulRecord[] = (Array.isArray(json.bakulRecords) ? json.bakulRecords : []).map(
    (b: unknown) => {
      const r = (b ?? {}) as Record<string, unknown>;
      return {
        date: str(r.date),
        name: str(r.name),
        bill: num(r.bill),
        paid: num(r.paid),
        balance: num(r.balance),
        note: str(r.note),
      };
    }
  );

  // --- Ops (Biaya Operasional) ---
  const ops: OperationalRecord[] = (Array.isArray(json.ops) ? json.ops : []).map((o: unknown) => {
    const r = (o ?? {}) as Record<string, unknown>;
    return {
      date: str(r.date),
      description: str(r.description),
      amount: num(r.amount),
      note: str(r.note),
    };
  });

  // --- Penyusutan ---
  const penyusutan: PenyusutanRecord[] = (Array.isArray(json.penyusutan) ? json.penyusutan : []).map(
    (p: unknown, i: number) => {
      const r = (p ?? {}) as Record<string, unknown>;
      return {
        id: str(r.id) || `import-peny-${i}`,
        date: str(r.date),
        itemName: str(r.itemName ?? r.item_name),
        expectedStock: num(r.expectedStock ?? r.expected_stock),
        actualStock: num(r.actualStock ?? r.actual_stock),
        amount: num(r.amount),
      };
    }
  );

  // --- Price History ---
  const priceHistory: PriceHistory[] = (Array.isArray(json.priceHistory) ? json.priceHistory : []).map(
    (ph: unknown, i: number) => {
      const r = (ph ?? {}) as Record<string, unknown>;
      return {
        id: str(r.id) || `import-ph-${i}`,
        itemId: str(r.itemId ?? r.item_id),
        buyPrice: num(r.buyPrice ?? r.buy_price),
        sellPrice: num(r.sellPrice ?? r.sell_price),
        effectiveAt: str(r.effectiveAt ?? r.effective_at),
      };
    }
  );

  // --- OpsCategories ---
  const opsCategories: string[] = Array.isArray(json.opsCategories)
    ? (json.opsCategories as unknown[]).map((c) => str(c)).filter((c) => c.length > 0)
    : [];

  // Cek validitas minimal: setidaknya ada satu grup data berarti.
  const hasAny = [items, bakulMasters, stockIn, stockOut, sales, bakulRecords, ops, penyusutan].some(
    (arr) => arr.length > 0
  );
  if (!hasAny) return null;

  return {
    sales,
    bakulRecords,
    ops,
    items,
    bakulMasters,
    stockIn,
    stockOut,
    opsCategories,
    penyusutan,
    priceHistory,
  };
}
