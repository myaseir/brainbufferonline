"use client";
import React, { useEffect, useState } from 'react';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { APP_VERSION } from '../core/constants';

export default function UpdateGuard({ children }) {
  const [status, setStatus] = useState({ loading: true, mustUpdate: false, data: null });

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system/version-check?v=${APP_VERSION}`);
        const data = await res.json();
        
        setStatus({
          loading: false,
          mustUpdate: data.must_update,
          data: data
        });
      } catch (err) {
        console.error("Version check failed", err);
        setStatus({ loading: false, mustUpdate: false, data: null });
      }
    };
    checkVersion();
  }, []);

  if (status.loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 z-[9999]">
        <Loader2 className="text-cyan-500 animate-spin" size={40} />
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Verifying Core Files...</p>
      </div>
    );
  }

  if (status.mustUpdate) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-8 text-center font-sans">
        <div className="max-w-sm space-y-8">
          <div className="relative inline-flex">
             <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 animate-pulse"></div>
             <div className="relative w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center border border-amber-500/20">
                <AlertCircle size={40} />
             </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Update Required</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              You are using an old version of <strong>BrainBuffer</strong>. To ensure your wallet balance remains safe and the game stays fair, an update is required.
            </p>
          </div>

          <button 
            onClick={() => window.open(status.data?.download_url, '_blank')}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
          >
            <Download size={20} strokeWidth={3} />
            DOWNLOAD NOW
          </button>

          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            v{APP_VERSION} → v{status.data?.latest_version}
          </p>
        </div>
      </div>
    );
  }

  return children;
}