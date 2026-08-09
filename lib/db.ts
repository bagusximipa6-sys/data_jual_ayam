import { db } from "@vercel/postgres";
import type {
  ActivityAction,
  ActivityLog,
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PenyusutanRecord,
  PriceHistory,
  StockInRecord,
  StockOutRecord,
  WeighingEntry,
} from "@/types/finance";

// === Tipe dataset lengkap ===
export type AppDataSet = {
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

// Helper konversi NUMERIC -> number
const num = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || 0 : 0;

// === Pastikan kolom baru ada (idempotent) ===
// Dipanggil sebelum load/save agar aplikasi tetap online walau DB produksi
// (Vercel) belum dimigrasi. Kolom baru `stock_in_id` ditambahkan jika belum ada.
export async function ensureStockInIdColumn(): Promise<void> {
  try {
    await db.sql`ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS stock_in_id TEXT DEFAULT ''`;
  } catch {
    // Abaikan bila gagal (mis. sudah ada / tidak punya izin) — query utama
    // akan tetap mencoba dan fallback di bawah.
  }
}

// === Tipe baris hasil query ===
type ItemRow = { id: string; name: string; buyPrice: number };
type BakulMasterRow = { id: string; name: string; sellPrice: number };
type StockInRow = {
  id: string;
  date: string;
  itemName: string;
  quantity: number;
  buyPrice: number;
  birdCount: number | null;
  weighings: WeighingEntry[] | null;
};
type StockOutRow = {
  id: string;
  date: string;
  bakulName: string;
  itemName: string;
  quantity: number;
  price: number;
  buyPrice: number;
  stockInId: string | null;
  saleType: string;
  paymentMethod: string;
  birdCount: number | null;
  weighings: WeighingEntry[] | null;
};
type PriceHistoryRow = {
  id: string;
  itemId: string;
  buyPrice: number;
  sellPrice: number;
  effectiveAt: string;
};
type PenyusutanRow = {
  id: string;
  date: string;
  itemName: string;
  expectedStock: number;
  actualStock: number;
  amount: number;
};
type SaleRow = {
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
type BakulRow = { date: string; name: string; bill: number; paid: number; balance: number; note: string };
type OpsRow = { date: string; description: string; amount: number; note: string };
type MetaRow = { opsCategories: string[] };

// === Load seluruh data dari DB ===
export async function loadAllData(): Promise<AppDataSet> {
  // Pastikan kolom baru ada sebelum query (agar tetap online walau belum migrasi).
  await ensureStockInIdColumn();

const [itemsR, bakulMastersR, stockInR, stockOutR, salesR, bakulRecordsR, opsR, metaR, penyusutanR, priceHistoryR] =
    await Promise.all([
      db.sql`SELECT id, name, sell_price AS "buyPrice" FROM items ORDER BY created_at ASC`,
      db.sql`SELECT id, name, address AS "sellPrice" FROM bakul_masters ORDER BY created_at ASC`,
      db.sql`SELECT id, date, item_name AS "itemName", quantity, buy_price AS "buyPrice", bird_count AS "birdCount", weighings FROM stock_in ORDER BY created_at ASC`,
db.sql`SELECT id, date, bakul_name AS "bakulName", item_name AS "itemName", quantity, price, buy_price AS "buyPrice", stock_in_id AS "stockInId", sale_type AS "saleType", payment_method AS "paymentMethod", bird_count AS "birdCount", weighings FROM stock_out ORDER BY created_at ASC`,
      db.sql`SELECT date, modal_qty AS "modalQty", modal_total AS "modalTotal", sale_qty AS "saleQty", sale_total AS "saleTotal", shrink, target, gross_profit AS "grossProfit", difference, operational, net_profit AS "netProfit", note FROM sales ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT date, name, bill, paid, balance, note FROM bakul_records ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT date, description, amount, note FROM ops_records ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT ops_categories AS "opsCategories" FROM app_meta WHERE id = 1`,
      db.sql`SELECT id, date, item_name AS "itemName", expected_stock AS "expectedStock", actual_stock AS "actualStock", amount FROM penyusutan ORDER BY created_at ASC`,
      db.sql`SELECT id, item_id AS "itemId", buy_price AS "buyPrice", sell_price AS "sellPrice", effective_at AS "effectiveAt" FROM price_history ORDER BY effective_at ASC, created_at ASC`,
    ]);

  const items: ItemMaster[] = (itemsR.rows as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    buyPrice: num(r.buyPrice),
  }));

  const bakulMasters: BakulMaster[] = (bakulMastersR.rows as unknown as BakulMasterRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    sellPrice: num(r.sellPrice),
  }));

const stockIn: StockInRecord[] = (stockInR.rows as unknown as StockInRow[]).map((r) => ({
    id: r.id,
    date: r.date,
    itemName: r.itemName,
    quantity: num(r.quantity),
    buyPrice: num(r.buyPrice),
    birdCount: r.birdCount != null ? num(r.birdCount) : undefined,
    weighings: Array.isArray(r.weighings) ? r.weighings : [],
  }));

