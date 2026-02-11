"use client";
import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Clock, Wallet, Loader2 } from 'lucide-react';

const TransactionSidebar = ({ isOpen, onClose, transactions = [], loading }) => {
  const [activeTab, setActiveTab] = useState('deposits');

  // Filter logic - ensure we match the backend types exactly
  const deposits = transactions.filter(t => t.type === 'DEPOSIT');
  const withdrawals = transactions.filter(t => t.type === 'WITHDRAWAL');

  const getStatusStyle = (status) => {
    switch (status) {
      case 'PENDING': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'COMPLETED': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
      case 'REJECTED': return 'text-red-500 bg-red-50 border-red-100'; // 🔴 This handles rejected ones
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity" onClick={onClose} />
      )}

      {/* Sidebar Panel */}
      <aside className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[70] flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Fixed Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Wallet size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Finances</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Fixed Tab Switcher */}
        <div className="p-4 shrink-0">
          <div className="flex p-1.5 bg-slate-50 rounded-xl border border-slate-100">
            <button 
              onClick={() => setActiveTab('deposits')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'deposits' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              <ArrowDownLeft size={14} /> Deposits
            </button>
            <button 
              onClick={() => setActiveTab('withdrawals')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'withdrawals' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
            >
              <ArrowUpRight size={14} /> Withdrawals
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing Records...</p>
            </div>
          ) : (activeTab === 'deposits' ? deposits : withdrawals).length === 0 ? (
            <div className="py-20 text-center space-y-3">
               <div className="inline-flex p-4 bg-slate-50 rounded-full text-slate-300">
                 <Clock size={32} />
               </div>
               <p className="text-slate-400 text-sm font-medium">No {activeTab} history found</p>
            </div>
          ) : (
            (activeTab === 'deposits' ? deposits : withdrawals).map((tx, idx) => {
              const txDate = tx.created_at ? new Date(tx.created_at) : null;
              
              return (
                <div key={idx} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-indigo-100 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 tabular-nums">
                        {Number(tx.amount).toLocaleString()} <span className="text-[10px] text-slate-400">PKR</span>
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                        {txDate && !isNaN(txDate) ? (
                          `${txDate.toLocaleDateString()} • ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ) : 'Date Processing'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-md border text-[9px] font-black tracking-tighter uppercase ${getStatusStyle(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                    <span className="text-slate-400 font-bold uppercase tracking-tighter">
                      {tx.type === 'DEPOSIT' ? 'Trx ID' : 'Account'}
                    </span>
                    <span className="text-slate-700 font-mono font-medium truncate max-w-[140px]">
                      {tx.trx_id || tx.account_number || 'N/A'}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          
          {/* Bottom Limit Indicator */}
          {!loading && (activeTab === 'deposits' ? deposits : withdrawals).length > 0 && (
            <p className="text-center text-[8px] font-bold text-slate-300 uppercase tracking-widest pt-4">
              End of recent history
            </p>
          )}
        </div>
      </aside>
    </>
  );
};

export default TransactionSidebar;