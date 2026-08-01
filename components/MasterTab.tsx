"use client";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { AlertTriangle, Download, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { exportToJSON, rupiah } from "@/lib/utils";
import { BakulRecord, BakulSummaryItem, DailySale, OperationalRecord, Role } from "@/types/finance";

interface MasterTabProps {
  bakulSummary: BakulSummaryItem[];
  categories: string[];
  sales: DailySale[];
  bakulRecords: BakulRecord[];
  ops: OperationalRecord[];
  role: Role;
  onImportData: (data: { sales: DailySale[]; bakulRecords: BakulRecord[]; ops: OperationalRecord[] }) => void;
  onResetData: () => void;
}

export function MasterTab({
  bakulSummary,
  categories,
  sales,
  bakulRecords,
  ops,
  role,
  onImportData,
  onResetData,
}: MasterTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState("");

  const handleExportJSON = () => {
    exportToJSON(sales, bakulRecords, ops);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && Array.isArray(json.sales) && Array.isArray(json.bakulRecords) && Array.isArray(json.ops)) {
          onImportData({
            sales: json.sales,
            bakulRecords: json.bakulRecords,
            ops: json.ops,
          });
          setImportError("");
          alert("Data berhasil di-import!");
        } else {
          setImportError("Format file JSON tidak sesuai dengan skema Buku Keuangan.");
        }
      } catch {
        setImportError("File tidak valid atau rusak.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Master Data Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Master Bakul */}
        <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#191712]">Master Data Bakul</h2>
              <p className="text-xs text-[#706858]">Total {bakulSummary.length} Bakul terdaftar</p>
            </div>
            <Chip size="sm" className="bg-[#f0eadb] font-bold text-[#191712]">
              {bakulSummary.length} Pelanggan
            </Chip>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {bakulSummary.map((item) => (
              <Card key={item.name} shadow="none" radius="sm" className="border border-[#191712]/5 bg-white">
                <CardBody className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black text-[#191712]">{item.name}</h3>
                    <p className="text-xs text-[#706858]">
                      {item.count} Transaksi • Dibayar {rupiah(item.paid)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-[#706858] uppercase font-bold block">Total Piutang</span>
                    <span className={`font-mono font-black ${item.balance > 0 ? "text-[#e05234]" : "text-[#1f8f5f]"}`}>
                      {rupiah(item.balance)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* Master Categories */}
        <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#191712]">Kategori Operasional</h2>
              <p className="text-xs text-[#706858]">Total {categories.length} Kategori tercatat</p>
            </div>
            <Chip size="sm" className="bg-[#e6f1ff] font-bold text-[#173a61]">
              {categories.length} Kategori
            </Chip>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {categories.map((category) => (
              <Chip key={category} className="bg-[#f0eadb] font-bold text-[#191712] capitalize" size="md">
                🏷️ {category}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Database Management & Backup / Restore */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-black text-[#191712]">Cadangan & Pemulihan Data (Backup / Restore)</h2>
          <p className="text-xs text-[#706858]">
            Simpan data keuangan ke file cadangan JSON atau pulihkan data dari file JSON.
          </p>
        </div>

        {importError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
            ⚠️ {importError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            className="bg-[#191712] font-bold text-white shadow-sm"
            startContent={<Download size={16} />}
            onPress={handleExportJSON}
          >
            Download Backup JSON
          </Button>

          {role === "admin" && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
              />
              <Button
                variant="flat"
                className="bg-[#e6f1ff] font-bold text-[#173a61]"
                startContent={<Upload size={16} />}
                onPress={() => fileInputRef.current?.click()}
              >
                Import Data JSON
              </Button>

              <Button
                variant="flat"
                className="bg-[#ffe2d8] font-bold text-[#8f321a]"
                startContent={<RefreshCw size={16} />}
                onPress={() => setShowResetConfirm(true)}
              >
                Reset ke Data Awal Demo
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertTriangle size={20} />
            <span>Reset Seluruh Data Keuangan?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin mengembalikan seluruh data rekap penjualan, bakul, dan operasional ke data demo awal?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="flat" radius="sm" onPress={() => setShowResetConfirm(false)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
              >
                Reset Data Demo
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
