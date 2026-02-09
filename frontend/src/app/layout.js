import { Inter } from 'next/font/google';
import './globals.css';
import UpdateGuard from './components/UpdateGuard';
import MaintenanceGuard from './components/MaintenanceGuard';

const inter = Inter({ subsets: ['latin'] });

// 🚀 1. NEW VIEWPORT API (Next.js 14+ Requirement)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
};

// 🚀 2. PROFESSIONAL SEO METADATA
export const metadata = {
  metadataBase: new URL('https://www.brainbufferofficial.com'),
  
  // ✅ Proper Canonical Handling for Next.js 14
  alternates: {
    canonical: '/',
  },

  // ✅ GOOGLE VERIFICATION
  verification: {
    google: 'm9GIv5f_ycGxI0AIUwyad2TRbG42ouIXysEBkR_vIdA',
  },

  title: {
    default: 'BrainBuffer | Earn Real Money Memory Game by Glacia Labs',
    template: '%s | BrainBuffer Arena',
  },
  
  icons: {
    icon: [
      { url: '/favicon.ico' }, // Standard Shortcut Icon
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' }, // Critical for Google Search visibility
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  
  description: 'The #1 competitive memory game to earn real cash. Master your cognitive speed, win ranked matches, and withdraw earnings instantly via Bank or Easypaisa. Powered by Glacia Labs.',
  
  keywords: [
    'Brain Buffer',
    'memory game',
    'earning games 2026', 
    'earn money online Pakistan', 
    'real cash memory game', 
    'brain training for money', 
    'multiplayer memory arena', 
    'BrainBuffer APK download',
    'play to earn games'
  ],

  authors: [{ name: 'Muhammad Yasir', url: 'https://www.brainbufferofficial.com' }],
  creator: 'Muhammad Yasir',
  publisher: 'Glacia Labs',
  applicationName: 'BrainBuffer',

  openGraph: {
    title: 'BrainBuffer - Play, Compete, and Earn Real Cash!',
    description: 'Master your memory. Battle players worldwide and withdraw your winnings instantly.',
    url: 'https://www.brainbufferofficial.com',
    siteName: 'BrainBuffer Arena',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'BrainBuffer Gameplay & Earning Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'BrainBuffer | The Ultimate Earning Memory Game',
    description: 'Can you beat the high score? Win matches and earn real rewards.',
    images: ['/og-image.jpg'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* NOTE: We removed the manual <head> canonical link. 
          Next.js now handles this via the 'alternates' metadata above 
          to avoid duplicate tag issues.
      */}
      <body className={`${inter.className} antialiased`}>
       <MaintenanceGuard>
        <UpdateGuard>
          {children}
        </UpdateGuard>
        </MaintenanceGuard>
      </body>
    </html>
  );
}