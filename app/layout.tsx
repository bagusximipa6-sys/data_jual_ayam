import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: 'Rembo Broiler | Buku Keuangan Usaha',
  description: 'Buku Keuangan Usaha Rembo Broiler',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
}

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
