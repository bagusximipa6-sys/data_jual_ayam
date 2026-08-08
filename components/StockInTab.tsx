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
import { AlertCircle, Edit2, Plus, Search, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { getTodayDate, rupiah, shortNumber, toNumber } from "@/lib/utils";
import { ItemMaster, Role, StockInRecord } from "@/types/finance";
import { WeighingKeypad } from "./WeighingKeypad";

// Penguncian Harian: tanggal lampau (lebih kecil dari hari ini) terkunci read-only.
const isRecordLocked = (date: string): boolean => {
  const today = getTodayDate();
  return typeof date === "string" && date.length >= 10 && date < today;
};

interface StockInTabProps {
  stockIn: StockInRecord[];
  itemNames: string[];
  items: ItemMaster[];
  role: Role;
  onAddStockIn: (record: StockInRecord) => void;
  onUpdateStockIn: (index: number, record: StockInRecord) => void;
  onDeleteStockIn: (index: number) => void;
}

let stockInIdCounter = Date.now();
const nextId = () => `SI-${++stockInIdCounter}`;

export function StockInTab({
  stockIn,
  items,
  itemNames,
  role,
  onAddStockIn,
  onUpdateStockIn,
  onDeleteStockIn,
}: StockInTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  // Tanggal terpilih untuk melihat Riwayat Barang Masuk (seperti Laporan Harian).
  const [historyDate, setHistoryDate] = useState<string>(getTodayDate());

const [form, setForm] = useState({
    date: getTodayDate(),
    itemName: itemNames[0] || "",
    quantity: "",
    birdCount: "",
  });
  const [weighingsInput, setWeighingsInput] = useState("");
  const [pickupPlanQty, setPickupPlanQty] = useState("");

const isAdmin = role === "admin";

  const selectedItemMaster = useMemo(
    () => items.find((i) => i.name.toLowerCase() === form.itemName.toLowerCase()),
    [items, form.itemName]
  );

  const autoBuyPrice = selectedItemMaster?.buyPrice ?? 0;

const todayStr = getTodayDate();
  const activeStockDate = form.date || todayStr;

  // Parse Data Timbangan expression into individual weights.
  // Supports "+", "-", space, newline, and parentheses: "(40)+(41)", "100-40-30".
  const parseWeighingValues = (raw: string): string[] =>
    (raw.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 0);

  const parsedWeighings = () =>
    parseWeighingValues(weighingsInput)
      .map((s, i) => ({ id: `W-${Date.now()}-${i}`, label: `Timbangan ${i + 1}`, weight: String(toNumber(s)) }))
      .filter((w) => (toNumber(w.weight) || 0) > 0);

  // Sum of all weighing weights -> auto-fill quantity
  const weighingsTotal = parseWeighingValues(weighingsInput)
    .map((s) => toNumber(s))
    .reduce((sum, n) => sum + n, 0);

  const weighingCount = parseWeighingValues(weighingsInput).length;

  const planQtyNum = toNumber(pickupPlanQty);
  const remainingQty = planQtyNum - weighingsTotal;

  // Keypad kalkulator di layar (untuk HP yang tidak punya tombol + dan kurung)
  const handleKeypadAppend = (char: string) => setWeighingsInput((prev) => prev + char);
  const handleKeypadBackspace = () => setWeighingsInput((prev) => prev.slice(0, -1));
  const handleKeypadClear = () => setWeighingsInput("");

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
      date: getTodayDate(),
      itemName: itemNames[0] || "",
      quantity: "",
      birdCount: "",
    });
    setWeighingsInput("");
    setPickupPlanQty("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemName = form.itemName.trim();
    const quantity = weighingsTotal;
    if (!itemName || !quantity) return;

    const itemMaster = items.find((i) => i.name.toLowerCase() === itemName.toLowerCase());

    const record: StockInRecord = {
      id: editingIndex !== null ? stockIn[editingIndex].id : nextId(),
      date: form.date,
      itemName,
      quantity,
      buyPrice: itemMaster?.buyPrice ?? 0,
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

  // Riwayat disaring berdasarkan tanggal terpilih (historyDate), dikombinasikan dengan pencarian teks.
  const filteredRecords = stockIn
    .filter((item) => item.date === historyDate)
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.date.includes(query)
      );
    });

