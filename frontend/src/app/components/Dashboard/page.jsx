"use client";
import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Leaderboard from './Leaderboard';
import RecentMatches from './RecentMatches';
import { Target, Play, Zap, Crown, Trophy, X, DollarSign, UserCheck, Smartphone, Hash, Banknote, CheckCircle2, Wallet } from 'lucide-react';

export default function DashboardPage({ user, onStartGame, onStartOffline, onLogout }) {
  const [stats, setStats] = useState({ top_players: [], global_stats: { total_pool: 0 } });
  const [loading, setLoading] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Form States
  const [depositData, setDepositData] = useState({ amount: "", fullName: "", senderNumber: "", trxId: "" });
  const [withdrawData, setWithdrawData] = useState({ amount: "", method: "Easypaisa", accountNumber: "", accountName: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leaderboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

const handleDeposit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      // 🔄 TRYING THE BRIDGE PATH (Matches main.py sequential priority)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/deposit/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          full_name: depositData.fullName,
          sender_number: depositData.senderNumber,
          amount: Number(depositData.amount),
          trx_id: depositData.trxId.trim()
        })
      });

      if (res.ok) {
        setShowSuccessToast(true);
        setShowDepositModal(false);
        setDepositData({ amount: "", fullName: "", senderNumber: "", trxId: "" });
        setTimeout(() => setShowSuccessToast(false), 5000);
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Submission failed. Please check your TRX ID.");
      }
    } catch (err) { 
      alert("Backend is not responding. Check your connection."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

 const handleWithdraw = async (e) => {
    e.preventDefault();
    
    // Safety check: ensure user object exists before checking balance
    const currentBalance = user?.wallet_balance || 0;
    
    if (Number(withdrawData.amount) > currentBalance) {
        return alert(`Insufficient balance! You only have ${currentBalance} PKR.`);
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      // ✅ FIXED URL: Added "/wallet" to match main.py prefix
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          amount: Number(withdrawData.amount), 
          method: withdrawData.method, 
          account_number: withdrawData.accountNumber, 
          account_name: withdrawData.accountName 
        })
      });

      if (res.ok) {
        alert("Withdrawal request sent!");
        setShowWithdrawModal(false);
        window.location.reload(); 
      } else { 
        const errorData = await res.json();
        alert(errorData.detail || "Withdrawal failed."); 
      }
    } catch (err) { 
      alert("Error connecting to server"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 p-4 md:p-8 relative">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <p className="text-xs font-black uppercase tracking-tight">Deposit submitted for verification!</p>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <Navbar 
          user={user} 
          onDeposit={() => setShowDepositModal(true)} 
          onWithdraw={() => setShowWithdrawModal(true)} 
          onLogout={onLogout} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-green-900/5">
              <div className="flex items-center gap-3 mb-2">
                <Target className="text-green-500" size={20} />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Battle Selection</h2>
              </div>
              <button onClick={onStartGame} className="w-full group relative overflow-hidden bg-gradient-to-r from-green-400 to-emerald-400 p-6 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-200">
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <Play className="fill-white text-white translate-x-1" size={32} />
                  <div className="text-center">
                    <span className="block text-xl font-black text-white uppercase tracking-tighter">Ranked Match</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-90">Win 90 PKR • Entry 50 PKR</span>
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

            {/* ✅ ADDED RECENT MATCHES HERE */}
            <RecentMatches matches={user?.recent_matches} />
          </div>

          <div className="lg:col-span-8">
            <Leaderboard players={stats.top_players} loading={loading} />
          </div>
        </div>
      </div>

      {/* --- DEPOSIT MODAL --- */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
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
              <div className="relative"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="number" required placeholder="Amount" value={depositData.amount} onChange={(e) => setDepositData({...depositData, amount: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none" /></div>
              <div className="relative"><UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" required placeholder="Your Account Name" value={depositData.fullName} onChange={(e) => setDepositData({...depositData, fullName: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none" /></div>
              <div className="relative"><Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" required placeholder="Your Phone Number" value={depositData.senderNumber} onChange={(e) => setDepositData({...depositData, senderNumber: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none" /></div>
              <div className="relative"><Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" required placeholder="TRX ID" value={depositData.trxId} onChange={(e) => setDepositData({...depositData, trxId: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-black focus:ring-2 focus:ring-emerald-400 outline-none" /></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100">{isSubmitting ? "Submitting..." : "Confirm Deposit"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ✅ ADDED WITHDRAWAL MODAL --- */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
            <button onClick={() => setShowWithdrawModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Withdrawal</h2>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <input type="number" required placeholder="Amount (PKR)" value={withdrawData.amount} onChange={(e) => setWithdrawData({...withdrawData, amount: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none" />
              <div className="grid grid-cols-2 gap-4">
                {["Easypaisa", "JazzCash"].map((m) => (
                  <button key={m} type="button" onClick={() => setWithdrawData({...withdrawData, method: m})} className={`p-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${withdrawData.method === m ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-50 text-slate-300"}`}>{m}</button>
                ))}
              </div>
              <input type="text" required placeholder="Account Number" value={withdrawData.accountNumber} onChange={(e) => setWithdrawData({...withdrawData, accountNumber: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none" />
              <input type="text" required placeholder="Account Title" value={withdrawData.accountName} onChange={(e) => setWithdrawData({...withdrawData, accountName: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none" />
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-xl shadow-slate-200">{isSubmitting ? "Processing..." : "Confirm Withdrawal"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}