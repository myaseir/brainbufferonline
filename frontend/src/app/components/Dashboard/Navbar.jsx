"use client";
import { useEffect } from 'react';
import { User, PlusCircle, ArrowUpRight, LogOut, Users, Wifi } from 'lucide-react';
import { useNetworkCheck } from '../../hooks/useNetworkCheck'; // 🔌 Import Hook

export default function Navbar({ user, onDeposit, onWithdraw, onLogout, onOpenFriends, requestCount }) {
  // 1. Get Network Latency
  const { checkPing, latency } = useNetworkCheck();

  // 2. Check ping when Navbar mounts
  useEffect(() => {
    checkPing(); // Check immediately on load

    const interval = setInterval(() => {
        checkPing(); 
    }, 1000); // <--- 10,000ms = 10 Seconds

    return () => clearInterval(interval); // Cleanup when user leaves
  }, [checkPing]);

  // 3. Color Logic
  const getPingColor = () => {
    if (!latency) return "text-slate-400";
    if (latency < 150) return "text-emerald-500"; // Good
    if (latency < 300) return "text-amber-500";   // Okay
    return "text-red-500";                        // Bad
  };

  return (
    <header className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 bg-white/80 backdrop-blur-xl border border-white p-4 md:p-6 rounded-3xl shadow-lg shadow-green-900/5 overflow-hidden">
      
      {/* 1. User Profile Section */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
        <div className="relative shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-tr from-green-400 to-emerald-300 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
            <User size={28} className="md:w-8 md:h-8" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-green-400 border-4 border-white rounded-full"></div>
        </div>
        <div className="text-left">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase truncate">
            {user?.username || 'Commander'}
          </h1>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-green-100 shrink-0">Rank: Elite</span>
            
            {/* 📡 NEW: Live Wifi Ping Indicator */}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-100 ${getPingColor()}`}>
               <Wifi size={10} strokeWidth={3} />
               <span className="text-[10px] font-bold uppercase tracking-wider">
                 {latency ? `${latency}ms` : '...'}
               </span>
            </div>

            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest truncate hidden md:block">• PK Server</span>
          </div>
        </div>
      </div>

      {/* Wrapper for Wallet & Actions */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
        
        {/* 2. Wallet Balance */}
        <div className="flex flex-col items-center md:items-end px-0 md:px-6 md:border-r border-slate-100 w-full md:w-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Wallet Balance</span>
          <div className="flex items-center gap-1">
            <span className="text-3xl md:text-2xl font-black text-slate-900 tabular-nums">{user?.wallet_balance || 0}</span>
            <span className="text-sm md:text-xs font-bold text-green-500 uppercase">PKR</span>
          </div>
        </div>

        {/* 3. Action Buttons */}
        <div className="flex items-center justify-center gap-2 w-full md:w-auto">
          <button 
            onClick={onDeposit} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-3 md:py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-emerald-600 transition-all active:scale-95 whitespace-nowrap"
          >
            <PlusCircle size={14}/> Deposit
          </button>
          
          <button 
            onClick={onWithdraw} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 md:py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-slate-700 transition-all active:scale-95 whitespace-nowrap"
          >
            <ArrowUpRight size={14}/> Withdraw
          </button>

          {/* Friends Button */}
          <button 
            onClick={onOpenFriends} 
            className="p-3 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-500 border border-slate-100 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 group relative"
            title="Friends"
          >
            <Users size={20} />
            {requestCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
                {requestCount}
              </div>
            )}
          </button>

          <button 
            onClick={onLogout} 
            className="p-3 bg-slate-50 hover:bg-red-50 hover:text-red-500 border border-slate-100 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}