import { Inter } from 'next/font/google';
import './globals.css';
import UpdateGuard from './components/UpdateGuard'; // 🚀 Import the guard

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
  userScalable: false, 
  themeColor: '#3b82f6', 
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {/* ✅ The UpdateGuard now protects all routes including Dashboard and Game */}
        <UpdateGuard>
          {children}
        </UpdateGuard>
      </body>
    </html>
  );
}