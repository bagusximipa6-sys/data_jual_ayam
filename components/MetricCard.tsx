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
    plain: "bg-white border-zinc-200/80 text-[#191712]",
    blue: "bg-gradient-to-br from-[#e0f2fe] to-[#bae6fd] border-sky-300 text-sky-950",
    red: "bg-gradient-to-br from-[#ffe4e6] to-[#fecdd3] border-rose-300 text-rose-950",
    green: "bg-gradient-to-br from-[#ecfccb] to-[#d9f99d] border-lime-300 text-lime-950",
    yellow: "bg-gradient-to-br from-[#fef9c3] to-[#fef08a] border-amber-300 text-amber-950",
    purple: "bg-gradient-to-br from-[#f3e8ff] to-[#e9d5ff] border-purple-300 text-purple-950",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${tones[tone]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-xs backdrop-blur-xs text-[#191712]">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        {subtitle && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#706858] opacity-80">
            {subtitle}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#706858]">
          {label}
        </p>
        <p className="mt-1 break-words text-lg font-black tracking-tight xl:text-xl">
          {value}
        </p>
      </div>
    </div>
  );
}
