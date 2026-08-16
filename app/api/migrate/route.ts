import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, type VercelPoolClient } from "@vercel/postgres";

export const dynamic = "force-dynamic";

// POST /api/migrate -> jalankan sql/schema.sql terhadap database
export async function POST(request: NextRequest) {
  let client: VercelPoolClient | null = null;
  try {
    // Ambil schema dari body (opsional) atau baca dari file
    let schema: string;
    try {
      const body = (await request.json()) as { schema?: string };
      schema = body?.schema || "";
    } catch {
      schema = "";
    }

    if (!schema) {
      const schemaPath = path.join(process.cwd(), "sql", "schema.sql");
      schema = await readFile(schemaPath, "utf-8");
    }

// Pecah menjadi statement (pisah per ';')
    // Buang dulu baris komentar (-- ...) agar CREATE TABLE yang didahului
    // komentar tidak ikut terhapus saat pemisahan statement.
    const statements = schema
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    client = await db.connect();

    for (const stmt of statements) {
      await client.sql`${stmt}`;
    }

    return NextResponse.json({ ok: true, executed: statements.length });
  } catch (err) {
    console.error("POST /api/migrate error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  } finally {
    client?.release();
  }
}
