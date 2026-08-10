import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rembo Broiler | Buku Keuangan Usaha',
    short_name: 'Rembo Broiler',
    description: 'Aplikasi Buku Keuangan Usaha Rembo Broiler',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}