// Total barang masuk per tanggal terpilih
  const historyBalances = stockIn
    .filter((item) => item.date === historyDate)
    .reduce((acc, item) => {
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

{/* Status stok aktif per tanggal input */}
        <div
          className="mb-4 rounded-xl border border-[#d9ff67] bg-[#d9ff67]/40 px-3 py-2 text-xs font-bold text-[#191712]"
        >
          Stok aktif untuk tanggal {activeStockDate}. Jika belum ada input pada tanggal ini, ringkasan dimulai dari 0.
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Rencana Pengambilan (kg)</label>
              <Input
                labelPlacement="outside"
                placeholder="Opsional, cth. 1000"
                value={pickupPlanQty}
                onValueChange={setPickupPlanQty}
                radius="sm"
                inputMode="decimal"
                endContent={<span className="text-xs font-bold text-[#706858]">kg</span>}
              />
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
                placeholder="cth: (40)+(41)+(42)+(40.7)"
                value={weighingsInput}
                onValueChange={setWeighingsInput}
                radius="sm"
                required
                inputMode="decimal"
                className="font-mono"
              />
              <p className="text-[11px] text-[#706858]">
                Masukkan banyak angka berat ayam dipisah tanda <strong>+</strong> atau satu angka per baris.
                Bisa juga pakai <strong>-</strong> untuk pengurangan. Total dihitung otomatis.
              </p>
              {/* Keypad kalkulator: sediakan tombol +, kurung, dll yang tidak ada di keyboard HP */}
              <WeighingKeypad
                onAppend={handleKeypadAppend}
                onBackspace={handleKeypadBackspace}
                onClear={handleKeypadClear}
              />
              {weighingsTotal > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-[#d9ff67]/40 border border-[#191712]/10 px-3 py-2">
                  <span className="text-[11px] font-bold text-[#191712] uppercase">
                    Total dari {weighingCount} timbangan
                  </span>
                  <span className="font-mono font-black text-[#1f8f5f]">{shortNumber(weighingsTotal)} kg</span>
                </div>
              )}
              {planQtyNum > 0 && weighingsTotal > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-blue-100/60 border border-blue-200 px-3 py-2">
                  <span className="text-[11px] font-bold text-blue-800 uppercase">
                    Sisa dari Rencana ({shortNumber(planQtyNum)} kg)
                  </span>
                  <span
                    className={`font-mono font-black ${remainingQty > 0 ? "text-amber-700" : "text-green-700"}`}
                  >
                    {remainingQty > 0 ? `Kurang ${shortNumber(remainingQty)} kg` : `Lebih ${shortNumber(Math.abs(remainingQty))} kg`}
                  </span>
                </div>
              )}
            </div>

            {isAdmin && autoBuyPrice > 0 && (
              <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5 space-y-2">
                <div className="flex justify-between gap-3 text-xs">
                  <span className="font-bold text-[#706858]">Harga Beli Otomatis / kg</span>
                  <span className="font-mono font-black text-[#191712]">{rupiah(autoBuyPrice)}</span>
                </div>
                {weighingsTotal > 0 && (
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="font-bold text-[#706858]">Total Modal</span>
                    <span className="font-mono font-black text-[#1f8f5f]">{rupiah(autoBuyPrice * weighingsTotal)}</span>
                  </div>
                )}
              </div>
            )}

<div className="space-y-1">
              <label className="text-xs font-semibold text-[#191712]">Jumlah Ayam (ekor)</label>
<Input
                labelPlacement="outside"
                placeholder="Opsional, cth. 50"
                value={form.birdCount}
                onValueChange={(birdCount) => setForm((prev) => ({ ...prev, birdCount }))}
                radius="sm"
                inputMode="numeric"
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
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              size="sm"
              className="w-full sm:w-[180px]"
              value={historyDate}
              onValueChange={setHistoryDate}
              aria-label="Pilih Tanggal Riwayat"
              radius="sm"
            />
            <Input
              size="sm"
              className="w-full sm:w-56"
              placeholder="Cari barang..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search size={14} className="text-[#706858]" />}
              radius="sm"
              isClearable
              onClear={() => setSearch("")}
            />
          </div>
        </div>

{/* Total Barang Masuk per tanggal terpilih */}
        <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#706858] uppercase">Total Barang Masuk</h3>
            <span className="text-[10px] font-bold text-[#706858]">{historyDate}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(historyBalances).map(([key, qty]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold border border-[#191712]/10"
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}: {shortNumber(qty)} kg
              </span>
            ))}
            {Object.keys(historyBalances).length === 0 && (
              <span className="text-xs text-[#706858]">Belum ada stok tercatat untuk {historyDate}.</span>
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
                      {isRecordLocked(item.date) && " 🔒 Terkunci"}
                      {!isRecordLocked(item.date) && item.birdCount != null && item.birdCount > 0 && ` • ${item.birdCount} ekor`}
                    </p>
                    {!isRecordLocked(item.date) && item.weighings && item.weighings.length > 0 && (
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
                        isDisabled={isRecordLocked(item.date)}
                        onPress={() => handleStartEdit(item, originalIndex)}
                        radius="sm"
                      >
                        {isRecordLocked(item.date) ? "🔒 Edit" : "Edit"}
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