const stockOut: StockOutRecord[] = (stockOutR.rows as unknown as StockOutRow[]).map((r) => ({
    id: r.id,
    date: r.date,
    bakulName: r.bakulName,
    itemName: r.itemName,
    quantity: num(r.quantity),
price: num(r.price),
    buyPrice: num(r.buyPrice),
    stockInId: r.stockInId != null && r.stockInId !== "" ? r.stockInId : undefined,
    saleType: (r.saleType === "grosir" ? "grosir" : "eceran") as "eceran" | "grosir",
    paymentMethod: (r.paymentMethod === "transfer"
      ? "transfer"
      : r.paymentMethod === "hutang"
      ? "hutang"
      : "cash") as "cash" | "transfer" | "hutang",
    birdCount: r.birdCount != null ? num(r.birdCount) : undefined,
    weighings: Array.isArray(r.weighings) ? r.weighings : [],
  }));

  const sales: DailySale[] = (salesR.rows as unknown as SaleRow[]).map((r) => ({
    date: r.date,
    modalQty: num(r.modalQty),
    modalTotal: num(r.modalTotal),
    saleQty: num(r.saleQty),
    saleTotal: num(r.saleTotal),
    shrink: num(r.shrink),
    target: num(r.target),
    grossProfit: num(r.grossProfit),
    difference: num(r.difference),
    operational: num(r.operational),
    netProfit: num(r.netProfit),
    note: r.note ?? "",
  }));

  const bakulRecords: BakulRecord[] = (bakulRecordsR.rows as unknown as BakulRow[]).map((r) => ({
    date: r.date,
    name: r.name,
    bill: num(r.bill),
    paid: num(r.paid),
    balance: num(r.balance),
    note: r.note ?? "",
  }));

  const ops: OperationalRecord[] = (opsR.rows as unknown as OpsRow[]).map((r) => ({
    date: r.date,
    description: r.description,
    amount: num(r.amount),
    note: r.note ?? "",
  }));

const metaRow = metaR.rows[0] as unknown as MetaRow | undefined;
  const opsCategories: string[] = Array.isArray(metaRow?.opsCategories)
    ? metaRow.opsCategories
    : [];

const penyusutan: PenyusutanRecord[] = (penyusutanR.rows as unknown as PenyusutanRow[]).map((r) => ({
    id: r.id,
    date: r.date,
    itemName: r.itemName,
    expectedStock: num(r.expectedStock),
    actualStock: num(r.actualStock),
    amount: num(r.amount),
  }));

  const priceHistory: PriceHistory[] = (priceHistoryR.rows as unknown as PriceHistoryRow[]).map((r) => ({
    id: r.id,
    itemId: r.itemId,
    buyPrice: num(r.buyPrice),
    sellPrice: num(r.sellPrice),
    effectiveAt: r.effectiveAt,
  }));

  return { sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, opsCategories, penyusutan, priceHistory };
}

// === Simpan seluruh data (transaksi atomik) ===
export async function saveAllData(data: AppDataSet): Promise<void> {
  // Pastikan kolom baru ada sebelum INSERT (agar save tidak gagal di DB lama).
  await ensureStockInIdColumn();

const {
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
  } = data;

const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`DELETE FROM items`;
    await client.sql`DELETE FROM bakul_masters`;
    await client.sql`DELETE FROM stock_in`;
    await client.sql`DELETE FROM stock_out`;
    await client.sql`DELETE FROM sales`;
    await client.sql`DELETE FROM bakul_records`;
    await client.sql`DELETE FROM ops_records`;
    await client.sql`DELETE FROM penyusutan`;
    await client.sql`DELETE FROM price_history`;

    // Items
    for (const item of items) {
      await client.sql`
        INSERT INTO items (id, name, sell_price) VALUES (${item.id}, ${item.name}, ${item.buyPrice})
      `;
    }
    // Bakul masters
    for (const m of bakulMasters) {
      await client.sql`
        INSERT INTO bakul_masters (id, name, address) VALUES (${m.id}, ${m.name}, ${String(m.sellPrice ?? 0)})
      `;
    }
// Stock in
    for (const r of stockIn) {
      await client.sql`
        INSERT INTO stock_in (id, date, item_name, quantity, buy_price, bird_count, weighings)
        VALUES (${r.id}, ${r.date}, ${r.itemName}, ${r.quantity}, ${r.buyPrice}, ${r.birdCount ?? null}, ${JSON.stringify(r.weighings ?? [])}::jsonb)
      `;
    }
// Stock out
    for (const r of stockOut) {
await client.sql`
        INSERT INTO stock_out (id, date, bakul_name, item_name, quantity, price, buy_price, stock_in_id, sale_type, payment_method, bird_count, weighings)
        VALUES (${r.id}, ${r.date}, ${r.bakulName}, ${r.itemName}, ${r.quantity}, ${r.price}, ${r.buyPrice ?? 0}, ${r.stockInId ?? ""}, ${r.saleType ?? "eceran"}, ${r.paymentMethod ?? "cash"}, ${r.birdCount ?? null}, ${JSON.stringify(r.weighings ?? [])}::jsonb)
      `;
    }
    // Price history
    for (const ph of priceHistory) {
      await client.sql`
        INSERT INTO price_history (id, item_id, buy_price, sell_price, effective_at)
        VALUES (${ph.id}, ${ph.itemId}, ${ph.buyPrice}, ${ph.sellPrice}, ${ph.effectiveAt})
      `;
    }
    // Sales
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      await client.sql`
        INSERT INTO sales (date, modal_qty, modal_total, sale_qty, sale_total, shrink, target, gross_profit, difference, operational, net_profit, note, position)
        VALUES (${s.date}, ${s.modalQty}, ${s.modalTotal}, ${s.saleQty}, ${s.saleTotal}, ${s.shrink}, ${s.target}, ${s.grossProfit}, ${s.difference}, ${s.operational}, ${s.netProfit}, ${s.note ?? ""}, ${i})
      `;
    }
    // Bakul records
    for (let i = 0; i < bakulRecords.length; i++) {
      const b = bakulRecords[i];
      await client.sql`
        INSERT INTO bakul_records (date, name, bill, paid, balance, note, position)
        VALUES (${b.date}, ${b.name}, ${b.bill}, ${b.paid}, ${b.balance}, ${b.note ?? ""}, ${i})
      `;
    }
