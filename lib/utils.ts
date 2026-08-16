import { BakulMaster, BakulRecord, DailySale, ItemMaster, OperationalRecord, PenyusutanRecord, StockInRecord, StockOutRecord } from "@/types/finance";

export const resolveActiveStockIn = (
  stockIn: StockInRecord[],
  onDate: string
): StockInRecord | null => {
  const candidates = stockIn.filter((r) => r.date <= onDate);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[candidates.length - 1];
};

// === [BARU] FIFO Cerdas: temukan Barang Masuk yang masih punya sisa stok ===
// Logika:
// 1. Hitung total keluar untuk setiap batch Barang Masuk (`stockInId`).
// 2. Saring Barang Masuk pada tanggal transaksi (`onDate`) yang sisanya > 0.
// 3. Urutkan berdasarkan waktu input (asumsi ID tanggal > kecil = lebih dulu).
// 4. Kembalikan batch pertama yang tersedia (prinsip First-In, First-Out).
export const resolveAvailableStock = (
  allStockIn: StockInRecord[],
  allStockOut: StockOutRecord[],
  onDate: string,
  ignoredStockOutIds: Iterable<string> = []
): { record: StockInRecord; remaining: number } | null => {
  return resolveStockBatches(allStockIn, allStockOut, onDate, ignoredStockOutIds).find(
    (batch) => batch.remaining > 0
  ) ?? null;
};

export const resolveStockBatches = (
  allStockIn: StockInRecord[],
  allStockOut: StockOutRecord[],
  onDate: string,
  ignoredStockOutIds: Iterable<string> = []
): Array<{ record: StockInRecord; remaining: number; totalOut: number }> => {
  const ignoredIds = new Set(ignoredStockOutIds);
  const batches = allStockIn
    .filter((si) => si.date === onDate)
    .sort((a, b) => a.id.localeCompare(b.id));

  const totalOutByStockInId = new Map<string, number>();
  const legacyOut = allStockOut
    .filter((so) => !ignoredIds.has(so.id) && so.date === onDate && !so.stockInId)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const so of allStockOut) {
    if (ignoredIds.has(so.id) || so.date !== onDate) continue;

    if (so.stockInId) {
      totalOutByStockInId.set(so.stockInId, (totalOutByStockInId.get(so.stockInId) ?? 0) + so.quantity);
    }
  }

  for (const so of legacyOut) {
    let qtyLeft = so.quantity;
    const sameItemBatches = batches.filter((batch) => batch.itemName.toLowerCase() === so.itemName.toLowerCase());
    const targetBatches = sameItemBatches.length > 0 ? sameItemBatches : batches;

    for (const batch of targetBatches) {
      if (qtyLeft <= 0) break;
      const used = totalOutByStockInId.get(batch.id) ?? 0;
      const remaining = Math.max(0, batch.quantity - used);
      if (remaining <= 0) continue;

      const qtyFromBatch = Math.min(qtyLeft, remaining);
      totalOutByStockInId.set(batch.id, used + qtyFromBatch);
      qtyLeft -= qtyFromBatch;
    }
  }

  return batches.map((record) => {
    const totalOut = totalOutByStockInId.get(record.id) ?? 0;
    return {
      record,
      totalOut,
      remaining: Math.max(0, record.quantity - totalOut),
    };
  });
};

// === [BARU] FIFO Cerdas Lanjutan: dapatkan SEMUA batch yang masih punya sisa stok ===
// Logika: Sama seperti `resolveAvailableStock`, tapi mengembalikan semua batch yang
// tersedia, bukan hanya yang pertama. Ini penting untuk auto-splitting penjualan.
export const resolveAvailableStockBatches = (
  allStockIn: StockInRecord[],
  allStockOut: StockOutRecord[],
  onDate: string,
  ignoredStockOutIds: Iterable<string> = []
): Array<{ record: StockInRecord; remaining: number }> => {
  return resolveStockBatches(allStockIn, allStockOut, onDate, ignoredStockOutIds).filter(
    (batch) => batch.remaining > 0
  );
};

export const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export const shortNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);

