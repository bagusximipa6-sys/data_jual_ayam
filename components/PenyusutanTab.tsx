"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { AlertCircle, Edit2, Lock, Plus, Scale, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { getTodayDate, rupiah, shortNumber, toNumber } from "@/lib/utils";
import { PenyusutanRecord, Role, StockInRecord, StockOutRecord } from "@/types/finance";

interface PenyusutanTabProps {
  penyusutan: PenyusutanRecord[];
  stockIn: StockInRecord[];
  stockOut: StockOutRecord[];
  itemNames: string[];
  role: Role;
  onAddPenyusutan: (record: PenyusutanRecord) => void;
  onUpdatePenyusutan: (index: number, record: PenyusutanRecord) => void;
  onDeletePenyusutan: (index: number) => void;
}

let penyusutanIdCounter = Date.now();
const nextId = () => `PY-${++penyusutanIdCounter}`;

export function PenyusutanTab({
  penyusutan,
  stockIn,
  stockOut,
  itemNames,
  role,
  onAddPenyusutan,
  onUpdatePenyusutan,
  onDeletePenyusutan,
}: PenyusutanTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    date: getTodayDate(),
    itemName: itemNames[0] || "",
    actualStock: "",
  });

  const isAdmin = role === "admin";

  // Expected stock = cumulative stockIn − stockOut up to the selected date for the selected item
  const expectedStockFor = (date: string, itemName: string) => {
    const key = itemName.toLowerCase();
    const inTotal = stockIn
      .filter((r) => r.itemName.toLowerCase() === key && r.date === date)
      .reduce((sum, r) => sum + r.quantity, 0);
    const outTotal = stockOut
      .filter((r) => r.itemName.toLowerCase() === key && r.date === date)
      .reduce((sum, r) => sum + r.quantity, 0);
    return inTotal - outTotal;
  };

  const expectedStock = expectedStockFor(form.date, form.itemName);
  const actualStock = toNumber(form.actualStock);
  const computedAmount = expectedStock - actualStock;

  const handleStartEdit = (item: PenyusutanRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      itemName: item.itemName,
      actualStock: String(item.actualStock),
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: getTodayDate(),
      itemName: itemNames[0] || "",
      actualStock: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemName = form.itemName.trim();
    if (!itemName || expectedStock <= 0) return;
    if (actualStock < 0) return;

    const record: PenyusutanRecord = {
      id: editingIndex !== null ? penyusutan[editingIndex].id : nextId(),
      date: form.date,
      itemName,
      expectedStock: expectedStock,
      actualStock,
      amount: computedAmount,
    };

    if (editingIndex !== null) {
      onUpdatePenyusutan(editingIndex, record);
    } else {
      onAddPenyusutan(record);
    }

    handleCancelEdit();
  };

  const filteredRecords = penyusutan
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.date.includes(query)
      );
    });

  const totalPenyusutan = penyusutan.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {editingIndex === null ? "Catat Penyusutan" : "Edit Penyusutan"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Bandingkan stok yang seharusnya (stok masuk − keluar) dengan stok fisik aktual. Penyusutan dihitung otomatis.
        </p>

        {isAdmin ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="date"
              label="Tanggal"
              labelPlacement="outside"
              value={form.date}
              onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
              radius="sm"
              required
            />

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Nama Barang / Jenis Ayam</label>
              <Select
                aria-label="Pilih Nama Barang"
                selectedKeys={form.itemName ? [form.itemName] : []}
                onSelectionChange={(keys) => {
                  const selected = String(Array.from(keys)[0] ?? form.itemName);
                  setForm((prev) => ({ ...prev, itemName: selected }));
                }}
                radius="sm"
                isDisabled={itemNames.length === 0}
              >
                {itemNames.map((name) => (
                  <SelectItem key={name}>{name}</SelectItem>
                ))}
              </Select>
              {itemNames.length === 0 && (
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  ⚠️ Belum ada data barang. Buat dulu di menu Master &amp; Cadangan.
                </p>
              )}
            </div>

            {/* Expected stock info */}
            <div className="rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#706858] uppercase">Stok Seharusnya (s.d. {form.date})</span>
                <span className="font-mono font-black text-[#191712]">{shortNumber(expectedStock)} kg</span>
              </div>
<p className="text-[10px] text-[#706858]">
                Total Stok Masuk − Total Stok Keluar untuk{" "}
                <strong className="text-[#191712]">{form.itemName || "—"}</strong> di periode tersebut.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Stok Fisik Aktual (kg)</label>
              <Input
                labelPlacement="outside"
                placeholder="cth. 48.5"
                value={form.actualStock}
                onValueChange={(actualStock) => setForm((prev) => ({ ...prev, actualStock }))}
                radius="sm"
                required
                endContent={<span className="text-xs font-bold text-[#706858]">kg</span>}
              />
            </div>

            {/* Auto-computed shrinkage */}
            <div className="flex items-center justify-between rounded-xl px-3 py-3 border border-[#d9ff67] bg-[#f7f5ef]">
              <div className="flex items-center gap-1.5">
                <Scale size={14} className="text-[#8f321a]" />
                <span className="text-xs font-bold text-[#191712]">Penyusutan Otomatis</span>
              </div>
              <span
                className={`font-mono text-lg font-black ${
                  computedAmount > 0 ? "text-[#8f321a]" : "text-[#1f8f5f]"
                }`}
              >
                {computedAmount > 0 ? `−${shortNumber(computedAmount)} kg` : `${shortNumber(computedAmount)} kg`}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
                isDisabled={expectedStock <= 0 || actualStock < 0}
              >
                {editingIndex === null ? "Simpan Penyusutan" : "Simpan Perubahan"}
              </Button>
              {editingIndex !== null && (
                <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
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
                        {item.date} • Stok seharusnya {shortNumber(item.expectedStock)} kg • Aktual{" "}
                        {shortNumber(item.actualStock)} kg
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
                            onPress={() => handleStartEdit(item, originalIndex)}
                            radius="sm"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-[#ffe2d8] font-bold text-[#8f321a] min-w-unit-12"
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
