"use client";

import { Progress, Tab, Tabs } from "@heroui/react";
import { motion } from "framer-motion";
import { Banknote, HandCoins, ReceiptText, Scale, TrendingUp, WalletCards } from "lucide-react";
import type { Key } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { BakulTab } from "@/components/BakulTab";
import { Header } from "@/components/Header";
import { MasterTab } from "@/components/MasterTab";
import { MetricCard } from "@/components/MetricCard";
import { OpsTab } from "@/components/OpsTab";
import { ReportsTab } from "@/components/ReportsTab";
import { SalesProfitChart } from "@/components/SalesProfitChart";
import { SalesTab } from "@/components/SalesTab";
import { getMonthLabel, rupiah, shortNumber, unique } from "@/lib/utils";
import { BakulRecord, DailySale, OperationalRecord, Role } from "@/types/finance";
import { initialBakulRecords, initialOperationalRecords, initialSales } from "./rpa-data";

const SALES_KEY = "finance_book_rpa_sales_v1";
const BAKUL_KEY = "finance_book_rpa_bakul_v1";
const OPS_KEY = "finance_book_rpa_ops_v1";
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
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

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

  // Extract available months for dropdown
  const availableMonths = useMemo(() => {
    const months = sales.map((s) => s.date.slice(0, 7));
    return unique(months).sort().reverse();
  }, [sales]);

  // Filtered data by month
  const filteredSales = useMemo(() => {
    if (selectedMonth === "all") return sales;
    return sales.filter((s) => s.date.startsWith(selectedMonth));
  }, [sales, selectedMonth]);

  const filteredBakul = useMemo(() => {
    if (selectedMonth === "all") return bakulRecords;
    return bakulRecords.filter((b) => b.date.startsWith(selectedMonth));
  }, [bakulRecords, selectedMonth]);

  const filteredOps = useMemo(() => {
    if (selectedMonth === "all") return ops;
    return ops.filter((o) => o.date.startsWith(selectedMonth));
  }, [ops, selectedMonth]);

  // Overall Financial Summary
  const summary = useMemo(() => {
    const modal = filteredSales.reduce((sum, item) => sum + item.modalTotal, 0);
    const penjualan = filteredSales.reduce((sum, item) => sum + item.saleTotal, 0);
    const opFromSales = filteredSales.reduce((sum, item) => sum + item.operational, 0);
    const opDetail = filteredOps.reduce((sum, item) => sum + item.amount, 0);
    const labaKotor = filteredSales.reduce((sum, item) => sum + item.grossProfit, 0);
    const labaBersih = filteredSales.reduce((sum, item) => sum + item.netProfit, 0);
    const piutang = filteredBakul.reduce((sum, item) => sum + Math.max(item.balance, 0), 0);
    const dibayar = filteredBakul.reduce((sum, item) => sum + item.paid, 0);
    const target = filteredSales.reduce((sum, item) => sum + item.target, 0);
    const penyusutan = filteredSales.reduce((sum, item) => sum + item.shrink, 0);
    return { modal, penjualan, opFromSales, opDetail, labaKotor, labaBersih, piutang, dibayar, target, penyusutan };
  }, [filteredSales, filteredBakul, filteredOps]);

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

  const categories = useMemo(() => unique(filteredOps.map((item) => item.description.toLowerCase())), [filteredOps]);
  const bakulNames = useMemo(() => unique(bakulRecords.map((item) => item.name)), [bakulRecords]);

  // Chart data
  const chartRows = useMemo(
    () =>
      [...filteredSales]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({
          date: item.date,
          label: item.date.slice(5),
          sales: item.saleTotal,
          profit: item.netProfit,
        })),
    [filteredSales]
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

  // CRUD Sales
  const handleAddSale = (newSale: DailySale) => {
    setSales((prev) => [newSale, ...prev]);
  };
  const handleUpdateSale = (index: number, updatedSale: DailySale) => {
    setSales((prev) => prev.map((item, i) => (i === index ? updatedSale : item)));
  };
  const handleDeleteSale = (index: number) => {
    setSales((prev) => prev.filter((_, i) => i !== index));
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

  // CRUD Ops
  const handleAddOps = (newRecord: OperationalRecord) => {
    setOps((prev) => [newRecord, ...prev]);
  };
  const handleUpdateOps = (index: number, updatedRecord: OperationalRecord) => {
    setOps((prev) => prev.map((item, i) => (i === index ? updatedRecord : item)));
  };
  const handleDeleteOps = (index: number) => {
    setOps((prev) => prev.filter((_, i) => i !== index));
  };

  // JSON Import & Reset
  const handleImportData = (data: { sales: DailySale[]; bakulRecords: BakulRecord[]; ops: OperationalRecord[] }) => {
    setSales(data.sales);
    setBakulRecords(data.bakulRecords);
    setOps(data.ops);
  };

  const handleResetData = () => {
    setSales(initialSales as DailySale[]);
    setBakulRecords(initialBakulRecords as BakulRecord[]);
    setOps(initialOperationalRecords as OperationalRecord[]);
    localStorage.removeItem(SALES_KEY);
    localStorage.removeItem(BAKUL_KEY);
    localStorage.removeItem(OPS_KEY);
  };

  const menus = [
    ["dashboard", "Dashboard Summary"],
    ["sales", "Rekap Penjualan"],
    ["bakul", "Piutang Bakul"],
    ["ops", "Biaya Operasional"],
    ["reports", "Laporan Keuangan"],
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
        salesCount={sales.length}
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
              {/* Metric Cards Grid */}
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="Total Modal" value={rupiah(summary.modal)} tone="plain" icon={WalletCards} />
                <MetricCard label="Total Penjualan" value={rupiah(summary.penjualan)} tone="blue" icon={TrendingUp} />
                <MetricCard label="Biaya Operasional" value={rupiah(summary.opFromSales)} tone="red" icon={ReceiptText} />
                <MetricCard label="Laba Bersih" value={rupiah(summary.labaBersih)} tone="green" icon={Banknote} />
                <MetricCard label="Sisa Piutang" value={rupiah(summary.piutang)} tone="yellow" icon={HandCoins} />
                <MetricCard label="Penyusutan Telur" value={`${shortNumber(summary.penyusutan)} kg`} tone="purple" icon={Scale} />
              </div>

              {/* Interactive Sales & Profit Chart */}
              <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-[#191712]">Grafik Penjualan & Laba Bersih</h2>
                  <span className="text-xs text-[#706858] font-bold">
                    Periode: {selectedMonth === "all" ? "Semua Data" : getMonthLabel(selectedMonth)}
                  </span>
                </div>
                <SalesProfitChart rows={chartRows} />
              </div>

              {/* Bottom Dashboard Grids */}
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                {/* Recent Sales List */}
                <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
                  <h2 className="text-xl font-black text-[#191712]">Rekap Penjualan Terbaru</h2>
                  <div className="space-y-3">
                    {filteredSales.slice(0, 6).map((item) => (
                      <div
                        key={`${item.date}-${item.saleTotal}`}
                        className="flex items-center justify-between rounded-xl bg-[#f7f5ef] p-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-sm text-[#191712]">{item.date}</p>
                          <p className="text-[#706858]">
                            Jual {shortNumber(item.saleQty)} kg • Modal {shortNumber(item.modalQty)} kg
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono font-black text-sm ${item.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}`}>
                            {rupiah(item.netProfit)}
                          </p>
                          <p className="text-[10px] text-[#706858] uppercase font-bold">
                            {item.note || "Laba Bersih"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bakul Balances Overview */}
                <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
                  <h2 className="text-xl font-black text-[#191712]">Sisa Piutang Per Bakul</h2>
                  <div className="space-y-4">
                    {bakulSummary.slice(0, 8).map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-[#191712]">
                          <span>{item.name}</span>
                          <span className="font-mono">{rupiah(item.balance)}</span>
                        </div>
                        <Progress
                          aria-label={`Piutang ${item.name}`}
                          value={item.bill ? Math.min(100, Math.max(0, Math.round((item.balance / item.bill) * 100))) : 0}
                          size="sm"
                          classNames={{ indicator: "bg-[#e05234]" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {menu === "sales" && (
            <SalesTab
              sales={filteredSales}
              role={role}
              onAddSale={handleAddSale}
              onUpdateSale={handleUpdateSale}
              onDeleteSale={handleDeleteSale}
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
              ops={filteredOps}
              categories={categories}
              role={role}
              onAddOps={handleAddOps}
              onUpdateOps={handleUpdateOps}
              onDeleteOps={handleDeleteOps}
            />
          )}

          {menu === "reports" && (
            <ReportsTab
              summary={summary}
              sales={filteredSales}
              bakulRecords={filteredBakul}
              ops={filteredOps}
              categoriesCount={categories.length}
              bakulCount={bakulSummary.length}
            />
          )}

          {menu === "master" && (
            <MasterTab
              bakulSummary={bakulSummary}
              categories={categories}
              sales={sales}
              bakulRecords={bakulRecords}
              ops={ops}
              role={role}
              onImportData={handleImportData}
              onResetData={handleResetData}
            />
          )}
        </motion.div>
      </section>
    </main>
  );
}
