"use client";

import { Button, Chip, Divider, Input } from "@heroui/react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getMonthLabel, rupiah, shortNumber, getTodayDate } from "@/lib/utils";
import {  
  OperationalRecord,
  PenyusutanRecord,
  ProfitLossSummary,
  Role,
  SaleBreakdown,
  SaleType,
  StockInRecord,
  StockOutRecord,
} from "@/types/finance";

interface FinancialReportTabProps {
  stockOut: StockOutRecord[];
  stockIn: StockInRecord[];
  ops: OperationalRecord[];
  penyusutan?: PenyusutanRecord[];
  role: Role;
}

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

// ===== Helpers to build Profit/Loss summary =====

const emptyBreakdown = (): SaleBreakdown => ({
  eceranQty: 0,
  eceranOmzet: 0,
  grosirQty: 0,
  grosirOmzet: 0,
  eceranCount: 0,
  grosirCount: 0,
});

const addToBreakdown = (
  bd: SaleBreakdown,
  saleType: SaleType | undefined,
  qty: number,
  omzet: number
) => {
  if (saleType === "grosir") {
    bd.grosirQty += qty;
    bd.grosirOmzet += omzet;
    bd.grosirCount += 1;
  } else {
    bd.eceranQty += qty;
    bd.eceranOmzet += omzet;
    bd.eceranCount += 1;
  }
};

const mergeBreakdown = (target: SaleBreakdown, source: SaleBreakdown) => {
  target.eceranQty += source.eceranQty;
  target.eceranOmzet += source.eceranOmzet;
  target.grosirQty += source.grosirQty;
  target.grosirOmzet += source.grosirOmzet;
  target.eceranCount += source.eceranCount;
  target.grosirCount += source.grosirCount;
};

const getShortMonth = (dateStr: string) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = parseInt(dateStr.slice(5, 7), 10) - 1;
  return monthNames[month] ?? dateStr;
};

const dummyPaymentBreakdown = {
  cashQty: 0,
  cashOmzet: 0,
  cashCount: 0,
  transferQty: 0,
  transferOmzet: 0,
  transferCount: 0,
  hutangQty: 0,
  hutangOmzet: 0,
  hutangCount: 0,
};

