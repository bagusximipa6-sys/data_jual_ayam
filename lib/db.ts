import { db, type VercelPoolClient } from "@vercel/postgres";
import type {
  ActivityAction,
  ActivityLog,
  BakulMaster,
  BakulRecord,
  DashboardSnapshot,
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

// Helper fallback UUID (JS) kalau gen_random_uuid() tidak tersedia di Postgres
const jsUUID = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`;

const INSERT_CHUNK_SIZE = 500;

async function bulkInsert(
  client: VercelPoolClient,
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
  options: { jsonbColumns?: number[]; onConflict?: string } = {}
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + INSERT_CHUNK_SIZE);
    const values: (string | number | null)[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value, columnIndex) => {
        values.push(value);
        const placeholder = `$${values.length}`;
        return options.jsonbColumns?.includes(columnIndex) ? `${placeholder}::jsonb` : placeholder;
      });
      return `(${placeholders.join(", ")})`;
    });

    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")}${options.onConflict ?? ""}`,
      values
    );
  }
}

function uniqueById<T extends { id: string }>(records: T[]): T[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function ensureSchemaOnce(): Promise<void> {
  return Promise.resolve();
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
  stockOutGroupId: string | null;
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
// [BARU] Ditambahkan field id
type OpsRow = { id: string; date: string; description: string; amount: number; note: string };
type MetaRow = { opsCategories: string[] };

type DashboardItemRow = { id: string; name: string; buyPrice: number };
type DashboardDailyItemRow = { itemName: string; quantity: number; omzet: number; count: number };

export async function loadDashboardSnapshot(date: string): Promise<DashboardSnapshot> {
  await ensureSchemaOnce();

  const [itemsR, dailyItemsR, stockInR, penyusutanR, hasDataR] = await Promise.all([
    db.sql`SELECT id, name, buy_price AS "buyPrice" FROM items ORDER BY created_at ASC`,
    db.sql<DashboardDailyItemRow>`
      SELECT item_name AS "itemName", SUM(quantity) AS quantity,
        SUM(quantity * price) AS omzet, COUNT(*) AS count
      FROM stock_out WHERE date = ${date} GROUP BY item_name
    `,
    db.sql`SELECT COALESCE(SUM(quantity), 0) AS quantity FROM stock_in WHERE date = ${date}`,
    db.sql`SELECT COALESCE(SUM(amount), 0) AS amount FROM penyusutan`,
    db.sql`
      SELECT (
        EXISTS (SELECT 1 FROM sales LIMIT 1)
        OR EXISTS (SELECT 1 FROM bakul_records LIMIT 1)
        OR EXISTS (SELECT 1 FROM ops_records LIMIT 1)
        OR EXISTS (SELECT 1 FROM items LIMIT 1)
        OR EXISTS (SELECT 1 FROM bakul_masters LIMIT 1)
        OR EXISTS (SELECT 1 FROM stock_in LIMIT 1)
        OR EXISTS (SELECT 1 FROM stock_out LIMIT 1)
        OR COALESCE((SELECT jsonb_array_length(ops_categories) FROM app_meta WHERE id = 1), 0) > 0
      ) AS "hasData"
    `,
  ]);

  const items = (itemsR.rows as unknown as DashboardItemRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    buyPrice: num(row.buyPrice),
  }));
  const dailyItems = (dailyItemsR.rows as unknown as DashboardDailyItemRow[]).map((row) => ({
    itemName: row.itemName,
    quantity: num(row.quantity),
    omzet: num(row.omzet),
  }));
  const dailyQuantity = dailyItems.reduce((sum, item) => sum + item.quantity, 0);
  const dailyOmzet = dailyItems.reduce((sum, item) => sum + item.omzet, 0);
  const dailyTransactionCount = (dailyItemsR.rows as unknown as DashboardDailyItemRow[])
    .reduce((sum, row) => sum + num(row.count), 0);
  const hasData = Boolean((hasDataR.rows[0] as { hasData?: boolean } | undefined)?.hasData);

  return {
    hasData,
    items,
    dailyItems,
    dailyQuantity,
    dailyOmzet,
    dailyTransactionCount,
    dailyStockRemaining: num(stockInR.rows[0]?.quantity) - dailyQuantity,
    totalPenyusutan: num(penyusutanR.rows[0]?.amount),
  };
}

