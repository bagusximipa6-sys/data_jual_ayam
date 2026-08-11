"use client";

import { Card, CardBody, Input, Modal, Button, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { AlertCircle, Lock, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { buildAutoPenyusutan, getTodayDate, shortNumber } from "@/lib/utils";
import { PenyusutanRecord, Role, StockInRecord, StockOutRecord } from "@/types/finance";

// Penguncian Harian: tanggal lampau (lebih kecil dari hari ini) terkunci read-only.
const isRecordLocked = (date: string): boolean => {
  const today = getTodayDate();
  return typeof date === "string" && date.length >= 10 && date < today;
};

interface PenyusutanTabProps {
  penyusutan: PenyusutanRecord[];
  stockIn: StockInRecord[];
  stockOut: StockOutRecord[];
  role: Role;
  onDeletePenyusutan: (index: number) => void;
  onAutoGeneratePenyusutan: (records: PenyusutanRecord[]) => void;
}

export function PenyusutanTab({
  penyusutan,
  stockIn,
  stockOut,
  role,
  onDeletePenyusutan,
  onAutoGeneratePenyusutan,
}: PenyusutanTabProps) {
  const [search, setSearch] = useState("");
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const isAdmin = role === "admin";
  const today = getTodayDate();

  const handleStartEdit = (item: PenyusutanRecord, originalIndex: number) => {
    // Editing is disabled as per new requirement, but we keep the handler structure
    // in case a limited form of editing (e.g., notes) is re-introduced.
    // For now, this function can be a no-op or show a "locked" message.
  };

  // === Daily Stock Reset: sisa stok harian yang akan di-reset otomatis ===
  const pendingAuto = buildAutoPenyusutan(stockIn, stockOut, today, penyusutan);

  const handleAutoGenerate = () => {
    if (pendingAuto.length === 0) return;
    onAutoGeneratePenyusutan(pendingAuto);
  };

  const filteredRecords = penyusutan
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return item.itemName.toLowerCase().includes(query) || item.date.includes(query);
    });

  const totalPenyusutan = penyusutan.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">Penyusutan Otomatis</h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Penyusutan dihitung & dicatat otomatis dari sisa stok harian (Stok Masuk − Barang Terjual). Tidak perlu input
          manual — sisa stok di akhir hari di-reset ke 0 secara otomatis.
        </p>

        {isAdmin ? (
          <div className="space-y-4">
            {/* Daily Stock Reset: auto-hitung & simpan sisa stok harian sebagai penyusutan */}
            <div className="rounded-xl border border-[#191712]/10 bg-[#e6f1ff]/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#173a61]" />
                <span className="text-xs font-bold text-[#173a61]">Daily Stock Reset (Closing {today})</span>
              </div>
              <p className="text-[10px] text-[#706858]">
                Sisa stok <strong>(Barang Masuk − Barang Terjual)</strong> di akhir hari otomatis dicatat sebagai
                Penyusutan/Loss dan di-reset ke 0 kg, sehingga stok <strong>tidak carry-over</strong> ke hari
                berikutnya dan modal hari esok murni dari Barang Masuk tanggal esoknya.
              </p>
              {pendingAuto.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {pendingAuto.map(({ itemName, amount }) => (
                    <span
                      key={itemName.toLowerCase()}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold border border-[#191712]/10"
                    >
                      {itemName}: <span className="text-[#8f321a]">−{shortNumber(amount)} kg</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] font-semibold text-[#1f8f5f]">
                  ✓ Tidak ada sisa stok untuk tanggal ini (semua terjual).
                </p>
              )}
              <Button
                size="sm"
                className="bg-[#173a61] font-bold text-white w-full"
                radius="sm"
                startContent={<Sparkles size={14} />}
                isDisabled={pendingAuto.length === 0}
                onPress={handleAutoGenerate}
              >
                Reset Stok & Closing Hari Ini
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#191712]/20 bg-[#f7f5ef] p-6 text-center">
            <Lock size={20} className="mx-auto mb-2 text-[#706858]" />
            <p className="text-sm font-bold text-[#191712]">Catat penyusutan dikunci</p>
            <p className="text-xs text-[#706858] mt-1">
              Hanya admin yang dapat mencatat atau menghapus data penyusutan.
            </p>
          </div>
        )}
      </div>

      {/* Data List Panel */}
      {isAdmin && (
        <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-[#191712]">Riwayat Penyusutan</h2>
            <div className="w-full sm:w-64">
              <Input
                size="sm"
                placeholder="Cari barang/tanggal..."
                value={search}
                onValueChange={setSearch}
                startContent={<Search size={14} className="text-[#706858]" />}
                radius="sm"
                isClearable
                onClear={() => setSearch("")}
              />
            </div>
          </div>

          {/* Total shrinkage summary */}
          <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5 flex items-center justify-between">
            <span className="text-xs font-bold text-[#706858] uppercase">Total Penyusutan</span>
            <span className="font-mono text-lg font-black text-[#8f321a]">−{shortNumber(totalPenyusutan)} kg</span>
          </div>

          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#706858]">
                Belum ada catatan penyusutan.
              </div>
            ) : (
              filteredRecords.map(({ item, originalIndex }) => (
                <Card
                  key={item.id}
                  shadow="none"
                  radius="sm"
                  className="border border-[#191712]/10 bg-white transition-all hover:border-[#191712]/30"
                >
                  <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
<h3 className="font-black text-[#191712]">{item.itemName}</h3>
                      <p className="text-xs text-[#706858] font-medium">
                        {item.date} {isRecordLocked(item.date) ? "🔒 Terkunci" : ""} • Stok seharusnya{" "}
                        {shortNumber(item.expectedStock)} kg • Aktual {shortNumber(item.actualStock)} kg
                      </p>
                    </div>
                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <span className="font-mono font-black text-[#8f321a]">−{shortNumber(item.amount)} kg</span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="flat"
                            className="font-bold min-w-unit-12"
                            isDisabled={true} // Editing is fully disabled now
                            onPress={() => handleStartEdit(item, originalIndex)}
                            radius="sm"
                          >
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-[#ffe2d8] font-bold text-[#8f321a] min-w-unit-12"
                            isDisabled={isRecordLocked(item.date)}
                            onPress={() => setDeleteConfirmIndex(originalIndex)}
                            radius="sm"
                          >
                            Hapus
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmIndex !== null} onClose={() => setDeleteConfirmIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <span>Hapus Catatan Penyusutan?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus catatan penyusutan untuk{" "}
              <strong>{deleteConfirmIndex !== null ? penyusutan[deleteConfirmIndex]?.itemName : ""}</strong>?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="flat" radius="sm" onPress={() => setDeleteConfirmIndex(null)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  if (deleteConfirmIndex !== null) {
                    onDeletePenyusutan(deleteConfirmIndex);
                    setDeleteConfirmIndex(null);
                  }
                }}
              >
                Hapus Data
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
