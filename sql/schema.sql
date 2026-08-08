-- ============================================================
-- Buku Keuangan Usaha | Data Jual Telur
-- Skema Database untuk Vercel Postgres (Neon)
-- ============================================================

-- Tabel: Master Barang
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Master Pelanggan / Bakul
CREATE TABLE IF NOT EXISTS bakul_masters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Barang Masuk (Stock In)
CREATE TABLE IF NOT EXISTS stock_in (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  bird_count NUMERIC,
  weighings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kolom tambahan untuk stock_in (idempotent untuk migrasi berulang)
ALTER TABLE stock_in ADD COLUMN IF NOT EXISTS bird_count NUMERIC;
ALTER TABLE stock_in ADD COLUMN IF NOT EXISTS weighings JSONB DEFAULT '[]'::jsonb;

-- Tabel: Barang Keluar (Stock Out / Penjualan)
CREATE TABLE IF NOT EXISTS stock_out (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  bakul_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  sale_type TEXT DEFAULT 'eceran',
  payment_method TEXT DEFAULT 'cash',
  bird_count NUMERIC,
  weighings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kolom tambahan untuk stock_out (idempotent untuk migrasi berulang)
ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS bird_count NUMERIC;
ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS weighings JSONB DEFAULT '[]'::jsonb;
ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS buy_price NUMERIC NOT NULL DEFAULT 0;

-- Tabel: Riwayat Harga (Price History)
-- Mencatat setiap perubahan harga beli & jual per barang, berbasis tanggal efektif (ISO YYYY-MM-DD).
-- Jangan pernah UPDATE baris lama saat harga berubah; cukup INSERT entri baru.
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  effective_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history (item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_effective ON price_history (effective_at);

-- Tabel: Laporan Harian (Sales)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL,
  modal_qty NUMERIC NOT NULL DEFAULT 0,
  modal_total NUMERIC NOT NULL DEFAULT 0,
  sale_qty NUMERIC NOT NULL DEFAULT 0,
  sale_total NUMERIC NOT NULL DEFAULT 0,
  shrink NUMERIC NOT NULL DEFAULT 0,
  target NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  operational NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Rekaman Piutang Bakul
CREATE TABLE IF NOT EXISTS bakul_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  bill NUMERIC NOT NULL DEFAULT 0,
  paid NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Biaya Operasional
CREATE TABLE IF NOT EXISTS ops_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Penyusutan (kehilangan stok / ayam menyusut)
CREATE TABLE IF NOT EXISTS penyusutan (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  item_name TEXT NOT NULL,
  expected_stock NUMERIC NOT NULL DEFAULT 0,
  actual_stock NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel: Meta Aplikasi (JSONB untuk data dinamis / kategori)
CREATE TABLE IF NOT EXISTS app_meta (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ops_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 4,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inisialisasi satu baris meta default
INSERT INTO app_meta (id, ops_categories, version)
VALUES (1, '[]'::jsonb, 4)
ON CONFLICT (id) DO NOTHING;

-- Tabel: Riwayat Aktivitas (Alur Pengawasan)
-- Mencatat setiap aksi Tambah/Edit/Hapus beserta identitas staf (Clerk) yang melakukannya.
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,          -- 'add' | 'update' | 'delete' | 'reset'
  entity TEXT NOT NULL,          -- 'Barang Masuk' | 'Barang Keluar' | 'Piutang Bakul' | dst.
  entity_id TEXT DEFAULT '',     -- id record terkait (bila ada)
  summary TEXT DEFAULT '',       -- ringkasan singkat aksi
  user_email TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeks untuk query umum
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs (user_email);
CREATE INDEX IF NOT EXISTS idx_stock_out_date ON stock_out (date);
CREATE INDEX IF NOT EXISTS idx_stock_out_bakul ON stock_out (bakul_name);
CREATE INDEX IF NOT EXISTS idx_stock_in_date ON stock_in (date);
CREATE INDEX IF NOT EXISTS idx_bakul_records_date ON bakul_records (date);
CREATE INDEX IF NOT EXISTS idx_ops_records_date ON ops_records (date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date);
