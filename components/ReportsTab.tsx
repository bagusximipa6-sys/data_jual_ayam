"use client";

import { Button, Divider } from "@heroui/react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportToCSV, rupiah } from "@/lib/utils";
import { BakulRecord, DailySale, FinanceSummary, OperationalRecord } from "@/types/finance";

interface ReportsTabProps {
  summary: FinanceSummary;
  sales: DailySale[];
  bakulRecords: BakulRecord[];
  ops: OperationalRecord[];
  categoriesCount: number;
  bakulCount: number;
}

export function ReportsTab({
  summary,
  sales,
  bakulRecords,
  ops,
  categoriesCount,
  bakulCount,
}: ReportsTabProps) {
  const handleExportSales = () => exportToCSV(sales, "rekap_penjualan");
  const handleExportBakul = () => exportToCSV(bakulRecords, "tagihan_bakul");
  const handleExportOps = () => exportToCSV(ops, "biaya_operasional");

  const totalBill = bakulRecords.reduce((sum, b) => sum + b.bill, 0);

  return (
    <div className="space-y-6">
      {/* Top Bar with Export Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#191712]/10 bg-white p-4 sm:px-6">
        <div>
          <h2 className="text-xl font-black text-[#191712]">Laporan Keuangan Consolidated</h2>
          <p className="text-xs text-[#706858]">Ringkasan pendapatan, operasional, dan saldo piutang.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="flat"
            className="bg-[#e6f1ff] font-bold text-[#173a61]"
            startContent={<FileSpreadsheet size={15} />}
            onPress={handleExportSales}
          >
            Export Sales CSV
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="bg-[#fff0b8] font-bold text-[#665000]"
            startContent={<FileSpreadsheet size={15} />}
            onPress={handleExportBakul}
          >
            Export Bakul CSV
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="bg-[#ffe2d8] font-bold text-[#8f321a]"
            startContent={<FileSpreadsheet size={15} />}
            onPress={handleExportOps}
          >
            Export Ops CSV
          </Button>
          <Button
            size="sm"
            className="bg-[#191712] font-bold text-white"
            startContent={<Printer size={15} />}
            onPress={() => window.print()}
          >
            Cetak Laporan
          </Button>
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales & Profit Report */}
        <ReportCard title="Laporan Rekap Penjualan" subtitle={`${sales.length} Hari Transaksi`}>
          <ReportRow label="Total Modal Pembelian" value={rupiah(summary.modal)} />
          <ReportRow label="Total Penjualan Kotor" value={rupiah(summary.penjualan)} />
          <ReportRow label="Target Pencapaian" value={rupiah(summary.target)} />
          <Divider className="my-2 bg-[#191712]/5" />
          <ReportRow label="Laba Kotor" value={rupiah(summary.labaKotor)} highlight />
          <ReportRow
            label="Laba Bersih Setelah Ops"
            value={rupiah(summary.labaBersih)}
            highlight
            tone={summary.labaBersih >= 0 ? "positive" : "negative"}
          />
        </ReportCard>

        {/* Operational Expense Report */}
        <ReportCard title="Laporan Operasional" subtitle={`${ops.length} Catatan Transaksi`}>
          <ReportRow label="Operasional Rekap Penjualan" value={rupiah(summary.opFromSales)} />
          <ReportRow label="Operasional Detail Transaksi" value={rupiah(summary.opDetail)} />
          <ReportRow label="Kategori Operasional" value={`${categoriesCount} Jenis`} />
          <Divider className="my-2 bg-[#191712]/5" />
          <ReportRow label="Rata-rata Ops Harian" value={rupiah(sales.length ? summary.opFromSales / sales.length : 0)} />
        </ReportCard>

        {/* Bakul / Receivables Report */}
        <ReportCard title="Laporan Piutang Bakul" subtitle={`${bakulCount} Pelanggan Aktif`}>
          <ReportRow label="Total Akumulasi Tagihan" value={rupiah(totalBill)} />
          <ReportRow label="Total Telah Dibayar" value={rupiah(summary.dibayar)} tone="positive" />
          <Divider className="my-2 bg-[#191712]/5" />
          <ReportRow label="Sisa Piutang Berjalan" value={rupiah(summary.piutang)} highlight tone="negative" />
          <ReportRow
            label="Tingkat Pelunasan"
            value={`${totalBill ? Math.round((summary.dibayar / totalBill) * 100) : 0}%`}
          />
        </ReportCard>
      </div>
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-black text-[#191712]">{title}</h3>
        <p className="text-xs text-[#706858]">{subtitle}</p>
      </div>
      <Divider className="bg-[#191712]/5" />
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ReportRow({
  label,
  value,
  highlight = false,
  tone = "neutral",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "neutral" | "positive" | "negative";
}) {
  const tones = {
    neutral: "text-[#191712]",
    positive: "text-[#1f8f5f]",
    negative: "text-[#8f321a]",
  };

  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className={`font-semibold ${highlight ? "text-[#191712] font-extrabold" : "text-[#706858]"}`}>
        {label}
      </span>
      <span className={`font-mono font-black ${highlight ? "text-sm" : ""} ${tones[tone]}`}>
        {value}
      </span>
    </div>
  );
}