export const toNumber = (value: string | number): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const v = value.trim();

  // Support arithmetic expressions like "40+50-10" (Data Timbangan / keypad kalkulator).
  // A single leading sign (e.g. "-5") is treated as a plain negative number.
  if (/[+-]/.test(v.replace(/^[+-]/, ""))) {
    const parts = v.split(/(?=[+-])/);
    let total = 0;
    for (const part of parts) {
      total += toNumber(part.replace(/^\+/, ""));
    }
    return total;
  }

  const fractionMatch = v.replace(/^[+-]/, "").match(/^(\d+(?:[.,]\d+)?)?\s*(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseFloat(fractionMatch[1].replace(",", ".")) : 0;
    const numer = parseInt(fractionMatch[2], 10);
    const denom = parseInt(fractionMatch[3], 10);
    if (denom > 0) return whole + numer / denom;
  }

  // Normalize comma decimal separator, then parse
  const normalized = v.replace(/[^0-9.,\-]/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
};

export const formatCurrencyInput = (value: string): string => {
  const clean = value.replace(/[^0-9]/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  return new Intl.NumberFormat("id-ID").format(num);
};

export const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

export const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// === Sisa stok harian per barang pada tanggal tertentu ===
// Daily Stock Reset: sisa = (Barang Masuk − Barang Terjual) pada tanggal tsb.
// Stok TIDAK dibawa ke hari berikutnya (no carry-over); sisa di akhir hari
// dianggap Penyusutan/Loss dan di-reset ke 0, sehingga modal hari esok murni
// 100% dari Barang Masuk tanggal esoknya.
export const computeDailyLeftover = (
  stockIn: StockInRecord[],
  stockOut: StockOutRecord[],
  date: string
): Array<{ itemName: string; leftover: number }> => {
  const map = new Map<string, number>();
  for (const r of stockIn) {
    if (r.date !== date) continue;
    const key = r.itemName.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + r.quantity);
  }
  for (const r of stockOut) {
    if (r.date !== date) continue;
    const key = r.itemName.toLowerCase();
    map.set(key, (map.get(key) ?? 0) - r.quantity);
  }
  const result: Array<{ itemName: string; leftover: number }> = [];
  for (const [key, leftover] of map.entries()) {
    if (leftover > 0) {
      const original = stockIn.find((r) => r.itemName.toLowerCase() === key)?.itemName ?? key;
      result.push({ itemName: original, leftover });
    }
  }
  return result;
};

// === Auto-generate catatan Penyusutan (Daily Closing / Stock Reset) ===
// Membuat record Penyusutan untuk setiap barang yang memiliki sisa > 0 pada
// tanggal penutupan (closingDate). Sisa stok di-reset ke 0 (loss) sehingga
// tidak carry-over ke hari berikutnya.
export const buildAutoPenyusutan = (
  stockIn: StockInRecord[],
  stockOut: StockOutRecord[],
  closingDate: string,
  existing: PenyusutanRecord[]
): PenyusutanRecord[] => {
  const leftovers = computeDailyLeftover(stockIn, stockOut, closingDate);
  // Hindari duplikat: jangan buat record untuk barang yang sudah punya catatan penyusutan pada tanggal tsb.
  const existingKeys = new Set(
    existing
      .filter((p) => p.date === closingDate)
      .map((p) => p.itemName.toLowerCase())
  );
  const newRecords: PenyusutanRecord[] = [];
  for (const { itemName, leftover } of leftovers) {
    const key = itemName.toLowerCase();
    if (existingKeys.has(key)) continue;
    newRecords.push({
      id: `PY-AUTO-${closingDate}-${key}-${Date.now()}`,
      date: closingDate,
      itemName,
      expectedStock: leftover,
      actualStock: 0,
      amount: leftover,
    });
  }
  return newRecords;
};

export const getMonthLabel = (dateStr: string) => {
  if (!dateStr || dateStr.length < 7) return dateStr;
  const [year, month] = dateStr.split("-");
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthNames[mIndex]} ${year}`;
  }
  return dateStr;
};

export const exportToCSV = <T extends Record<string, unknown>>(data: T[], filename: string) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const val = item[header];
        const stringVal = val === null || val === undefined ? "" : String(val);
        const escaped = stringVal.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToJSON = (
  sales: DailySale[],
  bakulRecords: BakulRecord[],
  ops: OperationalRecord[],
  items: ItemMaster[] = [],
  bakulMasters: BakulMaster[] = [],
  stockIn: StockInRecord[] = [],
  stockOut: StockOutRecord[] = [],
  opsCategories: string[] = [],
  penyusutan: PenyusutanRecord[] = [],
  filename: string = "buku_keuangan_backup"
) => {
  const payload = {
    version: 5,
    exportedAt: new Date().toISOString(),
    sales,
    bakulRecords,
    ops,
    items,
    bakulMasters,
    stockIn,
    stockOut,
    opsCategories,
    penyusutan,
  };
  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${getTodayDate()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
