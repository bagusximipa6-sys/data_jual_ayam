import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Buku Keuangan Usaha | Data Jual Telur",
  description: "Aplikasi pencatatan keuangan usaha perdagangan telur, rekap penjualan, operasional, dan tagihan piutang bakul.",
  openGraph: {
    title: "Buku Keuangan Usaha | Data Jual Telur",
    description: "Aplikasi pencatatan keuangan usaha perdagangan telur, rekap penjualan, operasional, dan tagihan piutang bakul.",
    siteName: "Buku Keuangan Usaha",
  },
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
