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
  Progress,
  Textarea,
} from "@heroui/react";
import { AlertCircle, AlertTriangle, Edit2, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getTodayDate, rupiah, toNumber } from "@/lib/utils";
import { BakulRecord, Role } from "@/types/finance";

interface OverdueTabProps {
  bakulRecords: BakulRecord[];
  role: Role;
  onUpdateBakul: (index: number, record: BakulRecord) => void;
  onDeleteBakul: (index: number) => void;
  /** Ambang hari dianggap overdue. Default 3 hari. */
  overdueThresholdDays?: number;
}

// Menghitung selisih hari kalender antara sebuah tanggal (YYYY-MM-DD) dengan hari ini.
function daysSince(dateStr: string): number {
  const today = new Date(getTodayDate() + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  const diffMs = today.getTime() - target.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function OverdueTab({
  bakulRecords,
  role,
  onUpdateBakul,
  onDeleteBakul,
  overdueThresholdDays = 3,
}: OverdueTabProps) {
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    date: "",
    name: "",
    bill: "",
    paid: "",
    note: "",
  });

  const billNum = toNumber(form.bill);
  const paidNum = toNumber(form.paid);
  const liveBalance = billNum - paidNum;

  // Daftar overdue: belum lunas (balance > 0) DAN umur piutang > threshold.
  // Begitu balance jadi <= 0 (misal setelah diedit jadi lunas), otomatis hilang dari sini.
  const overdueRecords = useMemo(() => {
    return bakulRecords
      .map((item, originalIndex) => ({ item, originalIndex, age: daysSince(item.date) }))
      .filter(({ item, age }) => item.balance > 0 && age > overdueThresholdDays)
      .filter(({ item }) => {
        if (!search.trim()) return true;
        const query = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.date.includes(query) ||
          item.note.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.age - a.age); // paling lama menunggak di atas
  }, [bakulRecords, search, overdueThresholdDays]);

  const totalOverdueBalance = overdueRecords.reduce((sum, { item }) => sum + item.balance, 0);

  const handleStartEdit = (item: BakulRecord, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setForm({
      date: item.date,
      name: item.name,
      bill: String(item.bill),
      paid: String(item.paid),
      note: item.note,
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setForm({ date: "", name: "", bill: "", paid: "", note: "" });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex === null || !form.name.trim() || !billNum) return;

    const record: BakulRecord = {
      date: form.date,
      name: form.name.trim(),
      bill: billNum,
      paid: paidNum,
      balance: liveBalance,
      note: form.note.trim(),
    };

    onUpdateBakul(editingIndex, record);
    handleCancelEdit();
  };

  const severityChip = (age: number) => {
    if (age > 14) return { color: "bg-[#8f321a] text-white", label: `${age} hari` };
    if (age > 7) return { color: "bg-[#e05234] text-white", label: `${age} hari` };
    return { color: "bg-[#f4a340] text-white", label: `${age} hari` };
  };

  return (
    <div className="space-y-4">
      {/* Header + Summary */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-[#191712]">
              <AlertTriangle size={20} className="text-[#e05234]" />
              Piutang Overdue
            </h2>
            <p className="mt-1 text-xs text-[#706858]">
              Menampilkan piutang bakul yang belum lunas dan sudah lewat {overdueThresholdDays} hari
              dari tanggal transaksi. Otomatis hilang jika sudah dibayar lunas.
            </p>
          </div>
          <Input
            size="sm"
            className="w-full sm:w-56"
            placeholder="Cari nama/tanggal/catatan..."
            value={search}
            onValueChange={setSearch}
            startContent={<Search size={14} className="text-[#706858]" />}
            radius="sm"
            isClearable
            onClear={() => setSearch("")}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:w-fit sm:grid-cols-2">
          <div className="rounded-xl bg-[#f7f5ef] p-3 text-xs">
            <span className="block text-[10px] font-bold uppercase text-[#706858]">
              Jumlah Bakul Overdue
            </span>
            <span className="font-mono text-base font-black text-[#191712]">
              {overdueRecords.length}
            </span>
          </div>
          <div className="rounded-xl bg-[#f7f5ef] p-3 text-xs">
            <span className="block text-[10px] font-bold uppercase text-[#706858]">
              Total Sisa Piutang
            </span>
            <span className="font-mono text-base font-black text-[#e05234]">
              {rupiah(totalOverdueBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {overdueRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#706858]">
              🎉 Tidak ada piutang overdue saat ini.
            </div>
          ) : (
            overdueRecords.map(({ item, originalIndex, age }) => {
              const paidPercent = item.bill
                ? Math.min(100, Math.max(0, Math.round((item.paid / item.bill) * 100)))
                : 0;
              const severity = severityChip(age);

              return (
                <Card
                  key={`${item.date}-${item.name}-${originalIndex}`}
                  shadow="none"
                  radius="sm"
                  className="border border-[#e05234]/30 bg-white transition-all hover:border-[#e05234]/60"
                >
                  <CardBody className="gap-3 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-[#191712]">{item.name}</h3>
                          <Chip size="sm" radius="sm" className={`${severity.color} font-bold`}>
                            {severity.label}
                          </Chip>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-[#706858]">
                          Transaksi {item.date} {item.note ? `• ${item.note}` : ""}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="block text-[10px] font-bold uppercase text-[#706858]">
                          Sisa Piutang
                        </span>
                        <span className="font-mono text-sm font-black text-[#e05234]">
                          {rupiah(item.balance)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-[#f7f5ef] p-2">
                        <span className="block text-[10px] uppercase text-[#706858]">Tagihan</span>
                        <span className="font-bold">{rupiah(item.bill)}</span>
                      </div>
                      <div className="rounded-lg bg-[#f7f5ef] p-2">
                        <span className="block text-[10px] uppercase text-[#706858]">Dibayar</span>
                        <span className="font-bold text-[#1f8f5f]">{rupiah(item.paid)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-[#706858]">
                        <span>Status Pembayaran</span>
                        <span>{paidPercent}% Lunas</span>
                      </div>
                      <Progress
                        aria-label={`Progress tagihan ${item.name}`}
                        value={paidPercent}
                        size="sm"
                        classNames={{ indicator: "bg-[#e05234]" }}
                      />
                    </div>

                    {role === "admin" && (
                      <div className="flex gap-2 border-t border-[#191712]/5 pt-1">
                        <Button
                          size="sm"
                          variant="flat"
                          className="font-bold"
                          onPress={() => handleStartEdit(item, originalIndex)}
                          radius="sm"
                          startContent={<Edit2 size={14} />}
                        >
                          Edit / Tandai Lunas
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
              );
            })
          )}
        </div>
      </div>

      {/* Edit Modal (admin only) */}
      <Modal isOpen={editingIndex !== null} onClose={handleCancelEdit} size="lg">
        <ModalContent>
          <ModalHeader>Edit Piutang Overdue</ModalHeader>
          <ModalBody className="pb-6">
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <Input
                type="date"
                label="Tanggal Transaksi"
                labelPlacement="outside"
                value={form.date}
                onValueChange={(date) => setForm((prev) => ({ ...prev, date }))}
                radius="sm"
                required
              />
              <Input
                label="Nama Bakul"
                labelPlacement="outside"
                value={form.name}
                onValueChange={(name) => setForm((prev) => ({ ...prev, name }))}
                radius="sm"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Jumlah Tagihan (Rp)"
                  labelPlacement="outside"
                  value={form.bill}
                  onValueChange={(bill) => setForm((prev) => ({ ...prev, bill }))}
                  radius="sm"
                  required
                />
                <Input
                  label="Jumlah Dibayar (Rp)"
                  labelPlacement="outside"
                  value={form.paid}
                  onValueChange={(paid) => setForm((prev) => ({ ...prev, paid }))}
                  radius="sm"
                />
              </div>
              <Textarea
                label="Keterangan"
                labelPlacement="outside"
                value={form.note}
                onValueChange={(note) => setForm((prev) => ({ ...prev, note }))}
                radius="sm"
              />

              <div className="flex items-center justify-between rounded-xl border border-[#191712]/5 bg-[#f7f5ef] p-4 text-xs">
                <span className="font-bold text-[#706858]">Sisa Piutang Setelah Diedit:</span>
                <span
                  className={`font-mono text-sm font-black ${
                    liveBalance > 0 ? "text-[#e05234]" : "text-[#1f8f5f]"
                  }`}
                >
                  {rupiah(liveBalance)}
                </span>
              </div>
              {liveBalance <= 0 && (
                <p className="text-[11px] font-semibold text-[#1f8f5f]">
                  ✓ Setelah disimpan, catatan ini akan otomatis hilang dari daftar overdue karena
                  sudah lunas.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-[#191712] font-bold text-white" radius="sm">
                  Simpan Perubahan
                </Button>
                <Button variant="flat" onPress={handleCancelEdit} radius="sm">
                  Batal
                </Button>
              </div>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmIndex !== null} onClose={() => setDeleteConfirmIndex(null)} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <span>Hapus Catatan Bakul?</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus data tagihan untuk{" "}
              <strong>{deleteConfirmIndex !== null ? bakulRecords[deleteConfirmIndex]?.name : ""}</strong>?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="flat" radius="sm" onPress={() => setDeleteConfirmIndex(null)}>
                Batal
              </Button>
              <Button
                className="bg-rose-600 font-bold text-white"
                radius="sm"
                onPress={() => {
                  if (deleteConfirmIndex !== null) {
                    onDeleteBakul(deleteConfirmIndex);
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