// Resolver harga beli yang sadar-tanggal (date-aware).
// Menghindari bug di mana transaksi lama ikut berubah saat harga master barang di-edit:
// harga beli transaksi diambil dari snapshot Barang Masuk yang berlaku PADA/BELUM melampaui
// tanggal transaksi tersebut, sehingga laporan lama memakai harga yang benar saat itu —
// bukan harga terbaru yang di-edit belakangan.
const buildBuyPriceResolver = (stockIn: StockInRecord[]) => {
  // Map: itemName(lowercase) -> daftar {date, buyPrice} terurut menaik berdasarkan tanggal.
  const byItem = new Map<string, Array<{ date: string; buyPrice: number }>>();
  for (const record of stockIn) {
    const key = record.itemName.toLowerCase();
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push({ date: record.date, buyPrice: record.buyPrice });
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Ambil harga beli yang berlaku pada tanggal tertentu (entri terakhir dgn date <= onDate).
  const resolve = (itemName: string, onDate: string): number | null => {
    const list = byItem.get(itemName.toLowerCase());
    if (!list || list.length === 0) return null;
    let price: number | null = null;
    for (const entry of list) {
      if (entry.date <= onDate) price = entry.buyPrice;
      else break;
    }
    return price;
  };

  return resolve;
};

const buildProfitLoss = (
  stockOut: StockOutRecord[],
  stockIn: StockInRecord[],
  ops: OperationalRecord[],
  penyusutan: PenyusutanRecord[] = []
): ProfitLossSummary => {
  // Resolver harga beli per-tanggal berdasarkan snapshot Barang Masuk.
  const resolveBuyPrice = buildBuyPriceResolver(stockIn);

  // Map id Barang Masuk -> record, untuk referensi dinamis (foreign key).
  const stockInById = new Map<string, StockInRecord>();
  for (const si of stockIn) {
    if (!stockInById.has(si.id)) stockInById.set(si.id, si);
  }

  // Resolver COGS (Harga Modal / kg) per transaksi penjualan.
  // Prioritas 1: Barang Masuk yang tertaut (stockInId) — referensi dinamis otomatis.
  // Prioritas 2: snapshot Harga Beli tersimpan pada transaksi (harga terkunci).
  // Prioritas 3: Barang Masuk aktif pada tanggal transaksi (date-aware).
  // Dengan ini, setiap transaksi penjualan memakai Harga Modal dari Barang Masuk
  // yang aktif pada hari itu — bukan nyantol ke barang/harga lain.
  const resolveModal = (record: StockOutRecord): number => {
    if (record.stockInId) {
      const linked = stockInById.get(record.stockInId);
      if (linked && linked.buyPrice > 0) return linked.buyPrice;
    }
    if (record.buyPrice != null && record.buyPrice > 0) return record.buyPrice;
    return resolveBuyPrice(record.itemName, record.date) ?? 0;
  };

  // Map operational expenses by date
  const opsByDate = new Map<string, number>();
  for (const op of ops) {
    opsByDate.set(op.date, (opsByDate.get(op.date) ?? 0) + op.amount);
  }

  const penyusutanByDate = new Map<string, number>();
  for (const record of penyusutan) {
    const buyPrice = resolveBuyPrice(record.itemName, record.date) ?? 0;
    const lossValue = record.amount * buyPrice;
    penyusutanByDate.set(record.date, (penyusutanByDate.get(record.date) ?? 0) + lossValue);
  }

  // Build daily items from each StockOut record
  const dailyMap = new Map<string, ProfitLossSummary["daily"][number]>();
  const totalPenyusutanValue = Array.from(penyusutanByDate.values()).reduce((sum, value) => sum + value, 0);

  const sorted = [...stockOut].sort((a, b) => a.date.localeCompare(b.date));

for (const record of sorted) {
    // Harga Modal (COGS) per unit diambil secara dinamis dari Barang Masuk yang tertaut
    // pada tanggal transaksi (referensi otomatis), sehingga laporan memakai modal yang
    // akurat — bukan nyantol ke barang/harga lain.
    const buyPrice = resolveModal(record);
    const omzet = record.quantity * record.price;
    const modalCost = record.quantity * buyPrice;
    const profit = omzet - modalCost;

const existing = dailyMap.get(record.date);
    const itemRow = {
      id: record.id,
      date: record.date,
      itemName: record.itemName,
      bakulName: record.bakulName,
      quantity: record.quantity,
      sellPrice: record.price,
      buyPrice,
      omzet,
      modalCost,
      profit,
      saleType: (record.saleType ?? "eceran") as SaleType,
    };

    if (existing) {
      existing.items.push(itemRow);
      existing.totalQuantity += record.quantity;
      existing.totalOmzet += omzet;
      existing.totalModal += modalCost;
      existing.totalProfit += profit;
      addToBreakdown(existing.saleBreakdown, record.saleType, record.quantity, omzet);
    } else {
      const breakdown = emptyBreakdown();
      addToBreakdown(breakdown, record.saleType, record.quantity, omzet);
      dailyMap.set(record.date, {
        date: record.date,
        totalQuantity: record.quantity,
        totalOmzet: omzet,
        totalModal: modalCost,
        totalProfit: profit,
        totalOperational: 0,
        totalPenyusutan: 0,
        netProfit: profit,
        saleBreakdown: breakdown,
        items: [itemRow],
        paymentBreakdown: dummyPaymentBreakdown,
      });
    }
  }

  for (const date of penyusutanByDate.keys()) {
    if (dailyMap.has(date)) continue;
    dailyMap.set(date, {
      date,
      totalQuantity: 0,
      totalOmzet: 0,
      totalModal: 0,
      totalProfit: 0,
      totalOperational: 0,
      totalPenyusutan: 0,
      netProfit: 0,
      saleBreakdown: emptyBreakdown(),
      items: [],
      paymentBreakdown: dummyPaymentBreakdown,
    });
  }

  // Attach operational expense and nominal penyusutan per date, then compute net profit.
  const daily = Array.from(dailyMap.values()).map((day) => {
    const totalOperational = opsByDate.get(day.date) ?? 0;
    const totalPenyusutan = penyusutanByDate.get(day.date) ?? 0;
    return {
      ...day,
      totalOperational,
      totalPenyusutan,
      netProfit: day.totalProfit - totalOperational - totalPenyusutan,
    };
  });

// Weekly aggregation (week ending on Saturday, i.e. Sunday - Saturday)
  const weeklyMap = new Map<string, ProfitLossSummary["weekly"][number]>();
  const monthlyMap = new Map<string, ProfitLossSummary["monthly"][number]>();

  for (const day of daily) {
    const date = new Date(`${day.date}T00:00:00`);
    const dayIdx = date.getDay(); // 0 = Sun, 6 = Sat
    // Offset to reach the Saturday that ends the current week
    const saturdayOffset = (6 - dayIdx + 7) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() + saturdayOffset);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() - 6);

    const fmt = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${mm}-${dd}`;
    };

    const weekStart = fmt(sunday);
    const weekEnd = fmt(saturday);
    const weekKey = `${weekStart}|${weekEnd}`;
    const weekLabel = `${weekStart.slice(8, 10)} ${getShortMonth(weekStart)} - ${weekEnd.slice(8, 10)} ${getShortMonth(weekEnd)} (Sabtu)`;

const existingWeek = weeklyMap.get(weekKey);
    if (existingWeek) {
      existingWeek.totalQuantity += day.totalQuantity;
      existingWeek.totalOmzet += day.totalOmzet;
      existingWeek.totalModal += day.totalModal;
      existingWeek.totalProfit += day.totalProfit;
      existingWeek.totalOperational += day.totalOperational;
      existingWeek.totalPenyusutan += day.totalPenyusutan;
      existingWeek.netProfit += day.netProfit;
      mergeBreakdown(existingWeek.saleBreakdown, day.saleBreakdown);
    } else {
      weeklyMap.set(weekKey, {
        label: weekLabel,
        period: weekKey,
        totalQuantity: day.totalQuantity,
        totalOmzet: day.totalOmzet,
        totalModal: day.totalModal,
        totalProfit: day.totalProfit,
        totalOperational: day.totalOperational,
        totalPenyusutan: day.totalPenyusutan,
        netProfit: day.netProfit,
        saleBreakdown: { ...day.saleBreakdown },
        paymentBreakdown: day.paymentBreakdown,
      });
    }

    const monthKey = day.date.slice(0, 7);
    const existingMonth = monthlyMap.get(monthKey);
    if (existingMonth) {
      existingMonth.totalQuantity += day.totalQuantity;
      existingMonth.totalOmzet += day.totalOmzet;
      existingMonth.totalModal += day.totalModal;
      existingMonth.totalProfit += day.totalProfit;
      existingMonth.totalOperational += day.totalOperational;
      existingMonth.totalPenyusutan += day.totalPenyusutan;
      existingMonth.netProfit += day.netProfit;
      mergeBreakdown(existingMonth.saleBreakdown, day.saleBreakdown);
    } else {
      monthlyMap.set(monthKey, {
        label: getMonthLabel(monthKey),
        period: monthKey,
        totalQuantity: day.totalQuantity,
        totalOmzet: day.totalOmzet,
        totalModal: day.totalModal,
        totalProfit: day.totalProfit,
        totalOperational: day.totalOperational,
        totalPenyusutan: day.totalPenyusutan,
        netProfit: day.netProfit,
        saleBreakdown: { ...day.saleBreakdown },
        paymentBreakdown: day.paymentBreakdown,
      });
    }
  }

  const weekly = Array.from(weeklyMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  const monthly = Array.from(monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period));

  const totalBreakdown = emptyBreakdown();
  for (const day of daily) {
    mergeBreakdown(totalBreakdown, day.saleBreakdown);
  }

  return {
    daily,
    weekly,
    monthly,
    totalOmzet: daily.reduce((sum, d) => sum + d.totalOmzet, 0),
    totalModal: daily.reduce((sum, d) => sum + d.totalModal, 0),
totalProfit: daily.reduce((sum, d) => sum + d.totalProfit, 0),
    totalOperational: daily.reduce((sum, d) => sum + d.totalOperational, 0),
    netProfit: daily.reduce((sum, d) => sum + d.netProfit, 0),
    netProfitAfterPenyusutan: daily.reduce((sum, d) => sum + d.netProfit, 0),
    totalPenyusutan: totalPenyusutanValue,
    totalQuantity: daily.reduce((sum, d) => sum + d.totalQuantity, 0),
    saleBreakdown: totalBreakdown,
    paymentBreakdown: dummyPaymentBreakdown,
  };
};

const exportProfitCSV = (summary: ProfitLossSummary) => {
  const rows: string[][] = [
    [
      "Tanggal",
      "Total Qty",
      "Total Omzet",
      "Total Modal",
      "Total Laba Kotor",
      "Biaya Operasional",
      "Beban Penyusutan / Loss",
      "Laba Bersih",
      "Qty Eceran",
      "Omzet Eceran",
      "Qty Grosir",
      "Omzet Grosir",
    ],
    ...summary.daily.map((d) => [
      d.date,
      String(d.totalQuantity),
      String(d.totalOmzet),
      String(d.totalModal),
      String(d.totalProfit),
      String(d.totalOperational),
      String(d.totalPenyusutan),
      String(d.netProfit),
      String(d.saleBreakdown.eceranQty),
      String(d.saleBreakdown.eceranOmzet),
      String(d.saleBreakdown.grosirQty),
      String(d.saleBreakdown.grosirOmzet),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "laporan_laba_rugi.csv");
document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportProfitPDF = (summary: ProfitLossSummary) => {
  const doc = new jsPDF();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Keuangan & Laba Rugi", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
doc.text("Buku Keuangan Usaha - Data Jual Ayam", 14, 22);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 27);
  doc.setDrawColor(180);
  doc.line(14, 30, 196, 30);

  // Summary block with background
  const summaryStartX = 14;
  const summaryWidth = 182;
  let y = 38;

  const summaryLines: Array<[string, string, string?]> = [
    ["Total Barang Keluar", `${shortNumber(summary.totalQuantity)} kg`],
    ["Total Omzet / Penjualan", rupiah(summary.totalOmzet)],
    ["Total Modal (Harga Beli)", rupiah(summary.totalModal)],
    ["Total Laba Kotor", rupiah(summary.totalProfit)],
    ["Biaya Operasional", rupiah(summary.totalOperational)],
    ["Beban Penyusutan / Loss", rupiah(summary.totalPenyusutan)],
    ["Laba Bersih", rupiah(summary.netProfit)],
  ];

  const summaryBlockHeight = 8 + summaryLines.length * 7 + 5;
  doc.setFillColor(247, 245, 239); // Light beige background
  doc.roundedRect(summaryStartX, y - 5, summaryWidth, summaryBlockHeight, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ringkasan Keuangan", summaryStartX + 5, y);
  y += 8;

  doc.setFontSize(10);
  summaryLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, summaryStartX + 5, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, summaryStartX + summaryWidth - 5, y, { align: "right" });
    y += 7;
  });

  // Monthly table
  let lastY = y + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pendapatan Bulanan", 14, lastY);
  if (summary.monthly.length > 0) {
    autoTable(doc, {
      startY: lastY + 3,
      head: [["Periode", "Qty (kg)", "Omzet", "Modal", "Laba Kotor", "Ops", "Susut", "Laba Bersih"]],
      body: summary.monthly.map((row) => [
        row.label,
        shortNumber(row.totalQuantity),
        rupiah(row.totalOmzet),
        rupiah(row.totalModal),
        rupiah(row.totalProfit),
        rupiah(row.totalOperational),
        rupiah(row.totalPenyusutan),
        rupiah(row.netProfit),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 23, 18], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 245, 239] },
    });
    lastY = (doc as jsPDFWithAutoTable).lastAutoTable.finalY;
  }

  // Weekly table
  lastY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pendapatan Mingguan", 14, lastY);
  if (summary.weekly.length > 0) {
    autoTable(doc, {
      startY: lastY + 3,
      head: [["Periode Minggu", "Qty (kg)", "Omzet", "Modal", "Laba Kotor", "Ops", "Susut", "Laba Bersih"]],
      body: summary.weekly.map((row) => [
        row.label,
        shortNumber(row.totalQuantity),
        rupiah(row.totalOmzet),
        rupiah(row.totalModal),
        rupiah(row.totalProfit),
        rupiah(row.totalOperational),
        rupiah(row.totalPenyusutan),
        rupiah(row.netProfit),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 23, 18], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 245, 239] },
    });
    lastY = (doc as jsPDFWithAutoTable).lastAutoTable.finalY;
  }

  // Daily table
  lastY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pendapatan Harian", 14, lastY);
  if (summary.daily.length > 0) {
    autoTable(doc, {
      startY: lastY + 3,
      head: [["Tanggal", "Qty (kg)", "Omzet", "Modal", "Laba Kotor", "Ops", "Susut", "Laba Bersih"]],
      body: summary.daily
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => [
          d.date,
          shortNumber(d.totalQuantity),
          rupiah(d.totalOmzet),
          rupiah(d.totalModal),
          rupiah(d.totalProfit),
          rupiah(d.totalOperational),
          rupiah(d.totalPenyusutan),
          rupiah(d.netProfit),
        ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 23, 18], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 245, 239] },
    });
  }

  doc.save("laporan_laba_rugi.pdf");
};

export function FinancialReportTab({ stockOut, stockIn, ops, penyusutan = [], role }: FinancialReportTabProps) {
  const [dateFilter, setDateFilter] = useState(getTodayDate());
  const isAdmin = role === "admin";

  const summary = useMemo(
    () => buildProfitLoss(stockOut, stockIn, ops, penyusutan),
    [stockOut, stockIn, ops, penyusutan]
  );

  const filteredDaily = useMemo(() => {
    // Jika filter tanggal kosong (misal setelah di-clear), tampilkan array kosong
    // agar tidak ada data yang muncul, sesuai permintaan.
    if (!dateFilter) return [];
    return summary.daily.filter((d) => d.date === dateFilter);
  }, [summary.daily, dateFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#191712]/10 bg-white p-4 sm:px-6">
        <div>
          <h2 className="text-xl font-black text-[#191712]">Laporan Keuangan & Laba Rugi</h2>
          <p className="text-xs text-[#706858]">
            Pendapatan Harian = (Stok Keluar × Harga Jual) − (Stok Keluar × Harga Beli)
          </p>
        </div>
<div className="flex flex-wrap items-center gap-2">
<Button
            size="sm"
            className="bg-[#191712] font-bold text-white"
            startContent={<FileSpreadsheet size={15} />}
            onPress={() => exportProfitCSV(summary)}
            radius="sm"
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="bg-[#e6f1ff] font-bold text-[#173a61]"
            startContent={<FileText size={15} />}
            onPress={() => exportProfitPDF(summary)}
            radius="sm"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-900">
          🔒 <strong>Laporan Keuangan & Laba Rugi</strong> khusus Owner (Mode Admin). Silakan buka Mode Admin
          terlebih dahulu untuk melihat laporan.
        </div>
      ) : (
        <>
{/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total Barang Keluar" value={`${shortNumber(summary.totalQuantity)} kg`} tone="plain" />
            <SummaryCard label="Total Omzet / Penjualan" value={rupiah(summary.totalOmzet)} tone="blue" />
            <SummaryCard label="Total Modal (Harga Beli)" value={rupiah(summary.totalModal)} tone="yellow" />
            <SummaryCard
              label="Total Laba Kotor"
              value={rupiah(summary.totalProfit)}
              tone={summary.totalProfit >= 0 ? "green" : "red"}
            />
          </div>

{/* Detail: Operasional & Grosir/Eceran */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<SummaryCard
              label="Biaya Operasional"
              value={rupiah(summary.totalOperational)}
              tone="red"
            />
            <SummaryCard
              label="Beban Penyusutan / Loss"
              value={rupiah(summary.totalPenyusutan)}
              tone="red"
            />
            <SummaryCard
              label="Laba Bersih"
              value={rupiah(summary.netProfit)}
              tone={summary.netProfit >= 0 ? "green" : "red"}
            />
            <SummaryCard
              label="Rumus Laba Bersih"
              value="Omzet - Modal - Ops - Susut"
              tone="plain"
            />
          </div>

          {/* Payment Method Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard
              label="Total Penjualan (Eceran & Grosir)"
              value={`${shortNumber(summary.totalQuantity)} kg • ${rupiah(summary.totalOmzet)}`}
              tone="blue"
            />
          </div>

          {/* Monthly Report */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-black text-[#191712]">Pendapatan Bulanan</h3>
              <p className="text-xs text-[#706858]">Akumulasi pendapatan & laba per bulan.</p>
            </div>
            <Divider className="bg-[#191712]/5" />
            {summary.monthly.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#706858]">
                Belum ada data penjualan untuk ditampilkan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
<tr className="border-b border-[#191712]/10 text-[#706858]">
                      <th className="py-2 pr-4 font-bold">Periode</th>
                      <th className="py-2 pr-4 font-bold text-right">Qty (kg)</th>
                      <th className="py-2 pr-4 font-bold text-right">Omzet</th>
                      <th className="py-2 pr-4 font-bold text-right">Modal</th>
                      <th className="py-2 pr-4 font-bold text-right">Laba Kotor</th>
                      <th className="py-2 pr-4 font-bold text-right">Ops</th>
                      <th className="py-2 pr-4 font-bold text-right">Susut</th>
                      <th className="py-2 font-bold text-right">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly.map((row) => (
                      <tr key={row.period} className="border-b border-[#191712]/5">
                        <td className="py-2 pr-4 font-bold text-[#191712]">{row.label}</td>
                        <td className="py-2 pr-4 text-right font-mono">{shortNumber(row.totalQuantity)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalOmzet)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalModal)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalProfit)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-[#8f321a]">{rupiah(row.totalOperational)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-[#8f321a]">{rupiah(row.totalPenyusutan)}</td>
                        <td
                          className={`py-2 text-right font-mono font-black ${
                            row.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"
                          }`}
                        >
                          {rupiah(row.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Weekly Report */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div>
<h3 className="text-lg font-black text-[#191712]">Pendapatan Mingguan (per Sabtu)</h3>
              <p className="text-xs text-[#706858]">Akumulasi pendapatan & laba per minggu (Minggu - Sabtu).</p>
            </div>
            <Divider className="bg-[#191712]/5" />
            {summary.weekly.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#706858]">
                Belum ada data penjualan untuk ditampilkan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#191712]/10 text-[#706858]">
                      <th className="py-2 pr-4 font-bold">Periode Minggu</th>
                      <th className="py-2 pr-4 font-bold text-right">Qty (kg)</th>
                      <th className="py-2 pr-4 font-bold text-right">Omzet</th>
                      <th className="py-2 pr-4 font-bold text-right">Modal</th>
                      <th className="py-2 pr-4 font-bold text-right">Laba Kotor</th>
                      <th className="py-2 pr-4 font-bold text-right">Ops</th>
                      <th className="py-2 pr-4 font-bold text-right">Susut</th>
                      <th className="py-2 font-bold text-right">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.weekly.map((row) => (
                      <tr key={row.period} className="border-b border-[#191712]/5">
                        <td className="py-2 pr-4 font-bold text-[#191712]">{row.label}</td>
                        <td className="py-2 pr-4 text-right font-mono">{shortNumber(row.totalQuantity)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalOmzet)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalModal)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{rupiah(row.totalProfit)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-[#8f321a]">{rupiah(row.totalOperational)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-[#8f321a]">{rupiah(row.totalPenyusutan)}</td>
                        <td
                          className={`py-2 text-right font-mono font-black ${
                            row.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"
                          }`}
                        >
                          {rupiah(row.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daily Report Detail */}
          <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[#191712]">Pendapatan Harian</h3>
                <p className="text-xs text-[#706858]">
                  {dateFilter ? `Menampilkan tanggal ${dateFilter}` : "Pilih tanggal untuk melihat detail"} • {filteredDaily.length} hari
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  size="sm"
                  className="w-full sm:w-[180px]"
                  value={dateFilter}
                  onValueChange={setDateFilter}
                  aria-label="Filter Tanggal"
                  radius="sm"
                  isClearable
                  onClear={() => setDateFilter("")} // Mengosongkan filter akan menyembunyikan semua data
                />
                <Chip size="sm" className="bg-[#f0eadb] font-bold text-[#191712]">
                  {filteredDaily.length} Hari
                </Chip>
              </div>
            </div>
            <Divider className="bg-[#191712]/5" />
            {filteredDaily.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#706858]">
                Tidak ada data penjualan pada periode ini.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredDaily
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((day) => (
                    <div key={day.date} className="rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-black text-[#191712]">{day.date}</h4>
                          <p className="text-[10px] text-[#706858] font-bold uppercase">
                            {day.items.length} transaksi • {shortNumber(day.totalQuantity)} kg
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#191712]">{rupiah(day.totalOmzet)}</p>
                          <p className="text-[10px] text-[#706858] font-bold">
                            Laba Kotor: <span className={day.totalProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}>{rupiah(day.totalProfit)}</span>
                            {" • "}Ops: <span className="text-[#8f321a]">{rupiah(day.totalOperational)}</span>
                            {" • "}Susut: <span className="text-[#8f321a]">{rupiah(day.totalPenyusutan)}</span>
                            {" • "}Laba Bersih: <span className={day.netProfit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}>{rupiah(day.netProfit)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Daily Eceran/Grosir breakdown */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className="rounded-full bg-[#e6f1ff] px-2 py-0.5 text-[#173a61] uppercase tracking-wide">
                          Eceran: {shortNumber(day.saleBreakdown.eceranQty)} kg • {rupiah(day.saleBreakdown.eceranOmzet)}
                        </span>
                        <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[#6b21a8] uppercase tracking-wide">
                          Grosir: {shortNumber(day.saleBreakdown.grosirQty)} kg • {rupiah(day.saleBreakdown.grosirOmzet)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        {day.totalPenyusutan > 0 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                            <div>
                              <span className="font-bold text-[#191712]">Beban Penyusutan / Loss</span>
                              <span className="text-[#706858]"> • nilai susut barang pada tanggal ini</span>
                            </div>
                            <div className="text-right font-mono font-black text-[#8f321a]">
                              -{rupiah(day.totalPenyusutan)}
                            </div>
                          </div>
                        )}
                        {day.items.map((item, idx) => (
                          <div
                            key={item.id ?? `${item.date}-${item.itemName}-${item.bakulName}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#191712]">{item.itemName}</span>
<span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  item.saleType === "grosir"
                                    ? "bg-[#fff3cd] text-[#8f6b00]"
                                    : "bg-[#e7f5ec] text-[#1f8f5f]"
                                }`}
                              >
                                {item.saleType}
                              </span>
                              <span className="text-[#706858]"> • {item.bakulName}</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-[#706858]">
                                {shortNumber(item.quantity)} kg × {rupiah(item.sellPrice)} ={" "}
                              </span>
                              <span className="font-black text-[#191712]">{rupiah(item.omzet)}</span>
                              <span className="text-[#706858]"> (modal {rupiah(item.modalCost)})</span>
                              <span className={`font-black ${item.profit >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}`}>
                                {" "}
                                → {rupiah(item.profit)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-start gap-2 rounded-2xl border border-[#191712]/10 bg-white p-4 text-xs text-[#706858]">
        <Download size={15} className="mt-0.5 shrink-0" />
<p>
<strong>Rumus:</strong> Pendapatan Harian = (Total Stok Keluar × Harga Jual) − (Total Stok Keluar × Harga
          Beli). Laba Bersih = Total Penjualan − Total Modal Beli − Total Operasional − Beban Penyusutan / Loss.
          Beban penyusutan dihitung dari total kg penyusutan dikali Harga Beli pada tanggal penyusutan. Jika belum
          ada data Barang Masuk, modal dan nilai susut dihitung Rp0.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
label: string;
  value: string;
  tone: "plain" | "blue" | "yellow" | "green" | "red" | "purple";
}) {
  const toneClasses = {
    plain: "border-t-slate-300",
    blue: "border-t-sky-500",
    yellow: "border-t-amber-400",
    green: "border-t-green-500",
    red: "border-t-rose-500",
    purple: "border-t-purple-500",
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-zinc-200/80 bg-white p-4 shadow-sm border-t-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}
