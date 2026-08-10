import { ImageResponse } from "next/og";

export const alt = "Buku Keuangan Usaha - Data Penjualan Ayam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Runtime edge/node
export const runtime = "edge";

export default async function OgImage() {
  // Membaca file gambar langsung dari direktori public
  const image = await fetch(
    new URL("./05963995-eb7f-41f2-ad09-3ab7e27a9f99.jpg", import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div tw="w-full h-full flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` requires a standard `img` tag. */}
        {/* @ts-expect-error - Vercel's ImageResponse expects a string for src, but can handle an ArrayBuffer. */}
        <img src={image} alt={alt} tw="w-full h-full" />
      </div>
    ),
    size
  );
}
