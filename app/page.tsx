"use client";

import { Button, Input } from "@heroui/react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileBarChart,
  HandCoins,
Package,
  PackagePlus,
  ShieldCheck,
ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Key } from "react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { BakulTab } from "@/components/BakulTab";
import { FinancialReportTab } from "@/components/FinancialReportTab";
import { Header } from "@/components/Header";
import { MasterTab } from "@/components/MasterTab";
import { MetricCard } from "@/components/MetricCard";
import { OpsTab } from "@/components/OpsTab";
import { PengawasanTab } from "@/components/PengawasanTab";
import { PenyusutanTab } from "@/components/PenyusutanTab";
import { StockInTab } from "@/components/StockInTab";
import { StockOutTab } from "@/components/StockOutTab";
import {
  fetchAllFromServer,
  hasAnyServerData,
  pushAllToServer,
  type LocalDataset,
  type SyncStatus,
} from "@/lib/sync";
import { rupiah, shortNumber, unique } from "@/lib/utils";
import {
  ActivityAction,
  ActivityLog,
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PenyusutanRecord,
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
  initialPenyusutan,
  initialSales,
  initialStockIn,
  initialStockOut,
} from "./rpa-data";

const MENUS = [
  { key: "dashboard", label: "Laporan Harian", icon: ClipboardList, adminOnly: false },
  { key: "stockin", label: "Barang Masuk", icon: PackagePlus, adminOnly: false },
  { key: "stockout", label: "Barang Keluar", icon: Package, adminOnly: false },
  { key: "ops", label: "Operasional", icon: HandCoins, adminOnly: true },
{ key: "penyusutan", label: "Penyusutan", icon: TrendingDown, adminOnly: true },
  { key: "bakul", label: "Piutang Bakul", icon: Users, adminOnly: false },
  { key: "laporan", label: "Laba & Rugi", icon: FileBarChart, adminOnly: true },
  { key: "master", label: "Master & Cadangan", icon: Database, adminOnly: false },
  { key: "pengawasan", label: "Alur Pengawasan", icon: ShieldCheck, adminOnly: true },
];

function subscribeToClient() {
  return () => {};
}

export default function Home() {
  const { user } = useUser();
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const isAdmin = user?.publicMetadata?.role === "admin";
  const [menu, setMenu] = useState("dashboard");
  const role: Role = isAdmin ? "admin" : "user";
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");

const [sales, setSales] = useState<DailySale[]>(initialSales as DailySale[]);
  const [bakulRecords, setBakulRecords] = useState<BakulRecord[]>(initialBakulRecords as BakulRecord[]);
  const [ops, setOps] = useState<OperationalRecord[]>(initialOperationalRecords as OperationalRecord[]);
  const [items, setItems] = useState<ItemMaster[]>(initialItems as ItemMaster[]);
  const [bakulMasters, setBakulMasters] = useState<BakulMaster[]>(initialBakulMasters as BakulMaster[]);
  const [stockIn, setStockIn] = useState<StockInRecord[]>(initialStockIn as StockInRecord[]);
  const [stockOut, setStockOut] = useState<StockOutRecord[]>(initialStockOut as StockOutRecord[]);
const [opsCategories, setOpsCategories] = useState<string[]>(initialOpsCategories as string[]);
  const [penyusutan, setPenyusutan] = useState<PenyusutanRecord[]>(initialPenyusutan as PenyusutanRecord[]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [reportDate, setReportDate] = useState<string>(() => {
    const latest = [...initialStockOut]
      .map((r) => r.date)
      .sort()
      .reverse()[0];
    return latest || new Date().toISOString().slice(0, 10);
  });

  // JSON Import & Reset
  const handleImportData = useCallback(
    (data: {
      sales: DailySale[];
      bakulRecords: BakulRecord[];
      ops: OperationalRecord[];
      items?: ItemMaster[];
      bakulMasters?: BakulMaster[];
      stockIn?: StockInRecord[];
      stockOut?: StockOutRecord[];
      opsCategories?: string[];
      penyusutan?: PenyusutanRecord[];
    }) => {
      setSales(data.sales);
      setBakulRecords(data.bakulRecords);
      setOps(data.ops);
      if (data.items) setItems(data.items);
      if (data.bakulMasters) setBakulMasters(data.bakulMasters);
      if (data.stockIn) setStockIn(data.stockIn);
      if (data.stockOut) setStockOut(data.stockOut);
      if (data.opsCategories && data.opsCategories.length > 0) setOpsCategories(data.opsCategories);
if (data.penyusutan) setPenyusutan(data.penyusutan);
    },
    []
  );

  // === Alur Pengawasan: catat setiap aksi Tambah/Edit/Hapus ke server ===
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const userFullName = [user?.firstName ?? "", user?.lastName ?? ""].filter(Boolean).join(" ").trim();
  const userName = userFullName || user?.username || userEmail || "Staf";

  const recordActivity = useCallback(
    async (action: ActivityAction, entity: string, entityId: string, summary: string) => {
      try {
        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, entity, entityId, summary }),
        });
      } catch {
        // Gagal mencatat aktivitas tidak boleh menghentikan aksi utama.
      }
    },
    []
  );

  const refreshActivityLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok?: boolean; logs?: ActivityLog[] };
      if (json.ok && Array.isArray(json.logs)) {
        setActivityLogs(json.logs);
      }
    } catch {
      // Abaikan bila gagal memuat riwayat.
    }
  }, []);

  // Muat riwayat aktivitas saat pengguna adalah admin.
  useEffect(() => {
    if (isAdmin && isClient) {
      refreshActivityLogs();
    }
  }, [isAdmin, isClient, refreshActivityLogs]);

