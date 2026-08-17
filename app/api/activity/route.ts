import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { loadActivityLogs, logActivity } from "@/lib/db";
import type { ActivityAction } from "@/types/finance";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: ActivityAction[] = ["add", "update", "delete", "reset"];

// GET /api/activity -> ambil seluruh riwayat aktivitas (khusus admin)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Tidak terautentikasi." }, { status: 401 });
    }

    // Verifikasi admin lewat metadata publik.
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const isAdmin = user?.publicMetadata?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Akses ditolak. Khusus admin." }, { status: 403 });
    }

    const logs = await loadActivityLogs();
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    console.error("GET /api/activity error:", err);
    return NextResponse.json({ ok: false, error: "Gagal memuat riwayat aktivitas." }, { status: 500 });
  }
}

// POST /api/activity -> catat satu aktivitas (identitas user diambil server-side dari Clerk)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Tidak terautentikasi." }, { status: 401 });
    }

// Ambil identitas user dari Clerk (email & nama) secara server-side,
    // sehingga sumber utama identitas tidak bisa dipalsukan dari client.
    let serverEmail = "";
    let serverName = "";
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const primaryEmail = user.primaryEmailAddress?.emailAddress ?? "";
      serverEmail = user.emailAddresses
        ?.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? primaryEmail;
      const fullName = [user.firstName ?? "", user.lastName ?? ""].filter(Boolean).join(" ").trim();
      serverName = fullName || user.username || serverEmail || "";
    } catch (err) {
      console.warn("POST /api/activity: gagal ambil identitas Clerk, pakai body client.", err);
    }

    const body = (await request.json()) as {
      action?: string;
      entity?: string;
      entityId?: string;
      summary?: string;
      userEmail?: string;
      userName?: string;
    };

    const action = (VALID_ACTIONS.includes(body.action as ActivityAction)
      ? body.action
      : "add") as ActivityAction;
    const entity = (body.entity ?? "Data").slice(0, 100);
    const entityId = (body.entityId ?? "").slice(0, 200);
    const summary = (body.summary ?? "").slice(0, 500);

    // Prioritas identitas: Clerk server-side dulu, lalu fallback dari body client.
    const email = (serverEmail || body.userEmail || "").trim().slice(0, 200);
    const userName = (serverName || body.userName || email || "Staf").trim().slice(0, 200);

    const id = `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    await logActivity({
      id,
      action,
      entity,
      entityId,
      summary,
      userEmail: email,
      userName,
    });

    return NextResponse.json({
      ok: true,
      id,
      log: {
        id,
        action,
        entity,
        entityId,
        summary,
        userEmail: email,
        userName,
        createdAt,
      },
    });
  } catch (err) {
    console.error("POST /api/activity error:", err);
    return NextResponse.json({ ok: false, error: "Gagal mencatat aktivitas." }, { status: 500 });
  }
}
