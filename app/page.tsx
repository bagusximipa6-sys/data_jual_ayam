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
  HandCoins, // prettier-ignore
Package,
  PackagePlus,
  ShieldCheck,
ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
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
import { normalizeImportData } from "@/lib/import-adapter";
import { getTodayDate, resolveAvailableStock, rupiah, shortNumber, unique } from "@/lib/utils";
import {
  ActivityAction,
  ActivityLog,
  BakulMaster,
  BakulRecord,
  DailySale,
  ItemMaster,
  OperationalRecord,
  PenyusutanRecord,
  PriceHistory,
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
  initialPriceHistory,
  initialSales,
  initialStockIn,
  initialStockOut,
} from "./rpa-data";

const MENUS = [
  { key: "dashboard", label: "Laporan Harian", icon: ClipboardList, roles: ["user", "staf", "admin"] },
  { key: "stockin", label: "Barang Masuk", icon: PackagePlus, roles: ["user", "staf", "admin"] },
  { key: "stockout", label: "Barang Keluar", icon: Package, roles: ["user", "staf", "admin"] },
  { key: "ops", label: "Operasional", icon: HandCoins, roles: ["staf", "admin"] },
  { key: "penyusutan", label: "Penyusutan", icon: TrendingDown, roles: ["admin"] },
  { key: "bakul", label: "Piutang Bakul", icon: Users, roles: ["user", "staf", "admin"] },
  { key: "laporan", label: "Laba & Rugi", icon: FileBarChart, roles: ["admin"] },
  { key: "master", label: "Master & Cadangan", icon: Database, roles: ["user", "staf", "admin"] },
  { key: "pengawasan", label: "Alur Pengawasan", icon: ShieldCheck, roles: ["admin"] },
];

