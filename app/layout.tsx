import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
title: "Buku Keuangan Usaha | Data Jual Ayam",
  description: "Aplikasi pencatatan keuangan usaha perdagangan ayam, rekap penjualan, operasional, dan tagihan piutang bakul.",
  openGraph: {
    title: "Buku Keuangan Usaha | Data Jual Ayam",
    description: "Aplikasi pencatatan keuangan usaha perdagangan ayam, rekap penjualan, operasional, dan tagihan piutang bakul.",
    siteName: "Buku Keuangan Usaha",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className="min-h-screen text-foreground bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
