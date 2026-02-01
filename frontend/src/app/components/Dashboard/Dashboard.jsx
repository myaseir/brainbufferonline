"use client";
import { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, Wallet, Play, LogOut, TrendingUp, History, 
  User, Zap, Target, Crown, Clock, ArrowUpRight, X, 
  PlusCircle, CheckCircle2, Smartphone, Hash, UserCheck, Banknote, DollarSign, Lock 
} from 'lucide-react';

export default function Dashboard({ user, onStartGame, onStartOffline, onLogout }) {
  const [stats, setStats] = useState({ top_players: [], global_stats: { total_pool: 0 } });
  const [loading, setLoading] = useState(true);
  
  // 🚀 FIX: State Sync Problem - Maintain local user state for instant UI updates
  const [localUser, setLocalUser] = useState(user);

  // --- 🔔 UI & MODAL STATES ---
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // --- 💸 FORM STATES ---
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [method, setMethod] = useState("Easypaisa");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [fullName, setFullName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🚀 FIX: Code Cleanup - Replace reload with smooth state refresh
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return onLogout();

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const freshData = await res.json();
        setLocalUser(freshData);
      } else if (res.status === 401) {
        onLogout();
      }
    } catch (err) {
      console.error("User refresh failed", err);
    }
  }, [onLogout]);

 // 1. Sync local user data ONLY when the user object changes
useEffect(() => {
  if (user) {
    setLocalUser(user);
  }
}, [user]); 

