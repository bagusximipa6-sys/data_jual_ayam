"use client";

import {
  Button,
  Card,
  CardBody,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { AlertCircle, Edit2, Plus, Printer, Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getTodayDate, resolveActiveStockIn, rupiah, shortNumber, toNumber } from "@/lib/utils";
import { BakulMaster, Role, StockInRecord, StockOutRecord } from "@/types/finance";
import { WeighingKeypad } from "./WeighingKeypad";

// Penguncian Harian: tanggal lampau (lebih kecil dari hari ini) terkunci read-only.
const isRecordLocked = (date: string): boolean => {
  const today = getTodayDate();
  return typeof date === "string" && date.length >= 10 && date < today;
};

interface StockOutTabProps {
  stockOut: StockOutRecord[];
  stockIn: StockInRecord[];
  itemNames: string[];
  bakulNames: string[];
  bakulMasters: BakulMaster[];
  role: Role;
  onAddStockOut: (record: StockOutRecord) => void;
  onUpdateStockOut: (index: number, record: StockOutRecord) => void;
  onDeleteStockOut: (index: number) => void;
}

let stockOutIdCounter = Date.now();
const nextId = () => `SO-${++stockOutIdCounter}`;

export function StockOutTab({
  stockOut,
  stockIn,
  itemNames,
  bakulNames,
  bakulMasters,
  role,
  onAddStockOut,
  onUpdateStockOut,
  onDeleteStockOut,
}: StockOutTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  // Tanggal terpilih untuk melihat Riwayat Barang Keluar (seperti Laporan Harian).
  const [historyDate, setHistoryDate] = useState<string>(getTodayDate());
  const isAdmin = role === "admin";

  const [form, setForm] = useState({
    date: getTodayDate(),
    bakulName: bakulNames[0] || "",
    birdCount: "",
  });
  const [weighingsInput, setWeighingsInput] = useState("");

  const selectedBakulMaster = useMemo(
    () => bakulMasters.find((b) => b.name.toLowerCase() === form.bakulName.toLowerCase()),
    [bakulMasters, form.bakulName]
  );

const autoPrice = selectedBakulMaster?.sellPrice ?? 0;

  // === Barang & Harga Modal (COGS) dari Barang Masuk aktif pada tanggal transaksi ===
  // Setiap transaksi penjualan (Barang Keluar) terhubung dinamis (foreign key) ke Barang
  // Masuk yang aktif pada tanggal transaksi, sehingga nama barang & harga beli / kg otomatis
  // mengikuti Barang Masuk hari itu — bukan nyantol ke barang lain (mis. Arwani 1).
const activeStockIn = resolveActiveStockIn(stockIn, form.date || getTodayDate());
  const activeItemName = (itemNames[0] || "Ayam") as string;
  const linkedItemName = activeStockIn?.itemName ?? activeItemName;
  const activeBuyPrice = activeStockIn?.buyPrice ?? 0;

  // Parse Data Timbangan expression into individual weights.
  // Supports "+", "-", space, newline, and parentheses: "(40)+(41)", "100-40-30".
  const parseWeighingValues = (raw: string): string[] =>
    (raw.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 0);

  const parsedWeighings = () =>
    parseWeighingValues(weighingsInput)
      .map((s, i) => ({ id: `W-${Date.now()}-${i}`, label: `Timbangan ${i + 1}`, weight: String(toNumber(s)) }))
      .filter((w) => (toNumber(w.weight) || 0) > 0);

  const weighingsTotal = parseWeighingValues(weighingsInput)
    .map((s) => toNumber(s))
    .reduce((sum, n) => sum + n, 0);

  const weighingCount = parseWeighingValues(weighingsInput).length;
  const totalAuto = autoPrice * weighingsTotal;

  // Keypad kalkulator di layar (untuk HP yang tidak punya tombol + dan kurung)
  const handleKeypadAppend = (char: string) => setWeighingsInput((prev) => prev + char);
  const handleKeypadBackspace = () => setWeighingsInput((prev) => prev.slice(0, -1));
  const handleKeypadClear = () => setWeighingsInput("");

  const handleStartEdit = (item: StockOutRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      bakulName: item.bakulName,
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
      bakulName: bakulNames[0] || "",
      birdCount: "",
    });
    setWeighingsInput("");
  };

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bakulName = form.bakulName.trim();
    const itemName = editingIndex !== null ? stockOut[editingIndex].itemName : linkedItemName;
    const quantity = weighingsTotal;
    if (!bakulName || !itemName || quantity <= 0 || autoPrice <= 0) return;

    const record: StockOutRecord = {
      id: editingIndex !== null ? stockOut[editingIndex].id : nextId(),
      date: form.date,
      bakulName,
      itemName,
      quantity,
      price: autoPrice,
      buyPrice: activeBuyPrice,
      stockInId: activeStockIn?.id,
      saleType: "eceran",
      weighings: parsedWeighings(),
      birdCount: form.birdCount ? toNumber(form.birdCount) : undefined,
    };

    if (editingIndex !== null) {
      onUpdateStockOut(editingIndex, record);
    } else {
      onAddStockOut(record);
    }

    handleCancelEdit();
  };

  // Riwayat disaring berdasarkan tanggal terpilih (historyDate), dikombinasikan dengan pencarian teks.
  const filteredRecords = stockOut
    .filter((item) => item.date === historyDate)
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.bakulName.toLowerCase().includes(query) ||
        item.date.includes(query)
      );
    });

  // Total barang keluar per tanggal terpilih
  const historyTotals = stockOut
    .filter((item) => item.date === historyDate)
    .reduce((acc, item) => {
      const key = item.itemName.toLowerCase();
      acc[key] = (acc[key] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

  const handlePrintReceipt = (record: StockOutRecord) => {
    const total = record.quantity * record.price;
    const win = window.open("", "_blank", "width=320,height=640");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Struk Penjualan</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: 280px; margin: 0 auto; padding: 12px; font-family: 'Courier New', monospace; color: #000; font-size: 12px; }
            .center { text-align: center; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
            .sub { font-size: 10px; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; gap: 8px; }
            .b { font-weight: bold; }
            .total { font-size: 14px; font-weight: bold; margin-top: 4px; }
            .footer { text-align: center; font-size: 10px; margin-top: 10px; }
            @media print { body { width: 80mm; } }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">BUKU KEUANGAN AYAM</div>
            <div class="sub">Data Penjualan Ayam</div>
          </div>
          <div class="divider"></div>
          <div class="row"><span>No. Struk</span><span class="b">${record.id}</span></div>
          <div class="row"><span>Tanggal</span><span>${record.date}</span></div>
          <div class="row"><span>Bakul</span><span class="b">${record.bakulName}</span></div>
          <div class="divider"></div>
          <div class="row"><span>${record.itemName}</span></div>
          <div class="row"><span>&nbsp;&nbsp;${shortNumber(record.quantity)} kg x ${rupiah(record.price)}</span><span>${rupiah(total)}</span></div>
          <div class="divider"></div>
          <div class="row total"><span>TOTAL</span><span>${rupiah(total)}</span></div>
          <div class="divider"></div>
          <div class="footer">Terima kasih</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black text-[#191712]">
          {editingIndex === null ? "Input Barang Keluar / Penjualan" : "Edit Barang Keluar / Penjualan"}
        </h2>
        <p className="text-xs text-[#706858] mt-1 mb-4">
          Catat penjualan barang ke bakul. Harga jual otomatis diambil dari Master Bakul.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="date"
            label="Tanggal Keluar"
            labelPlacement="outside"
            value={form.date}
            onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
            radius="sm"
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#191712]">Nama Bakul</label>
            <Select
              aria-label="Pilih Nama Bakul"
              selectedKeys={form.bakulName ? [form.bakulName] : []}
              onSelectionChange={(keys) => {
                const selected = String(Array.from(keys)[0] ?? form.bakulName);
                setForm((prev) => ({ ...prev, bakulName: selected }));
              }}
              radius="sm"
              isDisabled={bakulNames.length === 0}
            >
              {bakulNames.map((name) => (
                <SelectItem key={name}>{name}</SelectItem>
              ))}
            </Select>
            {bakulNames.length === 0 && (
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                Belum ada data bakul. Buat di menu Master & Cadangan.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#191712]/10 bg-[#f7f5ef] p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Scale size={14} className="text-[#706858]" />
              <span className="text-xs font-bold text-[#191712]">Data Timbangan Keluar (kg)</span>
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
              Bisa juga pakai <strong>-</strong> untuk pengurangan.
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
          </div>

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

{isAdmin && (
            <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5 space-y-2">
              <div className="flex justify-between gap-3 text-xs">
                <span className="font-bold text-[#706858]">Harga Jual / kg (dari Master Bakul)</span>
                <span className="font-mono font-black text-[#191712]">{rupiah(autoPrice)}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="font-bold text-[#706858]">Total Penjualan</span>
                <span className="font-mono font-black text-[#1f8f5f]">{rupiah(totalAuto)}</span>
              </div>
              <Divider className="bg-[#191712]/5" />
              <div className="flex justify-between gap-3 text-xs">
<span className="font-bold text-[#706858]">Barang Masuk Aktif (tertaut)</span>
                <span className="font-mono font-black text-[#191712]">
                  {activeStockIn ? linkedItemName : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="font-bold text-[#706858]">Harga Modal / kg (dari Barang Masuk)</span>
                <span className="font-mono font-black text-[#8f321a]">
                  {activeStockIn ? rupiah(activeBuyPrice) : "Rp0"}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1 bg-[#191712] font-bold text-white shadow-sm"
              radius="sm"
              startContent={editingIndex === null ? <Plus size={16} /> : <Edit2 size={16} />}
            >
              {editingIndex === null ? "Simpan Penjualan" : "Simpan Perubahan"}
            </Button>
            {editingIndex !== null && (
              <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                Batal
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black text-[#191712]">Riwayat Barang Keluar</h2>
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
              placeholder="Cari barang/bakul..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search size={14} className="text-[#706858]" />}
              radius="sm"
              isClearable
              onClear={() => setSearch("")}
            />
          </div>
        </div>

        <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#191712]/5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#706858] uppercase">Total Barang Keluar</h3>
            <span className="text-[10px] font-bold text-[#706858]">{historyDate}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(historyTotals).map(([key, qty]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold border border-[#191712]/10"
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}: {shortNumber(qty)} kg
              </span>
            ))}
            {Object.keys(historyTotals).length === 0 && (
              <span className="text-xs text-[#706858]">Belum ada penjualan tercatat untuk {historyDate}.</span>
            )}
          </div>
        </div>

        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#706858]">
              Tidak ditemukan catatan barang keluar.
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
                      {item.date} - {item.bakulName}
                      {isRecordLocked(item.date) ? " 🔒 Terkunci" : ""}{" "}
                      {!isRecordLocked(item.date) && item.birdCount != null && item.birdCount > 0 && `• ${item.birdCount} ekor`}
                    </p>
                    {isAdmin && (
                      <p className="mt-1 text-[10px] text-[#706858] font-medium">
                        Harga jual: {rupiah(item.price)} / kg
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="font-mono font-black text-[#e05234]">-{shortNumber(item.quantity)} kg</span>
                      <p className="text-[10px] text-[#706858] font-mono font-bold">
                        {rupiah(item.price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-[#e6f1ff] font-bold text-[#173a61] min-w-unit-12"
                        startContent={<Printer size={14} />}
                        onPress={() => handlePrintReceipt(item)}
                        radius="sm"
                      >
                        Struk
                      </Button>
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

      <Modal isOpen={deleteConfirmIndex !== null} onClose={() => setDeleteConfirmIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <span>Hapus Catatan Barang Keluar?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data penjualan untuk{" "}
              <strong>{deleteConfirmIndex !== null ? stockOut[deleteConfirmIndex]?.itemName : ""}</strong>?
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
                    onDeleteStockOut(deleteConfirmIndex);
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

