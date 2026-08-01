"use client";

import { rupiah } from "@/lib/utils";
import { useState } from "react";

interface ChartRow {
  date: string;
  label: string;
  sales: number;
  profit: number;
}

interface SalesProfitChartProps {
  rows: ChartRow[];
}

export function SalesProfitChart({ rows }: SalesProfitChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const visibleRows = rows.slice(-28);
  if (visibleRows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl bg-[#f7f5ef] text-sm text-[#706858]">
        Belum ada data penjualan untuk grafik.
      </div>
    );
  }

  const maxSales = Math.max(...visibleRows.map((row) => row.sales), 1);
  const minProfit = Math.min(...visibleRows.map((row) => row.profit), 0);
  const maxProfit = Math.max(...visibleRows.map((row) => row.profit), 1);
  const profitRange = Math.max(maxProfit - minProfit, 1);

  const points = visibleRows
    .map((row, index) => {
      const x = (index / Math.max(visibleRows.length - 1, 1)) * 96 + 2;
      const y = 78 - ((row.profit - minProfit) / profitRange) * 54;
      return `${x},${y}`;
    })
    .join(" ");

  const activeRow = hoveredIndex !== null ? visibleRows[hoveredIndex] : null;

  return (
    <div className="space-y-4">
      {/* Legend & Tooltip Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#706858]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#6bb6ff]" /> Penjualan
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-[#1f8f5f]" /> Laba Bersih
          </span>
        </div>

        {activeRow ? (
          <div className="flex items-center gap-3 rounded-md bg-[#191712] px-3 py-1 text-white shadow-sm">
            <span>📅 {activeRow.date}</span>
            <span>💰 Penjualan: {rupiah(activeRow.sales)}</span>
            <span className={activeRow.profit >= 0 ? "text-[#d9ff67]" : "text-red-300"}>
              📈 Laba: {rupiah(activeRow.profit)}
            </span>
          </div>
        ) : (
          <span className="text-[11px] font-normal italic text-[#8a806c]">
            Arahkan kursor ke titik/grafik untuk melihat detail harian
          </span>
        )}
      </div>

      {/* SVG Container */}
      <div className="relative h-[280px] overflow-hidden rounded-xl bg-[#f7f5ef] p-4 shadow-inner">
        <svg viewBox="0 0 100 90" className="h-full w-full overflow-visible" role="img">
          <defs>
            <linearGradient id="salesBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[20, 35, 50, 65, 80].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="rgba(25,23,18,0.06)"
              strokeWidth="0.4"
            />
          ))}

          {/* Bars */}
          {visibleRows.map((row, index) => {
            const barWidth = Math.min(2.5, 70 / Math.max(visibleRows.length, 1));
            const x = (index / Math.max(visibleRows.length - 1, 1)) * 96 + 2 - barWidth / 2;
            const height = Math.max(2, (row.sales / maxSales) * 54);
            const isHovered = hoveredIndex === index;

            return (
              <rect
                key={`bar-${row.label}-${index}`}
                x={x}
                y={78 - height}
                width={barWidth}
                height={height}
                rx="0.6"
                fill="url(#salesBarGradient)"
                className="cursor-pointer transition-all duration-150"
                opacity={hoveredIndex === null || isHovered ? 1 : 0.4}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}

          {/* Profit Polyline */}
          <polyline
            fill="none"
            stroke="#1f8f5f"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Profit Dots */}
          {visibleRows.map((row, index) => {
            const x = (index / Math.max(visibleRows.length - 1, 1)) * 96 + 2;
            const y = 78 - ((row.profit - minProfit) / profitRange) * 54;
            const isHovered = hoveredIndex === index;

            return (
              <circle
                key={`dot-${row.label}-${index}`}
                cx={x}
                cy={y}
                r={isHovered ? "2.2" : "1.2"}
                fill={isHovered ? "#d9ff67" : "#1f8f5f"}
                stroke={isHovered ? "#191712" : "none"}
                strokeWidth="0.5"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg bg-[#f7f5ef] p-3">
          <p className="font-mono text-[10px] uppercase text-[#706858]">Penjualan Tertinggi</p>
          <p className="font-bold text-[#191712]">
            {rupiah(Math.max(...visibleRows.map((r) => r.sales), 0))}
          </p>
        </div>
        <div className="rounded-lg bg-[#f7f5ef] p-3">
          <p className="font-mono text-[10px] uppercase text-[#706858]">Laba Tertinggi</p>
          <p className="font-bold text-[#1f8f5f]">
            {rupiah(Math.max(...visibleRows.map((r) => r.profit), 0))}
          </p>
        </div>
        <div className="rounded-lg bg-[#f7f5ef] p-3">
          <p className="font-mono text-[10px] uppercase text-[#706858]">Laba Terendah</p>
          <p className="font-bold text-[#8f321a]">
            {rupiah(Math.min(...visibleRows.map((r) => r.profit), 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
