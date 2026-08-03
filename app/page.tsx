"use client";

import { Button, Input, Tab, Tabs } from "@heroui/react";
import { motion } from "framer-motion";
import { Boxes, CircleDollarSign, Package, ShoppingCart, Tag, TrendingUp } from "lucide-react";
import type { Key } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { BakulTab } from "@/components/BakulTab";
import { FinancialReportTab } from "@/components/FinancialReportTab";
import { Header } from "@/components/Header";
import { MasterTab } from "@/components/MasterTab";
import { MetricCard } from "@/components/MetricCard";
import { OpsTab } from "@/components/OpsTab";
import { StockInTab } from "@/components/StockInTab";
import { StockOutTab } from "@/components/StockOutTab";
import { rupiah, shortNumber, unique } from "@/lib/utils";
import {
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  Role,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";
import {
  initialBakulMasters,
  initialBakulRecords,
  initialItems,
  initialOperationalRecords,
  initialOpsCategories,
  initialSales,
  initialStockIn,
  initialStockOut,
} from "./rpa-data";

const SALES_KEY = "finance_book_rpa_sales_v1";
const BAKUL_KEY = "finance_book_rpa_bakul_v1";
const OPS_KEY = "finance_book_rpa_ops_v1";
const ITEMS_KEY = "finance_book_rpa_items_v1";
const BAKUL_MASTERS_KEY = "finance_book_rpa_bakul_masters_v1";
const STOCK_IN_KEY = "finance_book_rpa_stock_in_v1";
const STOCK_OUT_KEY = "finance_book_rpa_stock_out_v1";
const OPS_CATEGORIES_KEY = "finance_book_rpa_ops_categories_v1";
const ADMIN_PASSWORD = "jeko2026";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function subscribeToClient() {
  return () => {};
}

export default function Home() {
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [menu, setMenu] = useState("dashboard");
  const [role, setRole] = useState<Role>("user");
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const [sales, setSales] = useState<DailySale[]>(() =>
    loadFromStorage<DailySale[]>(SALES_KEY, initialSales as DailySale[])
  );
  const [bakulRecords, setBakulRecords] = useState<BakulRecord[]>(() =>
    loadFromStorage<BakulRecord[]>(BAKUL_KEY, initialBakulRecords as BakulRecord[])
  );
  const [ops, setOps] = useState<OperationalRecord[]>(() =>
    loadFromStorage<OperationalRecord[]>(OPS_KEY, initialOperationalRecords as OperationalRecord[])
  );
  const [items, setItems] = useState<ItemMaster[]>(() =>
    loadFromStorage<ItemMaster[]>(ITEMS_KEY, initialItems as ItemMaster[])
  );
  const [bakulMasters, setBakulMasters] = useState<BakulMaster[]>(() =>
    loadFromStorage<BakulMaster[]>(BAKUL_MASTERS_KEY, initialBakulMasters as BakulMaster[])
  );
  const [stockIn, setStockIn] = useState<StockInRecord[]>(() =>
    loadFromStorage<StockInRecord[]>(STOCK_IN_KEY, initialStockIn as StockInRecord[])
  );
const [stockOut, setStockOut] = useState<StockOutRecord[]>(() =>
    loadFromStorage<StockOutRecord[]>(STOCK_OUT_KEY, initialStockOut as StockOutRecord[])
  );
  const [opsCategories, setOpsCategories] = useState<string[]>(() =>
    loadFromStorage<string[]>(OPS_CATEGORIES_KEY, initialOpsCategories as string[])
  );
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [reportDate, setReportDate] = useState<string>(() => {
    const latest = [...initialStockOut]
      .map((r) => r.date)
      .sort()
      .reverse()[0];
    return latest || new Date().toISOString().slice(0, 10);
  });

  // Save to LocalStorage on changes (only on client)
  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  }, [sales, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(BAKUL_KEY, JSON.stringify(bakulRecords));
  }, [bakulRecords, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(OPS_KEY, JSON.stringify(ops));
  }, [ops, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }, [items, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(BAKUL_MASTERS_KEY, JSON.stringify(bakulMasters));
  }, [bakulMasters, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(STOCK_IN_KEY, JSON.stringify(stockIn));
  }, [stockIn, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(STOCK_OUT_KEY, JSON.stringify(stockOut));
  }, [stockOut, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(OPS_CATEGORIES_KEY, JSON.stringify(opsCategories));
  }, [opsCategories, isClient]);

  // Extract available months for dropdown
  const availableMonths = useMemo(() => {
    const months = sales.map((s) => s.date.slice(0, 7));
    return unique(months).sort().reverse();
  }, [sales]);

  // Filtered data by month
  const filteredBakul = useMemo(() => {
    if (selectedMonth === "all") return bakulRecords;
    return bakulRecords.filter((b) => b.date.startsWith(selectedMonth));
  }, [bakulRecords, selectedMonth]);

  // === Laporan Harian: rekap barang keluar & omzet per tanggal ===
  const availableReportDates = useMemo(
    () => unique(stockOut.map((r) => r.date)).sort().reverse(),
    [stockOut]
  );

  const dailyRecords = useMemo(
    () => stockOut.filter((r) => r.date === reportDate),
    [stockOut, reportDate]
  );

  const dailyQty = useMemo(() => dailyRecords.reduce((sum, r) => sum + r.quantity, 0), [dailyRecords]);
  const dailyOmzet = useMemo(() => dailyRecords.reduce((sum, r) => sum + r.quantity * r.price, 0), [dailyRecords]);

