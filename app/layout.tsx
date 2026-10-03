import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'TikTok Hotel — Juego Interactivo TikTok LIVE',
  description: 'Hotel virtual interactivo 2D en tiempo real para transmisiones de TikTok LIVE con simulación de residentes, regalos, eventos dinámicos y penthouse VIP.',
  openGraph: {
    title: 'TikTok Hotel — Juego Interactivo TikTok LIVE',
    description: 'Hotel virtual interactivo 2D en tiempo real para transmisiones de TikTok LIVE con simulación de residentes, regalos, eventos dinámicos y penthouse VIP.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TikTok Hotel — Juego Interactivo TikTok LIVE',
    description: 'Hotel virtual interactivo 2D en tiempo real para transmisiones de TikTok LIVE con simulación de residentes, regalos, eventos dinámicos y penthouse VIP.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
