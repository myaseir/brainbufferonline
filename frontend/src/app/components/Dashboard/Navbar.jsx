"use client";
import { User, PlusCircle, ArrowUpRight, LogOut } from 'lucide-react';

export default function Navbar({ user, onDeposit, onWithdraw, onLogout }) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/80 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-lg shadow-green-900/5">
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-tr from-green-400 to-emerald-300 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
            <User size={32} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-4 border-white rounded-full"></div>
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{user?.username || 'Commander'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-green-100">Rank: Elite</span>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">• Pakistan Server</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end px-6 border-r border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Wallet Balance</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{user?.wallet_balance || 0}</span>
            <span className="text-xs font-bold text-green-500 uppercase mr-4">PKR</span>
            <div className="flex gap-2">
              <button onClick={onDeposit} className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-emerald-600 transition-all active:scale-95">
                <PlusCircle size={14}/> Deposit
              </button>
              <button onClick={onWithdraw} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-slate-700 transition-all active:scale-95">
                <ArrowUpRight size={14}/> Withdrawal
              </button>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="p-4 bg-slate-50 hover:bg-red-50 hover:text-red-500 border border-slate-100 rounded-2xl transition-all shadow-sm">
          <LogOut size={24} />
        </button>
      </div>
    </header>
  );
}