const dailyItemSummary = useMemo(() => {
    const map = new Map<string, { qty: number; omzet: number }>();
    for (const r of dailyRecords) {
      const cur = map.get(r.itemName) ?? { qty: 0, omzet: 0 };
      cur.qty += r.quantity;
      cur.omzet += r.quantity * r.price;
      map.set(r.itemName, cur);
    }
    return Array.from(map.entries());
  }, [dailyRecords]);

  // Sisa stok = total stok masuk − total stok keluar (kumulatif s.d. tanggal laporan)
  const dailyStockRemaining = useMemo(() => {
    const stockInTotal = stockIn
      .filter((r) => r.date <= reportDate)
      .reduce((sum, r) => sum + r.quantity, 0);
    const stockOutTotal = stockOut
      .filter((r) => r.date <= reportDate)
      .reduce((sum, r) => sum + r.quantity, 0);
    return stockInTotal - stockOutTotal;
  }, [stockIn, stockOut, reportDate]);

  // === Harga Telur Hari Ini ===
  // Sumber: Master Barang (sellPrice) + transaksi Barang Keluar pada tanggal terpilih
  const eggPrices = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.name.toLowerCase(), item]));

    // Aggregasi harga jual riil dari transaksi Barang Keluar pada hari ini (rata-rata berbobot quantity)
    const todaySellMap = new Map<string, { total: number; qty: number }>();
    for (const r of dailyRecords) {
      const key = r.itemName.toLowerCase();
      const cur = todaySellMap.get(key) ?? { total: 0, qty: 0 };
      cur.total += r.price * r.quantity;
      cur.qty += r.quantity;
      todaySellMap.set(key, cur);
    }

    const todaySellPrice = (name: string) => {
      const rec = todaySellMap.get(name.toLowerCase());
      return rec && rec.qty > 0 ? rec.total / rec.qty : null;
    };

    const names = unique([...items.map((i) => i.name), ...dailyRecords.map((r) => r.itemName)]);
    return names
      .filter((n) => n.trim().length > 0)
      .map((name) => {
        const master = itemMap.get(name.toLowerCase());
        const sellToday = todaySellPrice(name);
        return {
          name,
          sellPrice: master?.sellPrice ?? null,
          sellToday,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, dailyRecords]);

  // Bakul Summary Item breakdown (filtered by month)
  const bakulSummary = useMemo(
    () =>
      unique(filteredBakul.map((item) => item.name)).map((name) => {
        const rows = filteredBakul.filter((item) => item.name === name);
        return {
          name,
          bill: rows.reduce((sum, item) => sum + item.bill, 0),
          paid: rows.reduce((sum, item) => sum + item.paid, 0),
          balance: rows.reduce((sum, item) => sum + item.balance, 0),
          count: rows.length,
        };
      }),
    [filteredBakul]
  );

const bakulNames = useMemo(() => unique(bakulMasters.map((item) => item.name)), [bakulMasters]);
  const itemNames = useMemo(() => unique(items.map((item) => item.name)), [items]);
  const categories = useMemo(
    () => unique([...opsCategories, ...ops.map((item) => item.description)]),
    [opsCategories, ops]
  );

  // Handlers
  const handleUnlockAdmin = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setRole("admin");
      return true;
    }
    return false;
  };

  const handleLogoutAdmin = () => {
    setAdminUnlocked(false);
    setRole("user");
  };

  const handleRoleChange = (key: Key) => {
    const nextRole = String(key) as Role;
    if (nextRole === "admin" && !adminUnlocked) {
      return;
    }
    setRole(nextRole);
  };

  // CRUD Bakul
  const handleAddBakul = (newRecord: BakulRecord) => {
    setBakulRecords((prev) => [newRecord, ...prev]);
  };
  const handleUpdateBakul = (index: number, updatedRecord: BakulRecord) => {
    setBakulRecords((prev) => prev.map((item, i) => (i === index ? updatedRecord : item)));
  };
  const handleDeleteBakul = (index: number) => {
    setBakulRecords((prev) => prev.filter((_, i) => i !== index));
  };

  // CRUD Master Barang
  const handleAddItem = (newItem: ItemMaster) => {
    setItems((prev) => [newItem, ...prev]);
  };
  const handleUpdateItem = (index: number, updatedItem: ItemMaster) => {
    setItems((prev) => prev.map((item, i) => (i === index ? updatedItem : item)));
  };
  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // CRUD Master Pelanggan / Bakul
  const handleAddBakulMaster = (newMaster: BakulMaster) => {
    setBakulMasters((prev) => [newMaster, ...prev]);
  };
  const handleUpdateBakulMaster = (index: number, updatedMaster: BakulMaster) => {
    setBakulMasters((prev) => prev.map((item, i) => (i === index ? updatedMaster : item)));
  };
  const handleDeleteBakulMaster = (index: number) => {
    setBakulMasters((prev) => prev.filter((_, i) => i !== index));
  };

  // CRUD Transaksi Barang Masuk
  const handleAddStockIn = (record: StockInRecord) => {
    setStockIn((prev) => [record, ...prev]);
  };
  const handleUpdateStockIn = (index: number, record: StockInRecord) => {
    setStockIn((prev) => prev.map((item, i) => (i === index ? record : item)));
  };
  const handleDeleteStockIn = (index: number) => {
    setStockIn((prev) => prev.filter((_, i) => i !== index));
  };

