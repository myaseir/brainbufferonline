"use client";
import { useEffect, useState } from 'react';
import { User, PlusCircle, ArrowUpRight, LogOut, Users, Wifi, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useNetworkCheck } from '../../hooks/useNetworkCheck';

export default function Navbar({ user, onDeposit, onWithdraw, onLogout, onOpenFriends, requestCount, onRefresh }) {
  const { checkPing, latency } = useNetworkCheck();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkPing(); 
    const interval = setInterval(() => {
        checkPing(); 
    }, 2000); 

    return () => clearInterval(interval);
  }, [checkPing]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    // Keep spinning for at least 600ms so it looks professional
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getPingColor = () => {
    if (!latency) return "text-slate-400 border-slate-100 bg-slate-50";
    if (latency < 150) return "text-emerald-500 border-emerald-100 bg-emerald-50/50"; 
    if (latency < 200) return "text-amber-500 border-amber-100 bg-amber-50/50";   
    return "text-red-600 border-red-200 bg-red-50"; 
  };

  return (
    <header className="relative flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 bg-white/80 backdrop-blur-xl border border-white p-4 md:p-6 rounded-3xl shadow-lg shadow-green-900/5">
      
      {/* 1. User Profile Section */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
        <div className="relative shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20 overflow-hidden border border-slate-800">
  <img 
    src="/brainbufferlogo.png" 
    alt="Logo" 
    className="w-full h-full object-contain p-1.5" 
  />
</div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-green-400 border-4 border-white rounded-full"></div>
        </div>
        
        <div className="text-left relative">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase truncate">
              {user?.username || 'Commander'}
            </h1>
            
            {/* 🔥 REFRESH BUTTON */}
            <button 
              onClick={handleManualRefresh}
              className={`p-1.5 hover:bg-slate-100 rounded-full transition-all duration-500 ${isRefreshing ? 'rotate-180 text-emerald-500' : 'text-slate-400'}`}
              title="Refresh Dashboard"
            >
              <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-green-100 shrink-0">Rank: Elite</span>
            
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all duration-500 ${getPingColor()}`}>
                <Wifi size={10} strokeWidth={3} />
                <span className="text-[10px] font-bold uppercase tracking-wider tabular-nums">
                  {latency ? `${latency}ms` : '...'}
                </span>
            </div>
          </div>

          {latency > 200 && (
            <div className="absolute -bottom-5 left-0 flex items-center gap-1 animate-pulse whitespace-nowrap z-10">
              <AlertTriangle size={10} className="text-red-600" />
              <span className="text-red-600 text-[8px] font-black uppercase tracking-tighter">
                Unstable - Avoid Online Matches
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Wrapper for Wallet & Actions */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto mt-2 md:mt-0">
        <div className="flex flex-col items-center md:items-end px-0 md:px-6 md:border-r border-slate-100 w-full md:w-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Wallet Balance</span>
          <div className="flex items-center gap-1">
            <span className="text-3xl md:text-2xl font-black text-slate-900 tabular-nums">{user?.wallet_balance || 0}</span>
            <span className="text-sm md:text-xs font-bold text-green-500 uppercase">PKR</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 w-full md:w-auto">
          <button onClick={onDeposit} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-3 md:py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-emerald-600 transition-all active:scale-95 whitespace-nowrap">
            <PlusCircle size={14}/> Deposit
          </button>
          
          <button onClick={onWithdraw} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 md:py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-slate-700 transition-all active:scale-95 whitespace-nowrap">
            <ArrowUpRight size={14}/> Withdraw
          </button>

          <button onClick={onOpenFriends} className="p-3 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-500 border border-slate-100 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 group relative">
            <Users size={20} />
            {requestCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
                {requestCount}
              </div>
            )}
          </button>

          <button onClick={onLogout} className="p-3 bg-slate-50 hover:bg-red-50 hover:text-red-500 border border-slate-100 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}