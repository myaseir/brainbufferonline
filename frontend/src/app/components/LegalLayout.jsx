"use client";
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LegalLayout({ title = "", children }) {
  // Split title safely to handle single or multi-word titles
  const titleParts = title.split(' ');
  const firstWord = titleParts[0];
  const remainingWords = titleParts.slice(1).join(' ');

  return (
    <div className="min-h-screen bg-[#fcfdfd] font-sans text-slate-800 p-6 md:p-12 relative overflow-x-hidden">
      {/* Background Decorative Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-5%] right-[-5%] w-[60%] h-[60%] bg-green-100/30 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[60%] h-[60%] bg-emerald-50/20 blur-[100px] rounded-full"></div>
      </div>

      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-green-500 transition-colors mb-12 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Arena</span>
        </Link>

        <header className="mb-16">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 uppercase mb-4">
            {firstWord}<span className="text-green-500"> {remainingWords}</span>
          </h1>
          <div className="w-20 h-1 bg-green-500 rounded-full"></div>
        </header>

        {/* Legal Content Area */}
        <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-strong:text-slate-800">
          {children}
        </div>

        {/* FIXED FOOTER TAGS BELOW */}
        <footer className="mt-24 pt-12 border-t border-slate-100 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300">
            Official Policy • Glacia Connection 2026
          </p>
        </footer>
      </div>
    </div>
  );
}