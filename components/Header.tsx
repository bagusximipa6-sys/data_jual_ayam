"use client";

import {
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import {
  BookCopy,
  CloudCog,
  CloudOff,
  Loader,
  ShieldCheck,
} from "lucide-react";
import type { SyncStatus } from "@/lib/sync";

interface HeaderProps {
  syncStatus: SyncStatus;
  selectedMonth: string;
  availableMonths: string[];
  onMonthChange: (month: string) => void;
}

function SyncStatusIndicator({ status }: { status: SyncStatus }) {
  const indicators = {
    loading: {
      icon: <Loader size={14} className="animate-spin" />,
      text: "Memuat...",
      color: "text-[#706858]",
    },
    saving: {
      icon: <CloudCog size={14} className="animate-pulse" />,
      text: "Menyimpan...",
      color: "text-blue-600",
    },
    saved: {
      icon: <ShieldCheck size={14} />,
      text: "Tersimpan",
      color: "text-green-600",
    },
    offline: {
      icon: <CloudOff size={14} />,
      text: "Offline",
      color: "text-slate-500",
    },
    error: {
      icon: <CloudOff size={14} />,
      text: "Gagal",
      color: "text-red-600",
    },
  };

  const current = indicators[status];

  return (
    <div
      className={`hidden items-center gap-1.5 rounded-lg bg-[#f0eadb] px-3 py-2 text-xs font-bold sm:flex ${current.color}`}
    >
      {current.icon}
      <span className="hidden md:inline">{current.text}</span>
    </div>
  );
}

export function Header({
  syncStatus,
}: HeaderProps) {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const isStafOperasional = user?.publicMetadata?.role === "staf";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#191712]/10 bg-white/70 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#191712]">
            <BookCopy size={24} className="text-[#d9ff67]" />
          </div>
          <div>
            <h1 className="text-base font-black text-[#191712]">
              Buku Keuangan
            </h1>
            <p className="text-xs font-medium text-[#706858]">
              Data Penjualan Ayam
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <SyncStatusIndicator status={syncStatus} />

          <div className="flex items-center">
            {!user ? (
              <SignInButton mode="modal">
                <button className="h-10 rounded-lg bg-[#191712] px-4 text-sm font-semibold text-white hover:bg-black">
                  Masuk
                </button>
              </SignInButton>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    isAdmin
                      ? "bg-amber-100 text-amber-800"
                      : isStafOperasional
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {isAdmin ? "👑" : isStafOperasional ? "🛠️" : "👤"}
                  <span className="hidden lg:inline">
                    {isAdmin ? "Admin" : isStafOperasional ? "Staf Operasional" : "Staf"}
                  </span>
                </span>
                <UserButton />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}