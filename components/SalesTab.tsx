"use client";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { AlertCircle, Edit2, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { rupiah, shortNumber, toNumber } from "@/lib/utils";
import { DailySale, Role } from "@/types/finance";

interface SalesTabProps {
  sales: DailySale[];
  role: Role;
  onAddSale: (sale: DailySale) => void;
  onUpdateSale: (index: number, sale: DailySale) => void;
  onDeleteSale: (index: number) => void;
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

export function SalesTab({ sales, role, onAddSale, onUpdateSale, onDeleteSale }: SalesTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    date: DEFAULT_DATE,
    modalQty: "",
    modalTotal: "",
    saleQty: "",
    saleTotal: "",
    operational: "",
    note: "",
  });

  // Calculate live numbers
  const modalQtyNum = toNumber(form.modalQty);
  const modalTotalNum = toNumber(form.modalTotal);
  const saleQtyNum = toNumber(form.saleQty);
  const saleTotalNum = toNumber(form.saleTotal);
  const opNum = toNumber(form.operational);

  const liveShrink = Math.max(modalQtyNum - saleQtyNum, 0);
  const liveTarget = modalQtyNum * 2000;
  const liveGross = saleTotalNum - modalTotalNum;
  const liveNet = liveGross - opNum;

  const handleStartEdit = (item: DailySale, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      modalQty: String(item.modalQty),
      modalTotal: String(item.modalTotal),
      saleQty: String(item.saleQty),
      saleTotal: String(item.saleTotal),
      operational: String(item.operational),
      note: item.note,
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: DEFAULT_DATE,
      modalQty: "",
      modalTotal: "",
      saleQty: "",
      saleTotal: "",
      operational: "",
      note: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !saleTotalNum) return;

    const record: DailySale = {
      date: form.date,
      modalQty: modalQtyNum,
      modalTotal: modalTotalNum,
      saleQty: saleQtyNum,
      saleTotal: saleTotalNum,
      shrink: liveShrink,
      target: liveTarget,
      grossProfit: liveGross,
      difference: liveGross - liveTarget,
      operational: opNum,
      netProfit: liveNet,
      note: form.note.trim(),
    };

    if (editingIndex !== null) {
      onUpdateSale(editingIndex, record);
    } else {
      onAddSale(record);
    }

    handleCancelEdit();
  };

  // Search filter
  const filteredSales = sales
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.date.includes(query) ||
        item.note.toLowerCase().includes(query) ||
        String(item.saleTotal).includes(query)
      );
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {role === "admin"
            ? editingIndex === null
              ? "Input Rekap Penjualan"
              : "Edit Rekap Penjualan"
            : "Akses Mode User"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          {role === "admin"
            ? "Masukkan data modal, penjualan, dan operasional harian."
            : "Anda berada dalam mode Read-Only. Buka Admin untuk mengedit."}
        </p>

        {role === "admin" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="date"
              label="Tanggal Rekap"
              labelPlacement="outside"
              value={form.date}
              onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
              radius="sm"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Modal Qty (kg)"
                labelPlacement="outside"
                placeholder="cth. 1000"
                value={form.modalQty}
                onValueChange={(modalQty) => setForm((prev) => ({ ...prev, modalQty }))}
                radius="sm"
              />
              <Input
                label="Modal Total (Rp)"
                labelPlacement="outside"
                placeholder="cth. 15000000"
                value={form.modalTotal}
                onValueChange={(modalTotal) => setForm((prev) => ({ ...prev, modalTotal }))}
                radius="sm"
              />
              <Input
                label="Penjualan Qty (kg)"
                labelPlacement="outside"
                placeholder="cth. 950"
                value={form.saleQty}
                onValueChange={(saleQty) => setForm((prev) => ({ ...prev, saleQty }))}
                radius="sm"
              />
              <Input
                label="Penjualan Total (Rp)"
                labelPlacement="outside"
                placeholder="cth. 18000000"
                value={form.saleTotal}
                onValueChange={(saleTotal) => setForm((prev) => ({ ...prev, saleTotal }))}
                radius="sm"
                required
              />
            </div>

            <Input
              label="Biaya Operasional (Rp)"
              labelPlacement="outside"
              placeholder="cth. 500000"
              value={form.operational}
              onValueChange={(operational) => setForm((prev) => ({ ...prev, operational }))}
              radius="sm"
            />

            <Textarea
              label="Catatan / Keterangan"
              labelPlacement="outside"
placeholder="Catatan tambahan (misal: ayam mati, cuaca, dll)"
              value={form.note}
              onValueChange={(note) => setForm((prev) => ({ ...prev, note }))}
              radius="sm"
            />

            {/* Live Calculation Preview Box */}
            <div className="rounded-xl bg-[#f7f5ef] p-4 text-xs space-y-2 border border-[#191712]/5">
              <p className="font-bold text-[#191712] uppercase tracking-wider text-[10px]">
                Kalkulasi Otomatis
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Penyusutan: <span className="font-mono font-bold">{shortNumber(liveShrink)} kg</span>
                </div>
                <div>
                  Target Laba: <span className="font-mono font-bold">{rupiah(liveTarget)}</span>
                </div>
                <div>
                  Laba Kotor: <span className="font-mono font-bold">{rupiah(liveGross)}</span>
                </div>
                <div>
                  Laba Bersih:{" "}
                  <span className={`font-mono font-bold ${liveNet >= 0 ? "text-[#1f8f5f]" : "text-[#8f321a]"}`}>
                    {rupiah(liveNet)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
              >
                {editingIndex === null ? "Simpan Rekap Penjualan" : "Simpan Perubahan"}
              </Button>
              {editingIndex !== null && (
                <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
            🔒 Mengubah data rekap penjualan hanya dapat dilakukan setelah masuk ke Mode Admin.
          </div>
        )}
      </div>

      {/* Data List Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black text-[#191712]">Data Rekap Penjualan</h2>
          <div className="w-full sm:w-64">
            <Input
              size="sm"
              placeholder="Cari tanggal/catatan..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search size={14} className="text-[#706858]" />}
              radius="sm"
              isClearable
              onClear={() => setSearch("")}
            />
          </div>
        </div>

        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {filteredSales.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#706858]">
              Tidak ditemukan data rekap penjualan.
            </div>
          ) : (
            filteredSales.map(({ item, originalIndex }) => (
              <Card
                key={`${item.date}-${originalIndex}`}
                shadow="none"
                radius="sm"
                className="border border-[#191712]/10 bg-white transition-all hover:border-[#191712]/30"
              >
                <CardBody className="gap-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-black text-base text-[#191712]">{item.date}</h3>
                      <p className="text-xs text-[#706858] font-medium">
                        {item.note || "Rekap harian"}
                      </p>
                    </div>
                    <Chip
                      className={
                        item.netProfit >= 0
                          ? "bg-[#d9ff67] text-[#244000] font-black"
                          : "bg-[#ffe2d8] text-[#8f321a] font-black"
                      }
                      size="sm"
                    >
                      Laba: {rupiah(item.netProfit)}
                    </Chip>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg bg-[#f7f5ef] p-2">
                      <span className="text-[10px] text-[#706858] uppercase block">Modal</span>
                      <span className="font-bold">{rupiah(item.modalTotal)}</span>
                      <span className="text-[10px] text-[#706858] block">{shortNumber(item.modalQty)} kg</span>
                    </div>
                    <div className="rounded-lg bg-[#f7f5ef] p-2">
                      <span className="text-[10px] text-[#706858] uppercase block">Penjualan</span>
                      <span className="font-bold">{rupiah(item.saleTotal)}</span>
                      <span className="text-[10px] text-[#706858] block">{shortNumber(item.saleQty)} kg</span>
                    </div>
                    <div className="rounded-lg bg-[#f7f5ef] p-2">
                      <span className="text-[10px] text-[#706858] uppercase block">Laba Kotor</span>
                      <span className="font-bold">{rupiah(item.grossProfit)}</span>
                    </div>
                    <div className="rounded-lg bg-[#f7f5ef] p-2">
                      <span className="text-[10px] text-[#706858] uppercase block">Operasional</span>
                      <span className="font-bold text-[#8f321a]">{rupiah(item.operational)}</span>
                    </div>
                  </div>

                  {role === "admin" && (
                    <div className="flex gap-2 pt-1 border-t border-[#191712]/5">
                      <Button
                        size="sm"
                        variant="flat"
                        className="font-bold"
                        onPress={() => handleStartEdit(item, originalIndex)}
                        radius="sm"
                        startContent={<Edit2 size={14} />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-[#ffe2d8] font-bold text-[#8f321a] hover:bg-[#ffd1c2]"
                        startContent={<Trash2 size={14} />}
                        onPress={() => setDeleteConfirmIndex(originalIndex)}
                        radius="sm"
                      >
                        Hapus
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmIndex !== null} onClose={() => setDeleteConfirmIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <span>Hapus Rekap Penjualan?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data rekap penjualan tanggal{" "}
              <strong>{deleteConfirmIndex !== null ? sales[deleteConfirmIndex]?.date : ""}</strong>? Actions
              ini tidak dapat dibatalkan.
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
                    onDeleteSale(deleteConfirmIndex);
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
