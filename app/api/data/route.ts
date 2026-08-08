import { NextRequest, NextResponse } from "next/server";
import { loadAllData, resetAllData, saveAllData, type AppDataSet } from "@/lib/db";

export const dynamic = "force-dynamic";

// Tanggal hari ini dalam format ISO (YYYY-MM-DD) sesuai zona waktu lokal server.
const todayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Penguncian Harian (Daily Lock): record dengan tanggal < hari ini dianggap terkunci.
const isLockedDate = (date: string): boolean =>
  typeof date === "string" && date.length >= 10 && date < todayISO();

// GET /api/data -> ambil seluruh data
export async function GET() {
  try {
    const data = await loadAllData();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/data error:", err);
    return NextResponse.json({ ok: false, error: "Gagal memuat data dari database." }, { status: 500 });
  }
}

// POST /api/data -> simpan seluruh data
// Termasuk guard Penguncian Harian: tolak jika ada record dengan tanggal lampau
// yang nilainya berubah dari kondisi DB saat ini (karena sistem full-replace).
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AppDataSet>;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Payload tidak valid." }, { status: 400 });
    }

const data: AppDataSet = {
      sales: body.sales ?? [],
      bakulRecords: body.bakulRecords ?? [],
      ops: body.ops ?? [],
      items: body.items ?? [],
      bakulMasters: body.bakulMasters ?? [],
      stockIn: body.stockIn ?? [],
      stockOut: body.stockOut ?? [],
      opsCategories: body.opsCategories ?? [],
      penyusutan: body.penyusutan ?? [],
      priceHistory: body.priceHistory ?? [],
    };

    // === Guard Penguncian Harian (server-side) ===
    // Bandingkan payload masuk dengan DB saat ini. Jika ada record tanggal lampau
    // yang diubah/dihapus/ditambah, tolak permintaan.
    const current = await loadAllData();

    // Helper: normalisasi array record ber-tanggal untuk dibandingkan.
    const sign = (arr: Array<Record<string, unknown>>) => arr.map((r) => JSON.stringify(r)).sort().join("|");

    // 1) Stock In: pastikan record tanggal lampau tidak berubah.
    const currentPastStockIn = current.stockIn.filter((r) => isLockedDate(r.date));
    const incomingPastStockIn = data.stockIn.filter((r) => isLockedDate(r.date));
    if (sign(incomingPastStockIn as unknown as Array<Record<string, unknown>>) !== sign(currentPastStockIn as unknown as Array<Record<string, unknown>>)) {
      return NextResponse.json(
        { ok: false, error: "Ditolak: data Barang Masuk pada tanggal lampau terkunci. Hanya tanggal hari ini yang dapat diedit." },
        { status: 403 }
      );
    }

    // 2) Stock Out: pastikan record tanggal lampau tidak berubah.
    const currentPastStockOut = current.stockOut.filter((r) => isLockedDate(r.date));
    const incomingPastStockOut = data.stockOut.filter((r) => isLockedDate(r.date));
    if (sign(incomingPastStockOut as unknown as Array<Record<string, unknown>>) !== sign(currentPastStockOut as unknown as Array<Record<string, unknown>>)) {
      return NextResponse.json(
        { ok: false, error: "Ditolak: data Barang Keluar pada tanggal lampau terkunci. Hanya tanggal hari ini yang dapat diedit." },
        { status: 403 }
      );
    }

    // 3) Operasional: pastikan record tanggal lampau tidak berubah.
    const currentPastOps = current.ops.filter((r) => isLockedDate(r.date));
    const incomingPastOps = data.ops.filter((r) => isLockedDate(r.date));
    if (sign(incomingPastOps as unknown as Array<Record<string, unknown>>) !== sign(currentPastOps as unknown as Array<Record<string, unknown>>)) {
      return NextResponse.json(
        { ok: false, error: "Ditolak: data Operasional pada tanggal lampau terkunci. Hanya tanggal hari ini yang dapat diedit." },
        { status: 403 }
      );
    }

    // 4) Piutang Bakul: pastikan record tanggal lampau tidak berubah.
    const currentPastBakul = current.bakulRecords.filter((r) => isLockedDate(r.date));
    const incomingPastBakul = data.bakulRecords.filter((r) => isLockedDate(r.date));
    if (sign(incomingPastBakul as unknown as Array<Record<string, unknown>>) !== sign(currentPastBakul as unknown as Array<Record<string, unknown>>)) {
      return NextResponse.json(
        { ok: false, error: "Ditolak: data Piutang Bakul pada tanggal lampau terkunci. Hanya tanggal hari ini yang dapat diedit." },
        { status: 403 }
      );
    }

    // 5) Penyusutan: pastikan record tanggal lampau tidak berubah.
    const currentPastPenyusutan = current.penyusutan.filter((r) => isLockedDate(r.date));
    const incomingPastPenyusutan = data.penyusutan.filter((r) => isLockedDate(r.date));
    if (sign(incomingPastPenyusutan as unknown as Array<Record<string, unknown>>) !== sign(currentPastPenyusutan as unknown as Array<Record<string, unknown>>)) {
      return NextResponse.json(
        { ok: false, error: "Ditolak: data Penyusutan pada tanggal lampau terkunci. Hanya tanggal hari ini yang dapat diedit." },
        { status: 403 }
      );
    }

    await saveAllData(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/data error:", err);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan data ke database." }, { status: 500 });
  }
}

// DELETE /api/data -> reset seluruh data
export async function DELETE() {
  try {
    await resetAllData();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/data error:", err);
    return NextResponse.json({ ok: false, error: "Gagal mereset data." }, { status: 500 });
  }
}