function subscribeToClient() {
  return () => {};
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Penguncian Harian (Daily Lock):
// - Tanggal hari ini (todayISO) masih bisa diedit.
// - Tanggal yang lebih kecil dari hari ini terkunci permanen (read-only).
const isRecordLocked = (date: string): boolean => {
  const today = getTodayDate();
  return typeof date === "string" && date.length >= 10 && date < today;
};

// Ambil harga aktif dari riwayat harga (priceHistory) pada tanggal transaksi.
// Logika: pilih entri dengan effectiveAt <= tanggalTransaksi yang paling akhir (terbaru).
const resolveActivePrice = (
  priceHistory: PriceHistory[],
  itemId: string,
  onDate: string
): { buyPrice: number; sellPrice: number } | null => {
  const matches = priceHistory
    .filter((ph) => ph.itemId === itemId && ph.effectiveAt <= onDate)
    .sort((a, b) => (a.effectiveAt < b.effectiveAt ? -1 : a.effectiveAt > b.effectiveAt ? 1 : 0));
  const latest = matches[matches.length - 1];
  if (!latest) return null;
  return { buyPrice: latest.buyPrice, sellPrice: latest.sellPrice };
};

export default function Home() {
  const { user } = useUser();
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const isAdmin = user?.publicMetadata?.role === "admin";
  const [menu, setMenu] = useState("dashboard");
  const role: Role =
    user?.publicMetadata?.role === "admin"
      ? "admin"
      : user?.publicMetadata?.role === "staf"
        ? "staf"
        : "user";
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
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(initialPriceHistory as PriceHistory[]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [reportDate, setReportDate] = useState<string>(() => {
    return getTodayDate();
  });

  const reconcileStockOutLinks = useCallback(
    (incomingStockIn: StockInRecord[], incomingStockOut: StockOutRecord[]): StockOutRecord[] => {
      const stockInById = new Map(incomingStockIn.map((record) => [record.id, record]));
      return incomingStockOut.map((record) => {
        if (!record.stockInId) return record;
        const linked = stockInById.get(record.stockInId);
        if (!linked) return record;
        return {
          ...record,
          itemName: linked.itemName,
          buyPrice: linked.buyPrice,
        };
      });
    },
    []
  );

  const applyDatasetToState = useCallback(
    (data: LocalDataset) => {
      const nextStockIn = data.stockIn ?? [];
      setSales(data.sales ?? []);
      setBakulRecords(data.bakulRecords ?? []);
      setOps(data.ops ?? []);
      setItems(data.items ?? []);
      setBakulMasters(data.bakulMasters ?? []);
      setStockIn(nextStockIn);
      setStockOut(reconcileStockOutLinks(nextStockIn, data.stockOut ?? []));
      setOpsCategories(data.opsCategories ?? []);
      setPenyusutan(data.penyusutan ?? []);
      setPriceHistory(data.priceHistory ?? []);
    },
    [reconcileStockOutLinks]
  );

// JSON Import & Reset
  // Menerima data mentah (bisa dari backup lama), menormalisasi ke skema baru,
  // menyimpan ke state, lalu sinkronkan ke server dengan `force` agar data
  // tanggal lampau dari backup bisa ditulis setelah reset.
  const handleImportData = useCallback(
    async (data: {
      sales: DailySale[];
      bakulRecords: BakulRecord[];
      ops: OperationalRecord[];
      items?: ItemMaster[];
      bakulMasters?: BakulMaster[];
      stockIn?: StockInRecord[];
      stockOut?: StockOutRecord[];
      opsCategories?: string[];
      penyusutan?: PenyusutanRecord[];
      priceHistory?: PriceHistory[];
    }) => {
      // Normalisasi backup lama -> skema baru (tambahkan default kolom baru,
      // sinkronkan relasi stockOut -> stockIn).
      const normalized = normalizeImportData(data);
      const final = normalized ?? {
        sales: data.sales,
        bakulRecords: data.bakulRecords,
        ops: data.ops,
        items: data.items ?? [],
        bakulMasters: data.bakulMasters ?? [],
        stockIn: data.stockIn ?? [],
        stockOut: data.stockOut ?? [],
        opsCategories: data.opsCategories ?? [],
        penyusutan: data.penyusutan ?? [],
        priceHistory: data.priceHistory ?? [],
      };

      // Update state lokal.
      applyDatasetToState(final as LocalDataset);

      // Sinkronkan ke server dengan force (restore penuh).
      setSyncStatus("saving");
      const result = await pushAllToServer(final as LocalDataset, { force: true });
      setSyncStatus(result.ok ? "saved" : "error");
      return result;
    },
    [applyDatasetToState]
  );

// === Alur Pengawasan: catat setiap aksi Tambah/Edit/Hapus ke server ===
  // Sertakan identitas user yang sedang login (dari Clerk) sebagai fallback
  // saat identitas server-side tidak tersedia di endpoint /api/activity.
  const recordActivity = useCallback(
    async (action: ActivityAction, entity: string, entityId: string, summary: string) => {
      try {
        const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? "";
        const userEmail =
          user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
          primaryEmail;
        const fullName = [user?.firstName ?? "", user?.lastName ?? ""].filter(Boolean).join(" ").trim();
        const userName = fullName || user?.username || userEmail || "";

        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, entity, entityId, summary, userEmail, userName }),
        });
      } catch {
        // Gagal mencatat aktivitas tidak boleh menghentikan aksi utama.
      }
    },
    [user]
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
          priceHistory: serverData.priceHistory ?? [],
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
          priceHistory: initialPriceHistory as PriceHistory[],
        };
setSyncStatus("saving");
        const result = await pushAllToServer(demoData);
        setSyncStatus(result.ok ? "saved" : "error");
      }
    };

    initializeData();
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
        priceHistory,
      };
const result = await pushAllToServer(dataset);
      setSyncStatus(result.ok ? "saved" : "error");
    }, 1500); // Debounce for 1.5 seconds

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, bakulRecords, ops, items, bakulMasters, stockIn, stockOut, opsCategories, penyusutan, priceHistory]);

