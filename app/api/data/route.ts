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
export const todayISO = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

    let rejectedLockedCount = 0;

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
      const mergeWithGuard = <T extends { id?: string; date: string }>(
      currentList: T[],
      incomingList: T[]
      ): { merged: T[]; rejected: number } => {
      const currentIds = new Set(currentList.map((r) => r.id).filter(Boolean));
      const protectedOld = currentList.filter((r) => isLockedDate(r.date));

      let rejected = 0;
      const acceptedIncoming = incomingList.filter((r) => {
       const locked = isLockedDate(r.date);
       const existsInDb = !!r.id && currentIds.has(r.id);
       if (locked && existsInDb) {
         rejected += 1; // ini edit/hapus pada data lama yang terkunci -> ditolak (benar)
         return false;
       }
       return true; // baik itu tidak locked, ATAU locked tapi memang record baru -> diterima
      });

      const seen = new Set<string>();
      const merged: T[] = [];
      for (const r of [...protectedOld, ...acceptedIncoming]) {
        const key = r.id ?? JSON.stringify(r);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(r);
      }
      return { merged, rejected };
    };

      const stockInResult = mergeWithGuard(current.stockIn, data.stockIn);
      const stockOutResult = mergeWithGuard(current.stockOut, data.stockOut);
      const opsResult = mergeWithGuard(current.ops, data.ops);
      const penyusutanResult = mergeWithGuard(current.penyusutan, data.penyusutan);

      data = {
        ...data,
        stockIn: stockInResult.merged,
        stockOut: stockOutResult.merged,
        ops: opsResult.merged,
        penyusutan: penyusutanResult.merged,
      };   
    rejectedLockedCount =
       stockInResult.rejected + stockOutResult.rejected + opsResult.rejected + penyusutanResult.rejected;

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

    return NextResponse.json({
      ok: true,
      ...(rejectedLockedCount > 0 ? { rejectedLockedCount } : {}),
    });
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