// CRUD Transaksi Barang Keluar / Penjualan
  const handleAddStockOut = (record: StockOutRecord) => {
    setStockOut((prev) => [record, ...prev]);
  };
  const handleUpdateStockOut = (index: number, record: StockOutRecord) => {
    setStockOut((prev) => prev.map((item, i) => (i === index ? record : item)));
  };
  const handleDeleteStockOut = (index: number) => {
    setStockOut((prev) => prev.filter((_, i) => i !== index));
  };

  // CRUD Biaya Operasional
  const handleAddOps = (record: OperationalRecord) => {
    setOps((prev) => [record, ...prev]);
  };
  const handleUpdateOps = (index: number, record: OperationalRecord) => {
    setOps((prev) => prev.map((item, i) => (i === index ? record : item)));
  };
  const handleDeleteOps = (index: number) => {
    setOps((prev) => prev.filter((_, i) => i !== index));
  };

  // CRUD Master Kategori Operasional
  const handleAddOpsCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setOpsCategories((prev) =>
      prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, trimmed]
    );
  };
  const handleDeleteOpsCategory = (category: string) => {
    setOpsCategories((prev) => prev.filter((c) => c !== category));
  };

// JSON Import & Reset
  const handleImportData = (data: {
    sales: DailySale[];
    bakulRecords: BakulRecord[];
    ops: OperationalRecord[];
    items?: ItemMaster[];
    bakulMasters?: BakulMaster[];
    stockIn?: StockInRecord[];
    stockOut?: StockOutRecord[];
    opsCategories?: string[];
  }) => {
    setSales(data.sales);
    setBakulRecords(data.bakulRecords);
    setOps(data.ops);
    if (data.items) setItems(data.items);
    if (data.bakulMasters) setBakulMasters(data.bakulMasters);
    if (data.stockIn) setStockIn(data.stockIn);
    if (data.stockOut) setStockOut(data.stockOut);
    if (data.opsCategories && data.opsCategories.length > 0) setOpsCategories(data.opsCategories);
  };

  const handleResetData = () => {
    setSales(initialSales as DailySale[]);
    setBakulRecords(initialBakulRecords as BakulRecord[]);
    setOps(initialOperationalRecords as OperationalRecord[]);
    setItems(initialItems as ItemMaster[]);
    setBakulMasters(initialBakulMasters as BakulMaster[]);
    setStockIn(initialStockIn as StockInRecord[]);
    setStockOut(initialStockOut as StockOutRecord[]);
    setOpsCategories(initialOpsCategories as string[]);
    localStorage.removeItem(SALES_KEY);
    localStorage.removeItem(BAKUL_KEY);
    localStorage.removeItem(OPS_KEY);
    localStorage.removeItem(ITEMS_KEY);
    localStorage.removeItem(BAKUL_MASTERS_KEY);
    localStorage.removeItem(STOCK_IN_KEY);
    localStorage.removeItem(STOCK_OUT_KEY);
    localStorage.removeItem(OPS_CATEGORIES_KEY);
  };

  const menus = [
    ["dashboard", "Laporan Harian"],
    ["stockin", "Barang Masuk"],
    ["stockout", "Barang Keluar"],
    ["ops", "Operasional"],
    ["bakul", "Piutang Bakul"],
    ["laporan", "Laporan Keuangan & Laba Rugi"],
    ["master", "Master & Cadangan"],
  ];

  if (!isClient) {
    return (
      <main className="min-h-screen bg-[#f8f7f2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#191712]">
      {/* Header Bar */}
      <Header
        stockOutCount={stockOut.length}
        role={role}
        adminUnlocked={adminUnlocked}
        onRoleChange={handleRoleChange}
        onUnlockAdmin={handleUnlockAdmin}
        onLogoutAdmin={handleLogoutAdmin}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onMonthChange={setSelectedMonth}
      />

      {/* Main Container */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="border-b border-[#191712]/10 bg-white/50 backdrop-blur-xs rounded-2xl p-2 shadow-xs">
          <Tabs
            selectedKey={menu}
            onSelectionChange={(key) => setMenu(String(key))}
            variant="underlined"
            classNames={{
              tabList: "w-full gap-2 overflow-x-auto border-b-0",
              tab: "h-11 px-4 text-sm font-bold",
              tabContent: "text-[#706858] group-data-[selected=true]:text-[#191712]",
              cursor: "bg-[#191712] h-1 rounded-full",
            }}
          >
            {menus.map(([key, label]) => (
              <Tab key={key} title={label} />
            ))}
          </Tabs>
        </div>

        {/* Dynamic Tab Content */}
        <motion.div key={menu} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {menu === "dashboard" && (
            <div className="space-y-6">
              {/* Laporan Harian Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#191712]/10 bg-white p-4 sm:px-6">
                <div>
                  <h2 className="text-xl font-black text-[#191712]">Laporan Harian</h2>
                  <p className="text-xs text-[#706858]">
                    Rekap total barang keluar dan total omzet / penjualan pada hari tersebut.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    size="sm"
                    className="w-[180px]"
                    value={reportDate}
                    onValueChange={setReportDate}
                    aria-label="Pilih Tanggal Laporan"
                    radius="sm"
                  />
                </div>
              </div>

{/* Daily Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={`Total Barang Keluar • ${reportDate}`}
                  value={`${shortNumber(dailyQty)} kg`}
                  tone="blue"
                  icon={Package}
                />
                <MetricCard
                  label={`Total Omzet / Penjualan`}
                  value={rupiah(dailyOmzet)}
                  tone="green"
                  icon={CircleDollarSign}
                />
                <MetricCard
                  label={`Sisa Stok • ${reportDate}`}
                  value={`${shortNumber(dailyStockRemaining)} kg`}
                  tone="yellow"
                  icon={Boxes}
                />
                <MetricCard
                  label="Jumlah Transaksi"
                  value={`${dailyRecords.length} Transaksi`}
                  tone="plain"
                  icon={ShoppingCart}
                />
              </div>

              {/* Harga Telur Hari Ini */}
              <div className="overflow-hidden rounded-2xl border border-[#191712]/10 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-[#191712]/10 bg-gradient-to-r from-[#d9ff67] to-[#b3e619] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Tag size={18} className="text-[#191712]" />
                    <h3 className="text-base font-black text-[#191712]">Harga Telur Hari Ini</h3>
                  </div>
                  <span className="rounded-full bg-[#191712]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#191712]">
                    {reportDate}
                  </span>
                </div>

                <div className="p-5">
                  {eggPrices.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#706858]">
                      Belum ada data harga. Tambahkan barang di <strong>Master &amp; Cadangan</strong> atau catat
                      transaksi Barang Keluar.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
{eggPrices.map((item) => {
                        // Prioritas: Harga Master Barang (Rp 23.000), lalu rata-rata transaksi hari ini
                        const displayPrice = item.sellPrice ?? item.sellToday;
                        const hasPrice = displayPrice != null;
                        return (
                          <div
                            key={item.name}
                            className="relative overflow-hidden rounded-xl border border-[#191712]/10 bg-gradient-to-br from-[#f7f5ef] to-white p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-black text-[#191712]">{item.name}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#706858]">
                                  {item.sellPrice != null ? "Harga master" : "Harga transaksi"}
                                </p>
                              </div>
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#191712]/5 text-[#191712]">
                                <TrendingUp size={16} />
                              </span>
                            </div>

                            <div className="mt-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#706858]">
                                Harga Jual / kg
                              </p>
                              <p
                                className={`font-mono text-2xl font-black tracking-tight ${
                                  hasPrice ? "text-[#1f8f5f]" : "text-[#b0a99a]"
                                }`}
                              >
                                {hasPrice ? rupiah(displayPrice) : "—"}
                              </p>
                              {item.sellToday != null && item.sellPrice != null && item.sellToday !== item.sellPrice && (
                                <p className="mt-1 text-[10px] font-bold text-[#706858]">
                                  Rata-rata transaksi hari ini: {rupiah(item.sellToday)} / kg
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-item Summary */}
              {dailyItemSummary.length > 0 && (
                <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-3">
                  <h3 className="font-black text-sm text-[#191712]">Rekap Per Barang</h3>
                  <div className="flex flex-wrap gap-2">
                    {dailyItemSummary.map(([name, { qty, omzet }]) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-2 rounded-full bg-[#f7f5ef] border border-[#191712]/10 px-3 py-1.5 text-xs font-bold"
                      >
                        {name}: {shortNumber(qty)} kg • {rupiah(omzet)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Detail Transaksi Harian */}
              <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black text-[#191712]">Detail Barang Keluar</h3>
                    <p className="text-xs text-[#706858]">
                      Tanggal {reportDate} • {dailyRecords.length} transaksi
                    </p>
                  </div>
                  {availableReportDates.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                      {availableReportDates.slice(0, 7).map((d) => (
                        <Button
                          key={d}
                          size="sm"
                          radius="sm"
                          className={
                            d === reportDate
                              ? "bg-[#191712] font-bold text-white"
                              : "bg-[#f0eadb] font-bold text-[#191712]"
                          }
                          onPress={() => setReportDate(d)}
                        >
                          {d.slice(5)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {dailyRecords.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#706858]">
                    Belum ada barang keluar / penjualan pada tanggal ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dailyRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-xl bg-[#f7f5ef] px-4 py-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-sm text-[#191712]">{record.itemName}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                (record.saleType ?? "eceran") === "grosir"
                                  ? "bg-[#fff3cd] text-[#8f6b00]"
                                  : "bg-[#e7f5ec] text-[#1f8f5f]"
                              }`}
                            >
                              {record.saleType ?? "eceran"}
                            </span>
                          </div>
                          <p className="text-[#706858]">{record.bakulName} • Harga jual {rupiah(record.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-black text-[#191712]">{shortNumber(record.quantity)} kg</p>
                          <p className="font-mono font-bold text-[#1f8f5f]">{rupiah(record.quantity * record.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {menu === "stockin" && (
            <StockInTab
              stockIn={stockIn}
              itemNames={itemNames}
              role={role}
              onAddStockIn={handleAddStockIn}
              onUpdateStockIn={handleUpdateStockIn}
              onDeleteStockIn={handleDeleteStockIn}
            />
          )}

          {menu === "stockout" && (
            <StockOutTab
              stockOut={stockOut}
              itemNames={itemNames}
              bakulNames={bakulNames}
              items={items}
              role={role}
              onAddStockOut={handleAddStockOut}
              onUpdateStockOut={handleUpdateStockOut}
              onDeleteStockOut={handleDeleteStockOut}
            />
          )}

{menu === "bakul" && (
            <BakulTab
              bakulRecords={filteredBakul}
              bakulNames={bakulNames}
              role={role}
              onAddBakul={handleAddBakul}
              onUpdateBakul={handleUpdateBakul}
              onDeleteBakul={handleDeleteBakul}
            />
          )}

          {menu === "ops" && (
            <OpsTab
              ops={ops}
              categories={categories}
              role={role}
              onAddOps={handleAddOps}
              onUpdateOps={handleUpdateOps}
              onDeleteOps={handleDeleteOps}
              onAddOpsCategory={handleAddOpsCategory}
            />
          )}

          {menu === "laporan" && (
            <FinancialReportTab stockOut={stockOut} items={items} ops={ops} role={role} />
          )}

          {menu === "master" && (
            <MasterTab
              categories={categories}
              sales={sales}
              bakulRecords={bakulRecords}
              ops={ops}
              items={items}
              bakulMasters={bakulMasters}
              stockIn={stockIn}
              stockOut={stockOut}
              opsCategories={opsCategories}
              role={role}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddBakulMaster={handleAddBakulMaster}
              onUpdateBakulMaster={handleUpdateBakulMaster}
              onDeleteBakulMaster={handleDeleteBakulMaster}
              onAddOpsCategory={handleAddOpsCategory}
              onDeleteOpsCategory={handleDeleteOpsCategory}
              onImportData={handleImportData}
              onResetData={handleResetData}
            />
          )}
        </motion.div>
      </section>
    </main>
  );
}