// Effect to reset menu: belum login hanya dashboard, dan user non-admin
  // tidak bisa membuka menu yang tidak sesuai dengan role-nya.
  useEffect(() => {
    if (!user) {
      if (menu !== "dashboard") setMenu("dashboard");
      return;
    }
    const menuRoles = MENUS.find((m) => m.key === menu)?.roles ?? [];
    if (!menuRoles.includes(role)) {
      setMenu("dashboard");
    }
  }, [role, menu, user]);

// User hanya melihat menu yang diizinkan sesuai role-nya.
  // Belum login: hanya Laporan Harian (dashboard) yang bisa dibuka.
  const visibleMenus = useMemo(() => {
    if (!user) return MENUS.filter((m) => m.key === "dashboard");
    return MENUS.filter((menu) => menu.roles.includes(role));
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

  // Sisa stok harian = stok masuk tanggal laporan - stok keluar tanggal laporan.
  const dailyStockRemaining = useMemo(() => {
    const stockInTotal = stockIn
      .filter((r) => r.date === reportDate)
      .reduce((sum, r) => sum + r.quantity, 0);
    const stockOutTotal = stockOut
      .filter((r) => r.date === reportDate)
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
    if (!deleted) return;
    setBakulRecords((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Piutang Bakul", "", `${deleted.name} • ${deleted.date}`);
  };

  // CRUD Master Barang
  const handleAddItem = (newItem: ItemMaster) => {
    setItems((prev) => [newItem, ...prev]);
    // Riwayat Harga: selalu tambahkan entri baru (bukan UPDATE) dengan tanggal hari ini.
    setPriceHistory((prev) => [
      ...prev,
      { id: uid(), itemId: newItem.id, buyPrice: newItem.buyPrice, sellPrice: 0, effectiveAt: getTodayDate() },
    ]);
    recordActivity("add", "Master Barang", newItem.id, newItem.name);
  };
  const handleUpdateItem = (index: number, updatedItem: ItemMaster) => {
    setItems((prev) => prev.map((item, i) => (i === index ? updatedItem : item)));
    // Riwayat Harga: tambahkan entri baru untuk harga beli terbaru.
    setPriceHistory((prev) => [
      ...prev,
      { id: uid(), itemId: updatedItem.id, buyPrice: updatedItem.buyPrice, sellPrice: 0, effectiveAt: getTodayDate() },
    ]);
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
    // Riwayat Harga: catat harga jual baru pada tanggal hari ini.
    const newSellPrice = updatedMaster.sellPrice;
    if (newSellPrice != null && newSellPrice > 0) {
      setPriceHistory((prev) => [
        ...prev,
        { id: uid(), itemId: updatedMaster.id, buyPrice: 0, sellPrice: newSellPrice, effectiveAt: getTodayDate() },
      ]);
    }
    recordActivity("update", "Master Bakul", updatedMaster.id, updatedMaster.name);
  };
  const handleDeleteBakulMaster = (index: number) => {
    const deleted = bakulMasters[index];
    setBakulMasters((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Master Bakul", deleted.id, deleted.name);
  };

  // CRUD Transaksi Barang Masuk
  const handleAddStockIn = (record: StockInRecord) => {
    // Snapshot Harga Beli dari riwayat harga yang berlaku pada tanggal transaksi.
    const itemMaster = items.find((i) => i.name.toLowerCase() === record.itemName.toLowerCase());
    const active = itemMaster
      ? resolveActivePrice(priceHistory, itemMaster.id, record.date)
      : null;
    const snapshot = { ...record, buyPrice: active ? active.buyPrice : (itemMaster?.buyPrice ?? record.buyPrice) };
    setStockIn((prev) => [snapshot, ...prev]);
    recordActivity("add", "Barang Masuk", snapshot.id, `${snapshot.itemName} • ${snapshot.date} (+${snapshot.quantity} kg)`);
  };
  const handleUpdateStockIn = (index: number, record: StockInRecord) => {
    if (isRecordLocked(stockIn[index]?.date ?? record.date)) return;
    // Snapshot ulang harga beli yang berlaku pada tanggal transaksi.
    const itemMaster = items.find((i) => i.name.toLowerCase() === record.itemName.toLowerCase());
    const active = itemMaster
      ? resolveActivePrice(priceHistory, itemMaster.id, record.date)
      : null;
    const snapshot = { ...record, buyPrice: active ? active.buyPrice : (itemMaster?.buyPrice ?? record.buyPrice) };
    setStockIn((prev) => prev.map((item, i) => (i === index ? snapshot : item)));
    recordActivity("update", "Barang Masuk", snapshot.id, `${snapshot.itemName} • ${snapshot.date} (+${snapshot.quantity} kg)`);
  };
  const handleDeleteStockIn = (index: number) => {
    const deleted = stockIn[index];
    if (!deleted || isRecordLocked(deleted.date)) return;
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

// Resolver Harga Modal (COGS) per transaksi penjualan.
// Prioritas 1: Barang Masuk yang tertaut (stockInId) — referensi dinamis.
// Prioritas 2: Barang Masuk aktif pada tanggal transaksi (date-aware).
// Prioritas 3: harga beli master / snapshot.
const resolveStockOutCogs = (record: StockOutRecord): { itemName: string; buyPrice: number; stockInId?: string } => {
  // Jika transaksi tertaut ke Barang Masuk: pakai barang & harga beli dari sana.
  const linked = record.stockInId ? stockIn.find((si) => si.id === record.stockInId) : undefined;
  if (record.stockInId && linked) {
    return { itemName: linked.itemName, buyPrice: linked.buyPrice, stockInId: linked.id };
  }

  // Jika belum tertaut tapi ada Barang Masuk yang TERSEDIA pada tanggal itu: tautkan.
  const availableStock = resolveAvailableStock(stockIn, stockOut, record.date, [record.id]);
  if (availableStock) {
    return { itemName: availableStock.record.itemName, buyPrice: availableStock.record.buyPrice, stockInId: availableStock.record.id };
  }

  // Fallback: barang & harga beli dari Master / snapshot yang diberikan.
  const itemMaster = items.find((i) => i.name.toLowerCase() === record.itemName.toLowerCase());
  const activePrice = itemMaster
    ? resolveActivePrice(priceHistory, itemMaster.id, record.date)
    : null;
  return {
    itemName: record.itemName,
    buyPrice: activePrice ? activePrice.buyPrice : (itemMaster?.buyPrice ?? record.buyPrice ?? 0),
    stockInId: record.stockInId,
  };
};

// CRUD Transaksi Barang Keluar / Penjualan
  const handleAddStockOut = (record: StockOutRecord | StockOutRecord[]) => {
    // [MODIFIKASI] Tangani kasus di mana `record` adalah array (dari auto-splitting)
    // atau objek tunggal (jika fitur lama masih digunakan di suatu tempat).
    const recordsToAdd = Array.isArray(record) ? record : [record];

    // Jika `record` bukan array, kita perlu snapshot harga jual & COGS.
    // Jika sudah array, diasumsikan sudah di-snapshot oleh `StockOutTab`.
    if (!Array.isArray(record)) {
      const cogs = resolveStockOutCogs(record);
      const itemMaster = items.find((i) => i.name.toLowerCase() === cogs.itemName.toLowerCase());
      const activeSell = itemMaster ? resolveActivePrice(priceHistory, itemMaster.id, record.date) : null;
      const snapshot: StockOutRecord = {
        ...record,
        itemName: cogs.itemName,
        buyPrice: cogs.buyPrice,
        stockInId: cogs.stockInId,
        price: activeSell && activeSell.sellPrice > 0 ? activeSell.sellPrice : record.price,
      };
      recordsToAdd[0] = snapshot;
    }

    setStockOut((prev) => [...recordsToAdd, ...prev]);

    const piutangToAdd = recordsToAdd.map(stockOutToBakulRecord);
    setBakulRecords((prev) => [...piutangToAdd, ...prev]);

    for (const r of recordsToAdd) {
      recordActivity("add", "Barang Keluar", r.id, `${r.itemName} • ${r.bakulName} • ${r.date} (${r.quantity} kg)`);
    }
  };
  const handleUpdateStockOut = (index: number, record: StockOutRecord) => {
    if (isRecordLocked(stockOut[index]?.date ?? record.date)) return;
    const previousRecord = stockOut[index];
    const previousNote = previousRecord ? stockOutPiutangNote(previousRecord.id) : stockOutPiutangNote(record.id);
    const cogs = resolveStockOutCogs(record);
    const itemMaster = items.find((i) => i.name.toLowerCase() === cogs.itemName.toLowerCase());
    const activeSell = itemMaster
      ? resolveActivePrice(priceHistory, itemMaster.id, record.date)
      : null;
    const snapshot: StockOutRecord = {
      ...record,
      itemName: cogs.itemName,
      buyPrice: cogs.buyPrice,
      stockInId: cogs.stockInId,
      price: activeSell && activeSell.sellPrice > 0 ? activeSell.sellPrice : record.price,
    };
    const nextPiutang = stockOutToBakulRecord(snapshot);
    setStockOut((prev) => prev.map((item, i) => (i === index ? snapshot : item)));
    setBakulRecords((prev) => {
      const linkedIndex = prev.findIndex((item) => item.note === previousNote);
      if (linkedIndex === -1) return [nextPiutang, ...prev];
      return prev.map((item, i) => (i === linkedIndex ? nextPiutang : item));
    });
    recordActivity("update", "Barang Keluar", snapshot.id, `${snapshot.itemName} • ${snapshot.bakulName} • ${snapshot.date} (${snapshot.quantity} kg)`);
  };
  const handleDeleteStockOut = (index: number) => {
    const recordToDelete = stockOut[index]; // prettier-ignore
    if (!recordToDelete || isRecordLocked(recordToDelete.date)) return;

    const splitGroupId = recordToDelete.stockOutGroupId;
    const isSplitMember = Boolean(splitGroupId) || recordToDelete.birdCount != null;

    if (isSplitMember) {
      const recordsToDelete = stockOut.filter(
        (r) =>
          splitGroupId
            ? r.stockOutGroupId === splitGroupId
            : r.date === recordToDelete.date && r.bakulName === recordToDelete.bakulName && r.birdCount === recordToDelete.birdCount
      );
      const idsToDelete = new Set(recordsToDelete.map((r) => r.id));
      const notesToDelete = new Set(recordsToDelete.map((r) => stockOutPiutangNote(r.id)));

      setStockOut((prev) => prev.filter((r) => !idsToDelete.has(r.id)));
      setBakulRecords((prev) => prev.filter((br) => !notesToDelete.has(br.note)));

      recordActivity("delete", "Barang Keluar (Split)", recordToDelete.id, `Hapus ${recordsToDelete.length} penjualan split untuk ${recordToDelete.bakulName} tgl ${recordToDelete.date}`);
    } else {
      // Ini adalah record tunggal (bukan bagian dari split). Hapus hanya record ini.
      const deletedNote = stockOutPiutangNote(recordToDelete.id);
      setStockOut((prev) => prev.filter((_, i) => i !== index));
      setBakulRecords((prev) => prev.filter((item) => item.note !== deletedNote));
      recordActivity("delete", "Barang Keluar", recordToDelete.id, `${recordToDelete.itemName} • ${recordToDelete.bakulName} • ${recordToDelete.date}`);
    }
  };

  // [BARU] Fungsi atomik untuk edit dengan auto-splitting: hapus yang lama, tambah yang baru dalam satu state update.
  const handleUpdateAndResplitStockOut = (deleteIndex: number, recordsToAdd: StockOutRecord[]) => {
    const deletedRecord = stockOut[deleteIndex];
    if (!deletedRecord || isRecordLocked(deletedRecord.date)) return;

    const splitGroupId = deletedRecord.stockOutGroupId;
    const recordsToDelete = splitGroupId
      ? stockOut.filter((r) => r.stockOutGroupId === splitGroupId)
      : [deletedRecord];
    const idsToDelete = new Set(recordsToDelete.map((r) => r.id));
    const notesToDelete = new Set(recordsToDelete.map((r) => stockOutPiutangNote(r.id)));

    // Gabungkan state update dalam satu panggilan untuk menghindari race condition
    setStockOut((prev) => [...prev.filter((r, i) => i !== deleteIndex && !idsToDelete.has(r.id)), ...recordsToAdd]);
    const piutangToAdd = recordsToAdd.map(stockOutToBakulRecord);
    setBakulRecords((prev) => [...prev.filter((br) => !notesToDelete.has(br.note)), ...piutangToAdd]);

    for (const r of recordsToAdd) {
      recordActivity("add", "Barang Keluar (dari Edit)", r.id, `${r.itemName} • ${r.bakulName} • ${r.date} (${r.quantity} kg)`);
    }
  };

  // CRUD Biaya Operasional
  const handleAddOps = (record: OperationalRecord) => {
    setOps((prev) => [record, ...prev]);
    recordActivity("add", "Operasional", "", `${record.description} • ${record.date}`);
  };
  const handleUpdateOps = (index: number, record: OperationalRecord) => {
    if (isRecordLocked(ops[index]?.date ?? record.date)) return;
    setOps((prev) => prev.map((item, i) => (i === index ? record : item)));
    recordActivity("update", "Operasional", "", `${record.description} • ${record.date}`);
  };
  const handleDeleteOps = (index: number) => {
    const deleted = ops[index];
    if (!deleted || isRecordLocked(deleted.date)) return;
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

const handleDeletePenyusutan = (index: number) => {
    const deleted = penyusutan[index];
    if (!deleted || isRecordLocked(deleted.date)) return;
    setPenyusutan((prev) => prev.filter((_, i) => i !== index));
    if (deleted) recordActivity("delete", "Penyusutan", deleted.id, `${deleted.itemName} • ${deleted.date}`);
  };

  // Daily Stock Reset: simpan beberapa catatan penyusutan otomatis sekaligus.
  const handleAutoGeneratePenyusutan = (records: PenyusutanRecord[]) => {
    if (!records || records.length === 0) return;
    setPenyusutan((prev) => [...records, ...prev]);
    for (const r of records) {
      recordActivity("add", "Penyusutan", r.id, `${r.itemName} • ${r.date} (Auto Stock Reset −${r.amount} kg)`);
    }
  };

const handleResetData = async () => {
    setSyncStatus("saving");
    let resetOk = false;
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      resetOk = res.ok;
      if (!resetOk) {
        setSyncStatus("error");
        console.error("Failed to reset data on server:", res.status, await res.text());
        return; // Stop execution if reset fails
      }
    } catch {
      resetOk = false;
      setSyncStatus("error");
      return;
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
    setPriceHistory(initialPriceHistory as PriceHistory[]);

// Re-seed the server with the initial (demo) data.
    const result = await pushAllToServer({
      sales: initialSales as DailySale[],
      bakulRecords: initialBakulRecords as BakulRecord[],
      ops: initialOperationalRecords as OperationalRecord[],
      items: initialItems as ItemMaster[],
      bakulMasters: initialBakulMasters as BakulMaster[],
      stockIn: initialStockIn as StockInRecord[],
      stockOut: initialStockOut as StockOutRecord[],
      opsCategories: initialOpsCategories as string[],
      penyusutan: initialPenyusutan as PenyusutanRecord[],
      priceHistory: initialPriceHistory as PriceHistory[],
    });
    setSyncStatus(result.ok ? "saved" : "error");
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
              stockIn={stockIn}
              allStockOut={stockOut}
              itemNames={itemNames}
              bakulNames={bakulNames}
              bakulMasters={bakulMasters}
              role={role}
              onAddStockOut={handleAddStockOut}
              onUpdateStockOut={handleUpdateStockOut}
              onUpdateAndResplitStockOut={handleUpdateAndResplitStockOut}
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
              role={role}
              onDeletePenyusutan={handleDeletePenyusutan}
              onAutoGeneratePenyusutan={handleAutoGeneratePenyusutan}
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
