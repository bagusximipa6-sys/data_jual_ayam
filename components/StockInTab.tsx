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
  Textarea,
} from "@heroui/react";
import { AlertCircle, Edit2, Lock, Plus, Search, Scale, Trash2 } from "lucide-react";
import { useState } from "react";
import { shortNumber, toNumber } from "@/lib/utils";
import { Role, StockInRecord, WeighingEntry } from "@/types/finance";

interface StockInTabProps {
  stockIn: StockInRecord[];
  itemNames: string[];
  role: Role;
  onAddStockIn: (record: StockInRecord) => void;
  onUpdateStockIn: (index: number, record: StockInRecord) => void;
  onDeleteStockIn: (index: number) => void;
}

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

let stockInIdCounter = Date.now();
const nextId = () => `SI-${++stockInIdCounter}`;

export function StockInTab({
  stockIn,
  itemNames,
  role,
  onAddStockIn,
  onUpdateStockIn,
  onDeleteStockIn,
}: StockInTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

const [form, setForm] = useState({
    date: DEFAULT_DATE,
    itemName: itemNames[0] || "",
    quantity: "",
    birdCount: "",
  });
  const [weighingsInput, setWeighingsInput] = useState("");

const isAdmin = role === "admin";

  // Stok ditutup setiap jam 3 sore (15:00). Setelah 15:00, stok untuk hari ini dikunci
  // dan dibuka kembali untuk hari berikutnya (reset mulai dari nol).
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isStockClosed = currentMinutes >= 15 * 60; // 15:00 = 900 menit

  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Tanggal stok aktif: hari ini sebelum 15:00, besok setelah 15:00.
  const activeStockDate = isStockClosed ? tomorrowStr : todayStr;

  // "Ringkasan Stok" menampilkan stok aktif untuk periode input berjalan
  // (reset otomatis setiap periode baru — mulai dari nol).
  const activeStock = stockIn.filter((r) => r.date === activeStockDate);
  const activeStockBalances = activeStock.reduce((acc, item) => {
    const key = item.itemName.toLowerCase();
    acc[key] = (acc[key] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  // Parse Data Timbangan expression ("40+41+42+40.7") into individual weights.
  // Also supports newline-separated values (one per line) by treating line breaks as "+".
  const parseWeighingValues = (raw: string): string[] =>
    raw
      .split("+")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const parsedWeighings = () =>
    parseWeighingValues(weighingsInput)
      .map((s, i) => ({ id: `W-${Date.now()}-${i}`, label: `Timbangan ${i + 1}`, weight: String(toNumber(s)) }))
      .filter((w) => (toNumber(w.weight) || 0) > 0);

  // Sum of all weighing weights -> auto-fill quantity
  const weighingsTotal = parseWeighingValues(weighingsInput)
    .map((s) => toNumber(s))
    .reduce((sum, n) => sum + n, 0);

  const weighingCount = parseWeighingValues(weighingsInput).length;

const handleStartEdit = (item: StockInRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      itemName: item.itemName,
      quantity: String(item.quantity),
      birdCount: item.birdCount != null ? String(item.birdCount) : "",
    });
    setWeighingsInput(
      (item.weighings ?? [])
        .filter((w) => (toNumber(String(w.weight)) || 0) > 0)
        .map((w) => String(w.weight))
        .join("+")
    );
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({
      date: DEFAULT_DATE,
      itemName: itemNames[0] || "",
      quantity: "",
      birdCount: "",
    });
    setWeighingsInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemName = form.itemName.trim();
    const quantity = weighingsTotal;
    if (!itemName || !quantity) return;

    const record: StockInRecord = {
      id: editingIndex !== null ? stockIn[editingIndex].id : nextId(),
      date: form.date,
      itemName,
      quantity,
      buyPrice: 0,
      birdCount: form.birdCount ? toNumber(form.birdCount) : undefined,
      weighings: parsedWeighings(),
    };

    if (editingIndex !== null) {
      onUpdateStockIn(editingIndex, record);
    } else {
      onAddStockIn(record);
    }

    handleCancelEdit();
  };

  const filteredRecords = stockIn
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.date.includes(query)
      );
    });

  // Calculate stock balances per item
  const stockBalances = stockIn.reduce((acc, item) => {
    const key = item.itemName.toLowerCase();
    acc[key] = (acc[key] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      {/* Form Panel */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {editingIndex === null ? "Input Barang Masuk" : "Edit Barang Masuk"}
        </h2>
<p className="text-xs text-[#706858] mt-1 mb-4">
          Catat penerimaan stok barang yang masuk ke gudang / toko.
        </p>

{/* Status stok: tutup jam 3 sore, lalu otomatis pindah ke hari berikutnya */}
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-xs font-bold ${
            isStockClosed
              ? "border-[#fff3cd] bg-[#fff3cd]/50 text-[#8f6b00]"
              : "border-[#d9ff67] bg-[#d9ff67]/40 text-[#191712]"
          }`}
        >
          {isStockClosed
            ? `🔒 Stok hari ${todayStr} sudah ditutup (setelah pukul 15.00). Input stok sekarang untuk tanggal ${activeStockDate} (reset dari nol).`
            : `🕒 Stok aktif hari ini (${todayStr}). Stok akan ditutup otomatis pukul 15.00 dan pindah ke hari berikutnya.`}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="date"
              label="Tanggal Masuk"
              labelPlacement="outside"
              value={form.date}
              onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
              radius="sm"
              required
            />

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Nama Kandang</label>
              <Select
                aria-label="Pilih Nama Kandang"
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
                  ⚠️ Belum ada data barang. Buat dulu di menu Master & Cadangan.
                </p>
              )}
            </div>

            {/* Data Timbangan */}
            <div className="rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Scale size={14} className="text-[#706858]" />
                <span className="text-xs font-bold text-[#191712]">Data Timbangan (kg)</span>
              </div>
              <Textarea
                minRows={4}
                maxRows={14}
                labelPlacement="outside"
                placeholder="cth: 40+41+42+40.7"
                value={weighingsInput}
                onValueChange={setWeighingsInput}
                radius="sm"
                required
                className="font-mono"
              />
              <p className="text-[11px] text-[#706858]">
                Masukkan banyak angka berat ayam dipisah tanda <strong>+</strong> (atau satu angka per baris).
                Total dihitung otomatis.
              </p>
              {weighingsTotal > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-[#d9ff67]/40 border border-[#191712]/10 px-3 py-2">
                  <span className="text-[11px] font-bold text-[#191712] uppercase">
                    Total dari {weighingCount} timbangan
                  </span>
                  <span className="font-mono font-black text-[#1f8f5f]">{shortNumber(weighingsTotal)} kg</span>
                </div>
              )}
            </div>

<div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Jumlah Ayam (ekor)</label>
              <Input
                labelPlacement="outside"
                placeholder="Opsional, cth. 50"
                value={form.birdCount}
                onValueChange={(birdCount) => setForm((prev) => ({ ...prev, birdCount }))}
                radius="sm"
                endContent={<span className="text-xs font-bold text-[#706858]">ekor</span>}
              />
            </div>

<div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
                radius="sm"
                startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
              >
                {editingIndex === null ? "Simpan Barang Masuk" : "Simpan Perubahan"}
              </Button>
              {editingIndex !== null && (
                <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                  Batal
                </Button>
              )}
            </div>
          </form>
      </div>

      {/* Data List Panel — visible to all users */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black text-[#191712]">Riwayat Barang Masuk</h2>
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

{/* Stock Balance Summary (hanya stok aktif — reset otomatis tiap periode baru) */}
        <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#706858] uppercase">Ringkasan Stok Aktif</h3>
            <span className="text-[10px] font-bold text-[#706858]">{activeStockDate}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(activeStockBalances).map(([key, qty]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold border border-[#191712]/10"
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}: {shortNumber(qty)} kg
              </span>
            ))}
            {Object.keys(activeStockBalances).length === 0 && (
              <span className="text-xs text-[#706858]">Belum ada stok tercatat untuk {activeStockDate}.</span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#706858]">
              Tidak ditemukan catatan barang masuk.
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
                      {item.date}
                      {item.birdCount != null && item.birdCount > 0 && ` • ${item.birdCount} ekor`}
                    </p>
                    {item.weighings && item.weighings.length > 0 && (
                      <p className="text-[11px] text-[#706858] font-mono mt-1">
                        Timbangan: {item.weighings.map((w) => shortNumber(toNumber(String(w.weight)))).join(" + ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
<span className="font-mono font-black text-[#1f8f5f]">+{shortNumber(item.quantity)} kg</span>
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
                  </div>
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
            <span>Hapus Catatan Barang Masuk?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data barang masuk untuk{" "}
              <strong>{deleteConfirmIndex !== null ? stockIn[deleteConfirmIndex]?.itemName : ""}</strong>?
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
                    onDeleteStockIn(deleteConfirmIndex);
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