// This effect runs only once on the client to decide the source of truth.
  useEffect(() => {
    if (!isClient) return;

    const initializeData = async () => {
      setSyncStatus("loading");
      const serverData = await fetchAllFromServer();

      if (serverData === null) {
        // Network error or server issue, app is offline.
        // Data stays at the initial (demo) state from useState initializers.
        setSyncStatus("offline");
        return;
      }

      if (hasAnyServerData(serverData)) {
        // Server has data, this is the source of truth.
        handleImportData({
          sales: serverData.sales ?? [],
          bakulRecords: serverData.bakulRecords ?? [],
          ops: serverData.ops ?? [],
          items: serverData.items ?? [],
          bakulMasters: serverData.bakulMasters ?? [],
          stockIn: serverData.stockIn ?? [],
          stockOut: serverData.stockOut ?? [],
          opsCategories: serverData.opsCategories ?? [],
          penyusutan: serverData.penyusutan ?? [],
        });
        setSyncStatus("saved");
      } else {
        // Server is empty. Seed it with the initial (demo) data.
        const demoData: LocalDataset = {
          sales: initialSales as DailySale[],
          bakulRecords: initialBakulRecords as BakulRecord[],
          ops: initialOperationalRecords as OperationalRecord[],
          items: initialItems as ItemMaster[],
          bakulMasters: initialBakulMasters as BakulMaster[],
          stockIn: initialStockIn as StockInRecord[],
          stockOut: initialStockOut as StockOutRecord[],
          opsCategories: initialOpsCategories as string[],
          penyusutan: initialPenyusutan as PenyusutanRecord[],
        };
        setSyncStatus("saving");
        const success = await pushAllToServer(demoData);
        setSyncStatus(success ? "saved" : "error");
      }
    };

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, handleImportData]);

  // This effect handles pushing data to the server whenever it changes.
  useEffect(() => {
    // Don't save during initial load or if offline.
    if (syncStatus === "loading" || syncStatus === "offline" || !isClient) {
      return;
    }

    const handler = setTimeout(async () => {
      setSyncStatus("saving");
      const dataset: LocalDataset = {
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
      const success = await pushAllToServer(dataset);
      setSyncStatus(success ? "saved" : "error");
    }, 1500); // Debounce for 1.5 seconds

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, opsCategories, penyusutan]);

// Effect to reset menu: belum login hanya dashboard, dan user non-admin
  // tidak bisa membuka menu khusus admin.
  useEffect(() => {
    if (!user) {
      if (menu !== "dashboard") setMenu("dashboard");
      return;
    }
    if (role === "user") {
      const lockedKeys = new Set(MENUS.filter((m) => m.adminOnly).map((m) => m.key));
      if (lockedKeys.has(menu)) {
        setMenu("dashboard");
      }
    }
  }, [role, menu, user]);

// User only sees unlocked menus; admin sees all menus.
  // Belum login: hanya Laporan Harian (dashboard) yang bisa dibuka.
  const visibleMenus = useMemo(() => {
    if (!user) return MENUS.filter((m) => m.key === "dashboard");
    return MENUS.filter((menu) => role === "admin" || !menu.adminOnly);
  }, [role, user]);

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
  const totalPenyusutan = useMemo(() => penyusutan.reduce((sum, r) => sum + r.amount, 0), [penyusutan]);

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

// === Harga Ayam Hari Ini ===
  // Sumber: Master Barang (buyPrice) + transaksi Barang Keluar pada tanggal terpilih
const chickenPrices = useMemo(() => {
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
          buyPrice: master?.buyPrice ?? null,
          sellToday,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, dailyRecords]);

const bakulNames = useMemo(() => unique(bakulMasters.map((item) => item.name)), [bakulMasters]);
  const itemNames = useMemo(() => unique(items.map((item) => item.name)), [items]);
  const categories = useMemo(
    () => unique([...opsCategories, ...ops.map((item) => item.description)]),
    [opsCategories, ops]
  );

// CRUD Bakul
  const handleAddBakul = (newRecord: BakulRecord) => {
    setBakulRecords((prev) => [newRecord, ...prev]);
    recordActivity("add", "Piutang Bakul", "", `${newRecord.name} • ${newRecord.date}`);
  };
  const handleUpdateBakul = (index: number, updatedRecord: BakulRecord) => {
    setBakulRecords((prev) => prev.map((item, i) => (i === index ? updatedRecord : item)));
    recordActivity("update", "Piutang Bakul", "", `${updatedRecord.name} • ${updatedRecord.date}`);
  };
  const handleDeleteBakul = (index: number) => {
    const deleted = bakulRecords[index];
    setBakulRecords((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Piutang Bakul", "", `${deleted.name} • ${deleted.date}`);
  };

  // CRUD Master Barang
  const handleAddItem = (newItem: ItemMaster) => {
    setItems((prev) => [newItem, ...prev]);
    recordActivity("add", "Master Barang", newItem.id, newItem.name);
  };
  const handleUpdateItem = (index: number, updatedItem: ItemMaster) => {
    setItems((prev) => prev.map((item, i) => (i === index ? updatedItem : item)));
    recordActivity("update", "Master Barang", updatedItem.id, updatedItem.name);
  };
  const handleDeleteItem = (index: number) => {
    const deleted = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Master Barang", deleted.id, deleted.name);
  };

  // CRUD Master Pelanggan / Bakul
  const handleAddBakulMaster = (newMaster: BakulMaster) => {
    setBakulMasters((prev) => [newMaster, ...prev]);
    recordActivity("add", "Master Bakul", newMaster.id, newMaster.name);
  };
  const handleUpdateBakulMaster = (index: number, updatedMaster: BakulMaster) => {
    setBakulMasters((prev) => prev.map((item, i) => (i === index ? updatedMaster : item)));
    recordActivity("update", "Master Bakul", updatedMaster.id, updatedMaster.name);
  };
  const handleDeleteBakulMaster = (index: number) => {
    const deleted = bakulMasters[index];
    setBakulMasters((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Master Bakul", deleted.id, deleted.name);
  };

  // CRUD Transaksi Barang Masuk
  const handleAddStockIn = (record: StockInRecord) => {
    setStockIn((prev) => [record, ...prev]);
    recordActivity("add", "Barang Masuk", record.id, `${record.itemName} • ${record.date} (+${record.quantity} kg)`);
  };
  const handleUpdateStockIn = (index: number, record: StockInRecord) => {
    setStockIn((prev) => prev.map((item, i) => (i === index ? record : item)));
    recordActivity("update", "Barang Masuk", record.id, `${record.itemName} • ${record.date} (+${record.quantity} kg)`);
  };
  const handleDeleteStockIn = (index: number) => {
    const deleted = stockIn[index];
    setStockIn((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Barang Masuk", deleted.id, `${deleted.itemName} • ${deleted.date}`);
  };

  const stockOutPiutangNote = (id: string) => `Auto dari Barang Keluar: ${id}`;

  const stockOutToBakulRecord = (record: StockOutRecord): BakulRecord => {
    const bill = record.quantity * record.price;
    return {
      date: record.date,
      name: record.bakulName,
      bill,
      paid: 0,
      balance: bill,
      note: stockOutPiutangNote(record.id),
    };
  };

// CRUD Transaksi Barang Keluar / Penjualan
  const handleAddStockOut = (record: StockOutRecord) => {
    setStockOut((prev) => [record, ...prev]);
    setBakulRecords((prev) => [stockOutToBakulRecord(record), ...prev]);
    recordActivity("add", "Barang Keluar", record.id, `${record.itemName} • ${record.bakulName} • ${record.date} (${record.quantity} kg)`);
  };
  const handleUpdateStockOut = (index: number, record: StockOutRecord) => {
    const previousRecord = stockOut[index];
    const previousNote = previousRecord ? stockOutPiutangNote(previousRecord.id) : stockOutPiutangNote(record.id);
    const nextPiutang = stockOutToBakulRecord(record);
    setStockOut((prev) => prev.map((item, i) => (i === index ? record : item)));
    setBakulRecords((prev) => {
      const linkedIndex = prev.findIndex((item) => item.note === previousNote);
      if (linkedIndex === -1) return [nextPiutang, ...prev];
      return prev.map((item, i) => (i === linkedIndex ? nextPiutang : item));
    });
    recordActivity("update", "Barang Keluar", record.id, `${record.itemName} • ${record.bakulName} • ${record.date} (${record.quantity} kg)`);
  };
  const handleDeleteStockOut = (index: number) => {
    const deletedRecord = stockOut[index];
    const deletedNote = deletedRecord ? stockOutPiutangNote(deletedRecord.id) : "";
    setStockOut((prev) => prev.filter((_, i) => i !== index));
    if (deletedNote) {
      setBakulRecords((prev) => prev.filter((item) => item.note !== deletedNote));
    }
    if (deletedRecord) {
      recordActivity("delete", "Barang Keluar", deletedRecord.id, `${deletedRecord.itemName} • ${deletedRecord.bakulName} • ${deletedRecord.date}`);
    }
  };

  // CRUD Biaya Operasional
  const handleAddOps = (record: OperationalRecord) => {
    setOps((prev) => [record, ...prev]);
    recordActivity("add", "Operasional", "", `${record.description} • ${record.date}`);
  };
  const handleUpdateOps = (index: number, record: OperationalRecord) => {
    setOps((prev) => prev.map((item, i) => (i === index ? record : item)));
    recordActivity("update", "Operasional", "", `${record.description} • ${record.date}`);
  };
  const handleDeleteOps = (index: number) => {
    const deleted = ops[index];
    setOps((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Operasional", "", `${deleted.description} • ${deleted.date}`);
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

// CRUD Penyusutan
  const handleAddPenyusutan = (record: PenyusutanRecord) => {
    setPenyusutan((prev) => [record, ...prev]);
    recordActivity("add", "Penyusutan", record.id, `${record.itemName} • ${record.date}`);
  };
  const handleUpdatePenyusutan = (index: number, record: PenyusutanRecord) => {
    setPenyusutan((prev) => prev.map((item, i) => (i === index ? record : item)));
    recordActivity("update", "Penyusutan", record.id, `${record.itemName} • ${record.date}`);
  };
  const handleDeletePenyusutan = (index: number) => {
    const deleted = penyusutan[index];
    setPenyusutan((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Penyusutan", deleted.id, `${deleted.itemName} • ${deleted.date}`);
  };

const handleResetData = async () => {
    setSyncStatus("saving");
    let resetOk = false;
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean };
      resetOk = json.ok === true;
    } catch {
      resetOk = false;
    }

    setSales(initialSales as DailySale[]);
    setBakulRecords(initialBakulRecords as BakulRecord[]);
    setOps(initialOperationalRecords as OperationalRecord[]);
    setItems(initialItems as ItemMaster[]);
    setBakulMasters(initialBakulMasters as BakulMaster[]);
    setStockIn(initialStockIn as StockInRecord[]);
    setStockOut(initialStockOut as StockOutRecord[]);
    setOpsCategories(initialOpsCategories as string[]);
    setPenyusutan(initialPenyusutan as PenyusutanRecord[]);

    // Re-seed the server with the initial (demo) data.
    const success = await pushAllToServer({
      sales: initialSales as DailySale[],
      bakulRecords: initialBakulRecords as BakulRecord[],
      ops: initialOperationalRecords as OperationalRecord[],
      items: initialItems as ItemMaster[],
      bakulMasters: initialBakulMasters as BakulMaster[],
      stockIn: initialStockIn as StockInRecord[],
      stockOut: initialStockOut as StockOutRecord[],
      opsCategories: initialOpsCategories as string[],
      penyusutan: initialPenyusutan as PenyusutanRecord[],
    });
setSyncStatus(success ? "saved" : (resetOk ? "saved" : "error"));
    recordActivity("reset", "Seluruh Data", "", "Reset data ke kondisi awal demo");
    refreshActivityLogs();
  };

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
        syncStatus={syncStatus}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onMonthChange={setSelectedMonth}
      />

      {/* Main Container */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
{/* Navigation Tabs */}
        <div className="rounded-2xl bg-white/70 p-2 shadow-sm backdrop-blur-sm border border-[#191712]/5">
<nav className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-2">
            {visibleMenus.map(({ key, label, icon: Icon }) => {
              const active = menu === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMenu(key)}
                  className={`group flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all sm:flex-row sm:px-3 sm:py-2 ${
                    active
                      ? "bg-[#191712] text-white shadow-md"
                      : "bg-[#f7f5ef] text-[#706858] hover:bg-[#f0eadb] hover:text-[#191712]"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${active ? "text-[#d9ff67]" : "text-[#706858] group-hover:text-[#191712]"}`}
                  />
                  <span className="text-[10px] font-bold leading-tight sm:text-[11px] sm:font-semibold">
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
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
                    className="w-full sm:w-[180px]"
                    value={reportDate}
                    onValueChange={setReportDate}
                    aria-label="Pilih Tanggal Laporan"
                    radius="sm"
                  />
                </div>
              </div>

              {/* Pengingat login: user harus masuk untuk bisa input barang */}
              {!user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={22} className="shrink-0 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-black text-[#191712]">Masuk untuk mengakses fitur Input Barang</h3>
                      <p className="text-xs text-[#706858]">
                        Barang Masuk, Barang Keluar, Piutang Bakul, Master, dan menu lainnya dikunci. Silakan masuk
                        terlebih dahulu agar pengawasan berjalan lancar. Anda saat ini hanya dapat melihat Laporan Harian.
                      </p>
                    </div>
                  </div>
                  <SignInButton mode="modal">
                    <button className="h-10 shrink-0 rounded-lg bg-[#191712] px-4 text-sm font-semibold text-white hover:bg-black">
                      Masuk Sekarang
                    </button>
                  </SignInButton>
                </div>
              )}

{/* Daily Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {isAdmin && (
                  <>
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
                  </>
                )}
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
                {isAdmin && totalPenyusutan > 0 && (
                  <MetricCard
                    label="Total Penyusutan"
                    value={`${shortNumber(totalPenyusutan)} kg`}
                    tone="red"
                    icon={TrendingDown}
                  />
                )}
              </div>

{/* Harga Ayam Hari Ini (khusus Admin) */}
              {isAdmin && (
                <div className="overflow-hidden rounded-2xl border border-[#191712]/10 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 border-b border-[#191712]/10 bg-gradient-to-r from-[#d9ff67] to-[#b3e619] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Tag size={18} className="text-[#191712]" />
                      <h3 className="text-base font-black text-[#191712]">Harga Ayam Hari Ini</h3>
                    </div>
                    <span className="rounded-full bg-[#191712]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#191712]">
                      {reportDate}
                    </span>
                  </div>

                  <div className="p-5">
                    {chickenPrices.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[#706858]">
                        Belum ada data harga. Tambahkan barang di <strong>Master &amp; Cadangan</strong> atau catat
                        transaksi Barang Keluar.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {chickenPrices.map((item) => {
                          // Prioritas: Harga Master Barang (Rp 23.000), lalu rata-rata transaksi hari ini
                          const displayPrice = item.buyPrice ?? item.sellToday;
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
                                    {item.buyPrice != null ? "Harga beli master" : "Harga transaksi"}
                                  </p>
                                </div>
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#191712]/5 text-[#191712]">
                                  <TrendingUp size={16} />
                                </span>
                              </div>

                              <div className="mt-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#706858]">
                                  Harga Beli / kg
                                </p>
                                <p
                                  className={`font-mono text-2xl font-black tracking-tight ${
                                    hasPrice ? "text-[#1f8f5f]" : "text-[#b0a99a]"
                                  }`}
                                >
                                  {hasPrice ? rupiah(displayPrice) : "—"}
                                </p>
                                {item.sellToday != null && item.buyPrice != null && item.sellToday !== item.buyPrice && (
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
              )}

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
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5ef] px-4 py-3 text-xs"
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
              items={items}
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
              bakulMasters={bakulMasters}
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

          {menu === "penyusutan" && (
            <PenyusutanTab
              penyusutan={penyusutan}
              stockIn={stockIn}
              stockOut={stockOut}
              itemNames={itemNames}
              role={role}
              onAddPenyusutan={handleAddPenyusutan}
              onUpdatePenyusutan={handleUpdatePenyusutan}
              onDeletePenyusutan={handleDeletePenyusutan}
            />
          )}

{menu === "laporan" && (
            <FinancialReportTab
              stockOut={stockOut}
              stockIn={stockIn}
              ops={ops}
              penyusutan={penyusutan}
              role={role}
            />
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
              penyusutan={penyusutan}
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

          {menu === "pengawasan" && (
            <PengawasanTab logs={activityLogs} onRefresh={refreshActivityLogs} />
          )}
        </motion.div>
      </section>
    </main>
  );
}
