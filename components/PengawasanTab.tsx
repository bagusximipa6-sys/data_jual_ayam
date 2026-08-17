"use client";

import { Chip, Input } from "@heroui/react";
import { Activity, Eye, Mail, PencilRuler, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityAction, ActivityLog } from "@/types/finance";

interface PengawasanTabProps {
  logs: ActivityLog[];
  onRefresh: () => void;
}

const ACTION_META: Record<ActivityAction, { label: string; className: string; icon: typeof Plus }> = {
  add: { label: "Tambah", className: "bg-[#e7f5ec] text-[#1f8f5f]", icon: Plus },
  update: { label: "Edit", className: "bg-[#e6f1ff] text-[#173a61]", icon: PencilRuler },
  delete: { label: "Hapus", className: "bg-[#ffe2d8] text-[#8f321a]", icon: Trash2 },
  reset: { label: "Reset", className: "bg-[#fff3cd] text-[#8f6b00]", icon: RefreshCw },
};

const formatDateTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function PengawasanTab({ logs, onRefresh }: PengawasanTabProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.entity.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q) ||
        log.action.includes(q)
    );
  }, [logs, search]);

const stats = useMemo(() => {
    const count = (action: ActivityAction) => logs.filter((l) => l.action === action).length;
    const users = new Set(logs.map((l) => l.userEmail || l.userName).filter(Boolean));
    return {
      total: logs.length,
      add: count("add"),
      update: count("update"),
      delete: count("delete"),
      reset: count("reset"),
      users: users.size,
    };
  }, [logs]);

  // Inisial avatar dari nama, fallback ke huruf pertama email, lalu fallback netral.
  const initialsOf = (log: ActivityLog) => {
    const name = (log.userName || "").trim();
if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = (parts[0]?.[0] ?? "").toUpperCase();
      const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "").toUpperCase();
      return (first + last).slice(0, 2);
    }
    const email = (log.userEmail || "").trim();
    if (email) return email[0].toUpperCase();
    return "?";
  };

  // Nama tampilan: nama bila ada, else email bila ada, else label netral (bukan role "Staf").
  const displayName = (log: ActivityLog) => {
    const name = (log.userName || "").trim();
    if (name) return name;
    const email = (log.userEmail || "").trim();
    if (email) return email;
    return "Pengguna";
  };

  const avatarTones = [
    "bg-[#e6f1ff] text-[#173a61]",
    "bg-[#e7f5ec] text-[#1f8f5f]",
    "bg-[#fff3cd] text-[#8f6b00]",
    "bg-[#ffe2d8] text-[#8f321a]",
    "bg-[#f0eadb] text-[#191712]",
  ];
  const avatarTone = (log: ActivityLog) => {
    const seed = (log.userEmail || log.userName || "").length;
    return avatarTones[seed % avatarTones.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#191712]">
            <ShieldCheck size={22} className="text-[#d9ff67]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#191712]">Alur Pengawasan</h2>
            <p className="text-xs text-[#706858]">
              Riwayat aktivitas Tambah / Edit / Hapus beserta identitas staf & admin yang mengubah data.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg bg-[#191712] px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
        >
          <RefreshCw size={14} />
          Muat Ulang
        </button>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Aktivitas" value={stats.total} tone="dark" />
        <StatCard label="Tambah" value={stats.add} tone="green" />
        <StatCard label="Edit" value={stats.update} tone="blue" />
        <StatCard label="Hapus" value={stats.delete} tone="red" />
        <StatCard label="Reset" value={stats.reset} tone="yellow" />
<div className="relative">
          <StatCard label="Staf / Pengguna" value={stats.users} tone="plain" />
          <span
            className="absolute bottom-1.5 right-2 text-[9px] font-bold text-[#706858]/70"
            title="Jumlah pengguna unik dihitung dari nama/email yang tercatat pada riwayat aktivitas."
          >
            unik
          </span>
        </div>
      </div>

      {/* Tabel Riwayat */}
      <div className="rounded-2xl border border-[#191712]/10 bg-white p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[#706858]" />
            <h3 className="text-base font-black text-[#191712]">Riwayat Aktivitas</h3>
            <Chip size="sm" className="bg-[#f0eadb] font-bold text-[#191712]">
              {filtered.length}
            </Chip>
          </div>
          <div className="w-full sm:w-64">
            <Input
              size="sm"
              placeholder="Cari aksi/entitas/nama/email..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search size={14} className="text-[#706858]" />}
              radius="sm"
              isClearable
              onClear={() => setSearch("")}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Eye size={40} className="mx-auto mb-3 text-[#b0a99a]" />
            <p className="text-sm font-bold text-[#191712]">Belum ada riwayat aktivitas</p>
            <p className="text-xs text-[#706858] mt-1">
              Setiap aksi Tambah / Edit / Hapus pada data akan tercatat di sini secara otomatis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#191712]/10 text-[11px] uppercase tracking-wide text-[#706858]">
                  <th className="py-3 pr-4 font-bold">Waktu</th>
                  <th className="py-3 pr-4 font-bold">Aksi</th>
                  <th className="py-3 pr-4 font-bold">Entitas</th>
                  <th className="py-3 pr-4 font-bold">Ringkasan</th>
                  <th className="py-3 pr-4 font-bold">Nama Pelaku</th>
                  <th className="py-3 pr-4 font-bold">Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const meta = ACTION_META[log.action] ?? ACTION_META.add;
                  const ActionIcon = meta.icon;
                  return (
                    <tr key={log.id} className="border-b border-[#191712]/5 last:border-0 hover:bg-[#f7f5ef]/70">
                      <td className="py-3 pr-4 text-xs font-medium whitespace-nowrap text-[#706858]">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.className}`}
                        >
                          <ActionIcon size={11} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-bold text-[#191712] whitespace-nowrap">{log.entity}</td>
                      <td className="py-3 pr-4 text-xs text-[#706858]">{log.summary || "—"}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${avatarTone(log)}`}
                            title={displayName(log)}
                          >
                            {initialsOf(log)}
                          </span>
                          <div className="min-w-0 text-xs">
                            <p className="truncate font-bold text-[#191712]">{displayName(log)}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#706858]">
                              {log.action === "update" ? "Diedit oleh" : "Dicatat oleh"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#706858]">
                        {log.userEmail ? (
                          <span className="inline-flex max-w-[220px] items-center gap-1.5">
                            <Mail size={12} className="shrink-0" />
                            <span className="truncate" title={log.userEmail}>
                              {log.userEmail}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "dark" | "green" | "blue" | "red" | "yellow" | "plain";
}) {
  const tones: Record<string, string> = {
    dark: "bg-[#191712] text-white",
    green: "bg-[#e7f5ec] text-[#1f8f5f]",
    blue: "bg-[#e6f1ff] text-[#173a61]",
    red: "bg-[#ffe2d8] text-[#8f321a]",
    yellow: "bg-[#fff3cd] text-[#8f6b00]",
    plain: "bg-[#f0eadb] text-[#191712]",
  };
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black">{value}</p>
    </div>
  );
}
