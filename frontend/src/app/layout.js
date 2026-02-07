import { Inter } from 'next/font/google';
import './globals.css';
import UpdateGuard from './components/UpdateGuard';

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
  
  // ✅ GOOGLE VERIFICATION ADDED HERE
  verification: {
    google: 'm9GIv5f_ycGxI0AIUwyad2TRbG42ouIXysEBkR_vIdA',
  },

  title: {
    default: 'BrainBuffer | Earn Real Money Memory Game & Brain Training',
    template: '%s | BrainBuffer Arena',
  },
  
  description: 'The #1 competitive memory game to earn real cash. Train your cognitive speed, win ranked matches, and withdraw earnings instantly via Bank or Easypaisa.',
  
  keywords: [
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
      <head>
        <link rel="canonical" href="https://www.brainbufferofficial.com" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <UpdateGuard>
          {children}
        </UpdateGuard>
      </body>
    </html>
  );
}