// Ops records
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i];
      await client.sql`
        INSERT INTO ops_records (date, description, amount, note, position)
        VALUES (${o.date}, ${o.description}, ${o.amount}, ${o.note ?? ""}, ${i})
      `;
    }
    // Penyusutan
    for (const p of penyusutan) {
      await client.sql`
        INSERT INTO penyusutan (id, date, item_name, expected_stock, actual_stock, amount)
        VALUES (${p.id}, ${p.date}, ${p.itemName}, ${p.expectedStock}, ${p.actualStock}, ${p.amount})
      `;
    }
    // Meta (ops_categories JSONB)
    await client.sql`
      UPDATE app_meta SET ops_categories = ${JSON.stringify(opsCategories)}::jsonb, updated_at = now() WHERE id = 1
    `;
    await client.sql`COMMIT`;
  } catch (err) {
    await client.sql`ROLLBACK`;
    throw err;
  } finally {
    client.release();
  }
}

// === Tipe baris untuk activity_logs ===
type ActivityRow = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
};

// === Catat riwayat aktivitas (Alur Pengawasan) ===
// Tabel ini TIDAK dihapus saat saveAllData / resetAllData,
// sehingga riwayat audit tetap tersimpan untuk pemantauan admin.
export async function logActivity(input: {
  id: string;
  action: ActivityAction;
  entity: string;
  entityId?: string;
  summary: string;
  userEmail: string;
  userName: string;
}): Promise<void> {
  await db.sql`
    INSERT INTO activity_logs (id, action, entity, entity_id, summary, user_email, user_name)
    VALUES (${input.id}, ${input.action}, ${input.entity}, ${input.entityId ?? ""}, ${input.summary}, ${input.userEmail}, ${input.userName})
  `;
}

// === Ambil seluruh riwayat aktivitas (terbaru dulu) ===
export async function loadActivityLogs(): Promise<ActivityLog[]> {
  const result = await db.sql`
    SELECT id, action, entity, entity_id AS "entityId", summary, user_email AS "userEmail", user_name AS "userName", created_at AS "createdAt"
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 1000
  `;
  return (result.rows as unknown as ActivityRow[]).map((r) => ({
    id: r.id,
    action: (["add", "update", "delete", "reset"].includes(r.action) ? r.action : "add") as ActivityAction,
    entity: r.entity,
    entityId: r.entity_id ?? undefined,
    summary: r.summary,
    userEmail: r.user_email ?? "",
    userName: r.user_name ?? "",
    createdAt: r.created_at,
  }));
}

// === Reset seluruh data ke awal kosong ===
export async function resetAllData(): Promise<void> {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`DELETE FROM items`;
    await client.sql`DELETE FROM bakul_masters`;
    await client.sql`DELETE FROM stock_in`;
    await client.sql`DELETE FROM stock_out`;
    await client.sql`DELETE FROM sales`;
    await client.sql`DELETE FROM bakul_records`;
await client.sql`DELETE FROM ops_records`;
    await client.sql`DELETE FROM penyusutan`;
    await client.sql`DELETE FROM price_history`;
    await client.sql`UPDATE app_meta SET ops_categories = '[]'::jsonb, updated_at = now() WHERE id = 1`;
    await client.sql`COMMIT`;
  } catch (err) {
    await client.sql`ROLLBACK`;
    throw err;
  } finally {
    client.release();
  }
}