// 2. Fetch Leaderboard stats ONLY once when the dashboard loads
useEffect(() => {
  const fetchStats = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leaderboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) { 
      console.error("Leaderboard fetch failed", err); 
    } finally { 
      setLoading(false); 
    }
  };

  fetchStats();

  // OPTIONAL: Refresh stats every 60 seconds to keep it live without spamming
  const interval = setInterval(fetchStats, 60000); 
  return () => clearInterval(interval);
  
}, []); // 👈 IMPORTANT: Empty array [] means this runs ONCE on mount

  // 🚀 FIX: Missing "Insufficient Funds" Protection Logic
  const canPlayRanked = (localUser?.wallet_balance || 0) >= 50;

  const handleDeposit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return onLogout();

    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/deposit/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          full_name: fullName, 
          sender_number: senderNumber, 
          amount: Number(depositAmount),
          trx_id: trxId.trim()
        })
      });

      if (res.ok) {
        setToastMessage("Deposit submitted! Awaiting Admin verification.");
        setShowSuccessToast(true);
        setShowDepositModal(false);
        setDepositAmount(""); setTrxId(""); setFullName(""); setSenderNumber("");
        setTimeout(() => setShowSuccessToast(false), 5000);
      } else { 
        const errorData = await res.json();
        alert(errorData.detail || "Submission failed. Check TRX ID."); 
      }
    } catch (err) { alert("Error connecting to server"); }
    finally { setIsSubmitting(false); }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return onLogout();

    if (Number(withdrawAmount) > localUser.wallet_balance) return alert("Insufficient balance!");
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          amount: Number(withdrawAmount), 
          method, 
          account_number: accountNumber, 
          account_name: accountName 
        })
      });
      if (res.ok) {
        alert("Withdrawal request sent!");
        setShowWithdrawModal(false);
        // 🚀 FIX: Refresh instead of reload
        await refreshUser();
      } else { 
        const errorData = await res.json();
        alert(errorData.detail || "Withdrawal failed."); 
      }
    } catch (err) { alert("Error connecting to server"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 p-4 md:p-8 font-sans selection:bg-green-100">
      
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <p className="text-xs font-black uppercase tracking-tight">{toastMessage}</p>
        </div>
      )}

      {/* Decorative Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-green-100/50 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-emerald-50/50 blur-[100px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/80 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-lg shadow-green-900/5">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-tr from-green-400 to-emerald-300 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                <User size={32} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-4 border-white rounded-full"></div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{localUser?.username || 'Commander'}</h1>
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
                <span className="text-2xl font-black text-slate-900 tabular-nums">{localUser?.wallet_balance || 0}</span>
                <span className="text-xs font-bold text-green-500 uppercase mr-4">PKR</span>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowDepositModal(true)} 
                    className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-emerald-600 transition-all active:scale-95"
                  >
                    <PlusCircle size={14}/> Deposit
                  </button>
                  <button 
                    onClick={() => setShowWithdrawModal(true)} 
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-slate-700 transition-all active:scale-95"
                  >
                    <ArrowUpRight size={14}/> Withdrawal
                  </button>
                </div>
              </div>
            </div>
            <button onClick={onLogout} className="p-4 bg-slate-50 hover:bg-red-50 hover:text-red-500 border border-slate-100 rounded-2xl transition-all shadow-sm"><LogOut size={24} /></button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-green-900/5">
              <div className="flex items-center gap-3 mb-2">
                <Target className="text-green-500" size={20} />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Battle Selection</h2>
              </div>

              {/* 🚀 FIX: Missing "Insufficient Funds" Protection UI */}
              <button 
                onClick={canPlayRanked ? onStartGame : () => setShowDepositModal(true)} 
                className={`w-full group relative overflow-hidden p-6 rounded-3xl transition-all shadow-lg 
                  ${canPlayRanked 
                    ? "bg-gradient-to-r from-green-400 to-emerald-400 hover:scale-[1.02] active:scale-95 shadow-emerald-200" 
                    : "bg-slate-100 grayscale cursor-pointer hover:bg-slate-200 shadow-none"
                  }`}
              >
                <div className="relative z-10 flex flex-col items-center gap-3">
                  {canPlayRanked ? (
                    <Play className="fill-white text-white translate-x-1" size={32} />
                  ) : (
                    <Lock className="text-slate-500" size={32} />
                  )}
                  <div className="text-center">
                    <span className={`block text-xl font-black uppercase tracking-tighter ${canPlayRanked ? 'text-white' : 'text-slate-600'}`}>
                      {canPlayRanked ? "Ranked Match" : "Top Up Wallet"}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${canPlayRanked ? 'text-white opacity-90' : 'text-slate-500'}`}>
                      {canPlayRanked ? "Win 90 PKR • Entry 50 PKR" : "Insufficient Funds to Play"}
                    </span>
                  </div>
                </div>
              </button>

              <button onClick={onStartOffline} className="w-full bg-white hover:bg-slate-50 border border-slate-100 p-6 rounded-3xl transition-all flex items-center justify-between group shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-400 group-hover:text-green-600 transition-colors"><Zap size={24} /></div>
                  <div className="text-left">
                    <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">Practice Arena</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No stakes • Training</span>
                  </div>
                </div>
              </button>
            </div>

            <div className="relative group overflow-hidden bg-white border border-white rounded-[2.5rem] p-8 shadow-xl shadow-green-900/5">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="text-amber-400" size={18} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Economy</span>
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                  {stats.global_stats?.total_pool || 0}<span className="text-lg text-slate-300 ml-2 font-bold">PKR</span>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12 text-slate-900"><Trophy size={160} /></div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-green-900/5">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-green-50/20">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-green-500" size={24} />
                  <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900">Top Tier Command</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Updates</span>
              </div>
              <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {!loading && stats.top_players.map((player, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-50`}>
                    <div className="flex items-center gap-6">
                      <span className={`text-xl font-black w-8 ${idx === 0 ? 'text-green-500' : 'text-slate-100'}`}>{idx + 1}</span>
                      <p className="font-bold text-slate-800 uppercase text-sm">{player.username}</p>
                    </div>
                    <span className="text-sm font-black text-slate-900">{player.wallet_balance} PKR</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- DEPOSIT MODAL --- */}
        {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
              <button onClick={() => setShowDepositModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center"><Banknote size={24} /></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Deposit</h2>
              </div>
              <div className="bg-slate-900 text-white p-5 rounded-3xl mb-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Bank Al Habib</p>
                <p className="text-lg font-black tracking-widest">02910048003531010</p>
                <p className="text-[10px] font-black text-emerald-500 uppercase mt-1">Muhammad Yasir</p>
              </div>
              <form onSubmit={handleDeposit} className="space-y-4">
                <div className="relative"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="number" required placeholder="Amount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400" /></div>
                <div className="relative"><UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" required placeholder="Your Account Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400" /></div>
                <div className="relative"><Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" required placeholder="Your Phone Number" value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400" /></div>
                <div className="relative"><Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" required placeholder="TRX ID" value={trxId} onChange={(e) => setTrxId(e.target.value)} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-black focus:ring-2 focus:ring-emerald-400" /></div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all">{isSubmitting ? "Submitting..." : "Confirm Deposit"}</button>
              </form>
            </div>
          </div>
        )}

        {/* --- WITHDRAWAL MODAL --- */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
              <button onClick={() => setShowWithdrawModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Withdrawal</h2>
              </div>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <input type="number" required placeholder="Amount (PKR)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400" />
                <div className="grid grid-cols-2 gap-4">
                  {["Easypaisa", "JazzCash"].map((m) => (
                    <button key={m} type="button" onClick={() => setMethod(m)} className={`p-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${method === m ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-50 text-slate-300"}`}>{m}</button>
                  ))}
                </div>
                <input type="text" required placeholder="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400" />
                <input type="text" required placeholder="Account Title" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400" />
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all">{isSubmitting ? "Processing..." : "Confirm Withdrawal"}</button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}