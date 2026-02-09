"use client";
import React, { useEffect, useState } from 'react';
import { Hammer, Loader2, RefreshCcw } from 'lucide-react';

export default function MaintenanceGuard({ children }) {
  const [status, setStatus] = useState({ loading: true, isMaintenance: false, data: null });

  const checkStatus = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system/status`);
      const data = await res.json();
      
      setStatus({
        loading: false,
        isMaintenance: data.maintenance,
        data: data
      });
    } catch (err) {
      console.error("Status check failed", err);
      setStatus({ loading: false, isMaintenance: false, data: null });
    }
  };

  useEffect(() => {
    checkStatus();
    // Optional: Poll every 60 seconds to see if maintenance is over
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (status.loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 z-[9999]">
        <Loader2 className="text-cyan-500 animate-spin" size={40} />
      </div>
    );
  }

  if (status.isMaintenance) {
    return (
      <div className="fixed inset-0 z-[10000] bg-slate-950 flex items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-8">
          <div className="relative inline-flex">
             <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20 animate-pulse"></div>
             <div className="relative w-20 h-20 bg-cyan-500/10 text-cyan-500 rounded-3xl flex items-center justify-center border border-cyan-500/20">
                <Hammer size={40} />
             </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">System Maintenance</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              {status.data?.message || "We are currently optimizing our servers for better performance."}
            </p>
            <div className="inline-block px-4 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] text-cyan-500 font-bold uppercase tracking-widest">
                ETA: {status.data?.estimated_time || "Soon"}
            </div>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl border border-slate-700 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <RefreshCcw size={18} />
            CHECK AGAIN
          </button>
        </div>
      </div>
    );
  }

  return children;
}