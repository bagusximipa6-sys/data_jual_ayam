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

// Tipe dataset yang dikirim ke / disinkronkan dari server.
// Catatan: `piutangPayments` TIDAK disimpan di backend Postgres,
// sehingga tetap disimpan secara lokal di localStorage per perangkat.
export type LocalDataset = {
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

export type SyncStatus =
  | "loading" // mengambil data awal dari server
  | "saving" // sedang menyimpan ke server
  | "saved" // tersimpan di server
  | "error" // gagal menyimpan
  | "offline"; // tidak terhubung ke server

const EMPTY: LocalDataset = {
  sales: [],
  bakulRecords: [],
  ops: [],
  items: [],
  bakulMasters: [],
  stockIn: [],
  stockOut: [],
  opsCategories: [],
  penyusutan: [],
  priceHistory: [],
};

// Mengambil seluruh data dari endpoint server GET /api/data.
// Mengembalikan null jika gagal / tidak ada data.
export async function fetchAllFromServer(): Promise<Partial<LocalDataset> | null> {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: Partial<LocalDataset> };
    if (!json.ok || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

// Menyimpan seluruh data ke server POST /api/data.
// `opts.force = true` digunakan untuk Restore/Import penuh (oleh admin):
// menonaktifkan Guard Penguncian Harian agar data tanggal lampau dari backup
// dapat ditulis. Mengembalikan { ok: boolean; error?: string }.
export async function pushAllToServer(
  data: LocalDataset,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, force: opts.force === true }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok !== true) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal terhubung ke server." };
  }
}

// Memeriksa apakah server sudah memiliki data (tidak kosong).
export function hasAnyServerData(d: Partial<LocalDataset> | null): boolean {
  if (!d) return false;
  const arrays: unknown[][] = [
    d.sales as unknown[],
    d.bakulRecords as unknown[],
    d.ops as unknown[],
    d.items as unknown[],
    d.bakulMasters as unknown[],
    d.stockIn as unknown[],
    d.stockOut as unknown[],
  ];
  const hasData =
    arrays.some((arr) => Array.isArray(arr) && arr.length > 0) ||
    (Array.isArray(d.opsCategories) && d.opsCategories.length > 0);
  return hasData;
}

// Membangun dataset lokal default (kosong) untuk fallback.
export function emptyDataset(): LocalDataset {
  return {
    sales: [...EMPTY.sales],
    bakulRecords: [...EMPTY.bakulRecords],
    ops: [...EMPTY.ops],
    items: [...EMPTY.items],
    bakulMasters: [...EMPTY.bakulMasters],
    stockIn: [...EMPTY.stockIn],
stockOut: [...EMPTY.stockOut],
    opsCategories: [...EMPTY.opsCategories],
    penyusutan: [...EMPTY.penyusutan],
    priceHistory: [...EMPTY.priceHistory],
  };
}