// === Load seluruh data dari DB ===
export async function loadAllData(): Promise<AppDataSet> {
  // Pastikan kolom baru ada sebelum query (agar tetap online walau belum migrasi).
  await ensureSchemaOnce();

  const [itemsR, bakulMastersR, stockInR, stockOutR, salesR, bakulRecordsR, opsR, metaR, penyusutanR, priceHistoryR] =
    await Promise.all([
      db.sql`SELECT id, name, buy_price AS "buyPrice" FROM items ORDER BY created_at ASC`,
      db.sql`SELECT id, name, sell_price AS "sellPrice" FROM bakul_masters ORDER BY created_at ASC`,
      db.sql`SELECT id, date, item_name AS "itemName", quantity, buy_price AS "buyPrice", bird_count AS "birdCount", weighings FROM stock_in ORDER BY created_at ASC, id ASC`,
      db.sql`SELECT id, date, bakul_name AS "bakulName", item_name AS "itemName", quantity, price, buy_price AS "buyPrice", stock_in_id AS "stockInId", stock_out_group_id AS "stockOutGroupId", sale_type AS "saleType", payment_method AS "paymentMethod", bird_count AS "birdCount", weighings FROM stock_out ORDER BY created_at ASC, id ASC`,
      db.sql`SELECT date, modal_qty AS "modalQty", modal_total AS "modalTotal", sale_qty AS "saleQty", sale_total AS "saleTotal", shrink, target, gross_profit AS "grossProfit", difference, operational, net_profit AS "netProfit", note FROM sales ORDER BY position ASC, created_at ASC`,
      db.sql`SELECT date, name, bill, paid, balance, note FROM bakul_records ORDER BY position ASC, created_at ASC`,
      // [BARU] Ambil juga kolom id
      db.sql`SELECT id, date, description, amount, note FROM ops_records ORDER BY position ASC, created_at ASC`,
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
    stockOutGroupId: r.stockOutGroupId != null && r.stockOutGroupId !== "" ? r.stockOutGroupId : undefined,
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

  // [BARU] Mapping id dari DB ke objek OperationalRecord
  const ops: OperationalRecord[] = (opsR.rows as unknown as OpsRow[]).map((r) => ({
    id: r.id,
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
  await ensureSchemaOnce();

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
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '20s'");
    await client.sql`DELETE FROM items`;
    await client.sql`DELETE FROM bakul_masters`;
    await client.sql`DELETE FROM sales`;
    await client.sql`DELETE FROM bakul_records`;
    await client.sql`DELETE FROM ops_records`;
    await client.sql`DELETE FROM penyusutan`;
    await client.sql`DELETE FROM price_history`;

    const incomingStockIn = uniqueById(stockIn);
    const incomingStockOut = uniqueById(stockOut);
    const [existingStockIn, existingStockOut] = await Promise.all([
      client.query<{ id: string }>("SELECT id FROM stock_in"),
      client.query<{ id: string }>("SELECT id FROM stock_out"),
    ]);
    const stockInIds = new Set(incomingStockIn.map((record) => record.id));
    const stockOutIds = new Set(incomingStockOut.map((record) => record.id));
    const deletedStockInIds = existingStockIn.rows
      .map((record) => record.id)
      .filter((id) => !stockInIds.has(id));
    const deletedStockOutIds = existingStockOut.rows
      .map((record) => record.id)
      .filter((id) => !stockOutIds.has(id));
    if (deletedStockInIds.length > 0) {
      await client.query("DELETE FROM stock_in WHERE id = ANY($1::text[])", [deletedStockInIds]);
    }
    if (deletedStockOutIds.length > 0) {
      await client.query("DELETE FROM stock_out WHERE id = ANY($1::text[])", [deletedStockOutIds]);
    }

    await bulkInsert(client, "items", ["id", "name", "buy_price"],
      items.map((item) => [item.id, item.name, item.buyPrice]));
    await bulkInsert(client, "bakul_masters", ["id", "name", "sell_price"],
      bakulMasters.map((master) => [master.id, master.name, master.sellPrice ?? 0]));

    await bulkInsert(client, "stock_in",
      ["id", "date", "item_name", "quantity", "buy_price", "bird_count", "weighings"],
      incomingStockIn.map((record) => [
        record.id,
        record.date,
        record.itemName,
        record.quantity,
        record.buyPrice,
        record.birdCount ?? null,
        JSON.stringify(record.weighings ?? []),
      ]),
      {
        jsonbColumns: [6],
        onConflict: ` ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date, item_name = EXCLUDED.item_name, quantity = EXCLUDED.quantity,
          buy_price = EXCLUDED.buy_price, bird_count = EXCLUDED.bird_count, weighings = EXCLUDED.weighings`,
      }
    );
    await bulkInsert(client, "stock_out",
      ["id", "date", "bakul_name", "item_name", "quantity", "price", "buy_price", "stock_in_id",
        "stock_out_group_id", "sale_type", "payment_method", "bird_count", "weighings"],
      incomingStockOut.map((record) => [
        record.id,
        record.date,
        record.bakulName,
        record.itemName,
        record.quantity,
        record.price,
        record.buyPrice ?? 0,
        record.stockInId ?? "",
        record.stockOutGroupId ?? "",
        record.saleType ?? "eceran",
        record.paymentMethod ?? "cash",
        record.birdCount ?? null,
        JSON.stringify(record.weighings ?? []),
      ]),
      {
        jsonbColumns: [12],
        onConflict: ` ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date, bakul_name = EXCLUDED.bakul_name, item_name = EXCLUDED.item_name,
          quantity = EXCLUDED.quantity, price = EXCLUDED.price, buy_price = EXCLUDED.buy_price,
          stock_in_id = EXCLUDED.stock_in_id, stock_out_group_id = EXCLUDED.stock_out_group_id,
          sale_type = EXCLUDED.sale_type, payment_method = EXCLUDED.payment_method,
          bird_count = EXCLUDED.bird_count, weighings = EXCLUDED.weighings`,
      }
    );
    await bulkInsert(client, "price_history",
      ["id", "item_id", "buy_price", "sell_price", "effective_at"],
      priceHistory.map((record) => [
        record.id,
        record.itemId,
        record.buyPrice,
        record.sellPrice,
        record.effectiveAt,
      ]));
    await bulkInsert(client,
      "sales",
      ["date", "modal_qty", "modal_total", "sale_qty", "sale_total", "shrink", "target",
        "gross_profit", "difference", "operational", "net_profit", "note", "position"],
      sales.map((record, position) => [
        record.date,
        record.modalQty,
        record.modalTotal,
        record.saleQty,
        record.saleTotal,
        record.shrink,
        record.target,
        record.grossProfit,
        record.difference,
        record.operational,
        record.netProfit,
        record.note ?? "",
        position,
      ]));
    await bulkInsert(client, "bakul_records",
      ["date", "name", "bill", "paid", "balance", "note", "position"],
      bakulRecords.map((record, position) => [
        record.date,
        record.name,
        record.bill,
        record.paid,
        record.balance,
        record.note ?? "",
        position,
      ]));
    await bulkInsert(client, "ops_records",
      ["id", "date", "description", "amount", "note", "position"],
      ops.map((record, position) => [
        record.id || jsUUID(),
        record.date,
        record.description,
        record.amount,
        record.note ?? "",
        position,
      ]));
    await bulkInsert(client, "penyusutan",
      ["id", "date", "item_name", "expected_stock", "actual_stock", "amount"],
      penyusutan.map((record) => [
        record.id,
        record.date,
        record.itemName,
        record.expectedStock,
        record.actualStock,
        record.amount,
      ]));
    // Meta (ops_categories JSONB)
    await client.sql`
      UPDATE app_meta SET ops_categories = ${JSON.stringify(opsCategories)}::jsonb, updated_at = now() WHERE id = 1
    `;
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
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
  await ensureSchemaOnce();

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '20s'");
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
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}