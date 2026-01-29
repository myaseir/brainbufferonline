import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'BrainBuffer | Visual Memory Training',
  description: 'Boost your cognitive speed with BrainBuffer. Memorize floating numbers, challenge your short-term recall, and compete for the high score in this fast-paced brain training game.',
  keywords: ['memory game', 'brain training', 'cognitive test', 'visual memory', 'puzzle game', 'mind game'],
  authors: [{ name: 'Muhammad Yasir' }], 
  applicationName: 'BrainBuffer',
  openGraph: {
    title: 'BrainBuffer - Can you beat the high score?',
    description: 'Test your short-term memory speed. Memorize the bubbles before they vanish!',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // ✅ Good: Prevents annoying zoom on mobile inputs
  themeColor: '#3b82f6', // ✅ Better: Match your "Buffer" blue
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* REMOVED bg-white and text-slate-800. 
          The styles in your globals.css and individual components will now work. 
      */}
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}