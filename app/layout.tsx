import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Rembo Broiler | Buku Keuangan Usaha",
  icons: "/05963995-eb7f-41f2-ad09-3ab7e27a9f99.jpg",
  description: "Aplikasi pencatatan keuangan usaha perdagangan ayam, rekap penjualan, operasional, dan tagihan piutang bakul.",
  openGraph: {
    title: "Rembo Broiler | Buku Keuangan Usaha",
    description: "Aplikasi pencatatan keuangan usaha perdagangan ayam, rekap penjualan, operasional, dan tagihan piutang bakul.",
    siteName: "Rembo Broiler",
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
    <ClerkProvider>
      <html lang="en" className="light" suppressHydrationWarning>
        <body
          className="min-h-screen text-foreground bg-background font-sans antialiased"
          suppressHydrationWarning
        >
          <Providers>{children}</Providers> {/* Keep Providers if it's still needed for other contexts */}
        </body>
      </html>
    </ClerkProvider>
  );
}
