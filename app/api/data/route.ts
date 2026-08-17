import { NextRequest, NextResponse } from "next/server";
import { loadAllData, resetAllData, saveAllData, type AppDataSet } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// Pesan error spesifik per entitas (untuk membantu pengguna menemukan baris yang bermasalah).
const entityLabel: Record<string, string> = {
  items: "Master Barang",
  bakulMasters: "Master Bakul",
  stockIn: "Barang Masuk",
  stockOut: "Barang Keluar / Penjualan",
  sales: "Rekap Penjualan",
  bakulRecords: "Piutang Bakul",
  ops: "Operasional",
  penyusutan: "Penyusutan",
  priceHistory: "Riwayat Harga",
};

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
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Tidak terautentikasi." }, { status: 401 });
    }

    // User login boleh menyimpan data harian. Restore/import penuh tetap khusus admin.
    // Menggunakan type assertion untuk CustomPublicMetadata yang didefinisikan secara global.
    const publicMetadata = sessionClaims?.publicMetadata as CustomPublicMetadata | undefined;

    const body = (await request.json()) as Partial<AppDataSet> & { force?: boolean };
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Payload tidak valid." }, { status: 400 });
    }

    // `force` = Restore/Import penuh (oleh admin). Saat true, guard Penguncian
    // Harian dilewati agar data tanggal lampau dari backup dapat ditulis.
    const force = body.force === true;
    if (force && publicMetadata?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Akses ditolak. Restore data hanya untuk admin." }, { status: 403 });
    }

    let data: AppDataSet = {
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
    // yang diubah/dihapus/ditambah, tolak permintaan. (Dilewatkan saat `force`.)
    if (!force) {
      const current = await loadAllData();
      const keepUnlockedOnly = <T extends { date: string }>(records: T[]) =>
        records.filter((record) => !isLockedDate(record.date));

      // Karena endpoint ini memakai model full-replace, payload normal selalu
      // membawa snapshot lengkap. Untuk daily lock, pertahankan record lampau
      // dari DB dan hanya terima perubahan pada tanggal hari ini/masa depan.
      data = {
        ...data,
        stockIn: [
          ...current.stockIn.filter((record) => isLockedDate(record.date)),
          ...keepUnlockedOnly(data.stockIn),
        ],
        stockOut: [
          ...current.stockOut.filter((record) => isLockedDate(record.date)),
          ...keepUnlockedOnly(data.stockOut),
        ],
        ops: [
          ...current.ops.filter((record) => isLockedDate(record.date)),
          ...keepUnlockedOnly(data.ops),
        ],
        penyusutan: [
          ...current.penyusutan.filter((record) => isLockedDate(record.date)),
          ...keepUnlockedOnly(data.penyusutan),
        ],
      };

      // 4) Piutang Bakul: sengaja TIDAK dikunci (daily lock dimatikan)
      //    agar pengguna dapat menambah/mengubah/menghapus piutang pada tanggal hari sebelumnya.
    }

    // === Simpan seluruh data dalam satu transaksi (rollback jika gagal) ===
    // saveAllData sudah membungkus semua INSERT dalam BEGIN/COMMIT + ROLLBACK.
    // Jika ada baris/field yang bermasalah, exception akan tertangkap di sini
    // dan dikirim detail pesannya (bukan sekadar "Gagal").
    try {
      await saveAllData(data);
    } catch (saveErr) {
      const detail = saveErr instanceof Error ? saveErr.message || String(saveErr) : String(saveErr);
      console.error("POST /api/data saveAllData error:", saveErr);
      return NextResponse.json(
        {
          ok: false,
          error: `Gagal menyimpan: ${detail}`,
          detail,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/data error:", err);
    return NextResponse.json(
      { ok: false, error: "Gagal menyimpan data ke database.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/data -> reset seluruh data
export async function DELETE() {
  try {
    const { userId, sessionClaims } = await auth();
    // Hanya admin yang boleh mereset data. Menggunakan type assertion untuk CustomPublicMetadata.
    const publicMetadata = sessionClaims?.publicMetadata as CustomPublicMetadata | undefined;
    if (publicMetadata?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Akses ditolak. Hanya admin yang dapat mereset data." }, { status: 403 });
    }

    await resetAllData();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/data error:", err);
    return NextResponse.json({ ok: false, error: "Gagal mereset data." }, { status: 500 });
  }
}
