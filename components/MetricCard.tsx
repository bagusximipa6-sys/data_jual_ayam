"use client";

import { ElementType } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  tone: "plain" | "blue" | "red" | "green" | "yellow" | "purple";
  icon: ElementType;
  subtitle?: string;
}

export function MetricCard({ label, value, tone, icon: Icon, subtitle }: MetricCardProps) {
const tones = {
    plain: "bg-gradient-to-br from-white to-zinc-100 border-zinc-200 text-zinc-800",
    blue: "bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 border-sky-700 text-white",
    red: "bg-gradient-to-br from-rose-400 via-rose-500 to-red-600 border-rose-700 text-white",
    green: "bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 border-emerald-700 text-white",
    yellow: "bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 border-amber-600 text-amber-950",
    purple: "bg-gradient-to-br from-violet-400 via-violet-500 to-purple-600 border-purple-700 text-white",
  };

  const iconTones = {
    plain: "bg-white/90 text-zinc-700",
    blue: "bg-white/25 text-white",
    red: "bg-white/25 text-white",
    green: "bg-white/25 text-white",
    yellow: "bg-amber-950/15 text-amber-950",
    purple: "bg-white/25 text-white",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-4 shadow-sm transition-all hover:shadow-md ${tones[tone]}`}
    >
<div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTones[tone]} shadow-sm backdrop-blur-xs`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        {subtitle && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-80" />
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-slate-500">
          {label}
        </p>
        <p className="mt-1 break-words text-lg font-black tracking-tight xl:text-xl drop-shadow-sm">
          {value}
        </p>
      </div>
    </div>
  );
}
