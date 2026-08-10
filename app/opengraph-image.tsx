import { ImageResponse } from "next/og";

export const alt = "Buku Keuangan Usaha - Data Penjualan Ayam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="http://localhost:3000/05963995-eb7f-41f2-ad09-3ab7e27a9f99.jpg" alt={alt} tw="w-full h-full" />
    ),
    size
  );
}
