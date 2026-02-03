"use client";
import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { toast } from 'react-hot-toast';
import Leaderboard from './Leaderboard';
import RecentMatches from './RecentMatches';
import FriendSidebar from './FriendSidebar';
import LobbyListener from '../LobbyListener';
import SupportModal from './SupportModal';
import { useNetworkCheck } from '../../hooks/useNetworkCheck'; 

import { Target, Play, Zap, Crown, Trophy, X, DollarSign, UserCheck, Smartphone, Hash, Banknote, CheckCircle2, Wallet, Lock, Loader2, LifeBuoy, Wifi } from 'lucide-react';

export default function DashboardPage({ user, onStartGame, onStartOffline, onLogout, onJoinChallenge }) {
  const [stats, setStats] = useState({ top_players: [], global_stats: { total_pool: 0 } });
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  // Form States
  const [depositData, setDepositData] = useState({ amount: "", fullName: "", senderNumber: "", trxId: "" });
  const [withdrawData, setWithdrawData] = useState({ amount: "", method: "Easypaisa", accountNumber: "", accountName: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // 📡 Network Check
  // ✅ FIX: Added measureStability to the destructuring here
  const { checkPing, latency, measureStability } = useNetworkCheck();
  const [isCheckingNet, setIsCheckingNet] = useState(false);

  // User State
  const [localUser, setLocalUser] = useState(user);

  useEffect(() => {
    fetchStats();
    checkPing(); 
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [checkPing]); 

  useEffect(() => {
    if (user) {
      setLocalUser(user);
    }
  }, [user]);

  const currentBalance = localUser?.wallet_balance || 0;
  const canPlayRanked = currentBalance >= 50;

  // 🎨 HELPER: Get Color based on Ping
  const getPingColor = () => {
    if (!latency) return "text-slate-300"; // No data yet
    if (latency < 150) return "text-emerald-500"; // Excellent
    if (latency < 300) return "text-amber-500";   // Okay
    return "text-red-500";                        // Bad
  };

  const getPingText = () => {
     if (!latency) return "Checking...";
     return `${latency}ms`;
  };

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

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLocalUser(data);
      }
    } catch (err) { console.error(err); }
  };

  // ✅ UPDATED: Strict Stability Check Logic
  const handleRankedSearch = async () => {
    if (!canPlayRanked) {
        toast.error("Insufficient balance! You need 50 PKR to play.", { icon: '💰' });
        return;
    }
    
    // 1. Start Analysis (Stress Test)
    setIsCheckingNet(true);
    
    // 🛡️ This runs the 5-sample stress test
    const result = await measureStability(); 
    
    setIsCheckingNet(false);

    // 2. Decide Flow based on Stress Test
    if (result.passed) {
        // toast.success(`Connection Stable (${result.avg}ms). Entering Queue...`, { icon: '🚀' });
        onStartGame(); 
    } else {
        // Show specific error based on why it failed
        if (result.spikes > 0) {
            toast.error(`Network Unstable! Detected ${result.spikes} lag spikes.`, { icon: '📉' });
        } else {
            toast.error(`High Latency (Avg ${result.avg}ms). Too slow for Ranked.`, { icon: '🐌' });
        }
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositData.amount || Number(depositData.amount) <= 0) return alert("Please enter a valid amount");
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/deposit/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
    } catch (err) { alert("Backend error."); } finally { setIsSubmitting(false); }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const withdrawAmount = Number(withdrawData.amount);
    if (withdrawAmount <= 0) return alert("Invalid amount");
    if (withdrawAmount > currentBalance) return alert("Insufficient balance");
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          amount: withdrawAmount, 
          method: withdrawData.method, 
          account_number: withdrawData.accountNumber, 
          account_name: withdrawData.accountName 
        })
      });
      if (res.ok) {
        alert("Withdrawal request sent!");
        setShowWithdrawModal(false);
        refreshUser();
      } else { alert("Withdrawal failed."); }
    } catch (err) { alert("Error connecting to server"); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 p-4 md:p-8 relative">
      <LobbyListener onJoinChallenge={onJoinChallenge} />

      <FriendSidebar 
        isOpen={showFriends} 
        onClose={() => setShowFriends(false)} 
        currentUser={localUser}
        onRequestCountChange={(count) => setRequestCount(count)}
      />

      {showSuccessToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in fade-in w-[90%] max-w-sm">
          <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
          <p className="text-xs font-black uppercase tracking-tight">Deposit submitted!</p>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <Navbar 
          user={localUser} 
          onDeposit={() => setShowDepositModal(true)} 
          onWithdraw={() => setShowWithdrawModal(true)} 
          onLogout={onLogout}
          onOpenFriends={() => setShowFriends(true)}
          requestCount={requestCount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-green-900/5">
              
              {/* ✅ HEADER WITH PING INDICATOR */}
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3">
                   <Target className="text-green-500" size={20} />
                   <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Battle Selection</h2>
                 </div>
                 
                 
              </div>
              
              <button 
                onClick={handleRankedSearch} 
                disabled={!canPlayRanked || isCheckingNet}
                className={`w-full group relative overflow-hidden p-6 rounded-3xl transition-all shadow-lg 
                  ${canPlayRanked && !isCheckingNet
                    ? "bg-gradient-to-r from-green-400 to-emerald-400 hover:scale-[1.02] active:scale-95" 
                    : "bg-slate-100 cursor-not-allowed opacity-70 border border-slate-200"
                  }
                `}
              >
                <div className="relative z-10 flex flex-col items-center gap-3">
                  {isCheckingNet ? (
                    <Loader2 className="animate-spin text-slate-400" size={32} />
                  ) : (
                    canPlayRanked ? <Play className="fill-white text-white" size={32} /> : <Lock size={32} className="text-slate-400"/>
                  )}
                  
                  <div className="text-center">
                    <span className={`block text-xl font-black uppercase tracking-tighter ${canPlayRanked && !isCheckingNet ? "text-white" : "text-slate-400"}`}>
                        {isCheckingNet ? "Checking Network..." : (canPlayRanked ? "Ranked Match" : "Locked")}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${canPlayRanked && !isCheckingNet ? "text-white opacity-90" : "text-slate-400"}`}>
                        {isCheckingNet ? "Testing Stability..." : "Entry 50 PKR"}
                    </span>
                  </div>
                </div>
              </button>

              <button onClick={onStartOffline} disabled={isCheckingNet} className="w-full bg-white hover:bg-slate-50 border border-slate-100 p-6 rounded-3xl transition-all flex items-center justify-between group shadow-sm disabled:opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-400"><Zap size={24} /></div>
                  <div className="text-left">
                    <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">Practice Arena</span>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">No stakes</span>
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

            <RecentMatches matches={localUser?.recent_matches || []} />
          </div>

          <div className="lg:col-span-8">
            <Leaderboard players={stats.top_players} loading={loading} />
          </div>
        </div>
      </div>

      {/* --- MODALS (Unchanged) --- */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <button onClick={() => setShowDepositModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400"><X size={20} /></button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center"><Banknote size={24} /></div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Deposit</h2>
            </div>
            <div className="bg-slate-900 text-white p-5 rounded-3xl mb-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Bank Al Habib</p>
              <p className="text-lg font-black tracking-widest break-all">02910048003531010</p>
              <p className="text-[10px] font-black text-emerald-500 uppercase mt-1">Muhammad Yasir</p>
            </div>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="number" min="1" required placeholder="Amount" value={depositData.amount} onChange={(e) => setDepositData({...depositData, amount: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none" />
              </div>
              <div className="relative">
                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" required placeholder="Account Name" value={depositData.fullName} onChange={(e) => setDepositData({...depositData, fullName: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none" />
              </div>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" required placeholder="Phone Number" value={depositData.senderNumber} onChange={(e) => setDepositData({...depositData, senderNumber: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-400 outline-none" />
              </div>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" required placeholder="TRX ID" value={depositData.trxId} onChange={(e) => setDepositData({...depositData, trxId: e.target.value})} className="w-full bg-slate-50 border-none pl-12 p-4 rounded-2xl text-sm font-black focus:ring-2 focus:ring-emerald-400 outline-none" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all">{isSubmitting ? "Submitting..." : "Confirm Deposit"}</button>
            </form>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
            <button onClick={() => setShowWithdrawModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500"><X size={20} /></button>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Withdrawal</h2>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <input type="number" min="1" required placeholder="Amount (PKR)" value={withdrawData.amount} onChange={(e) => setWithdrawData({...withdrawData, amount: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none" />
              <div className="grid grid-cols-2 gap-4">
                {["Easypaisa", "JazzCash"].map((m) => (
                  <button key={m} type="button" onClick={() => setWithdrawData({...withdrawData, method: m})} className={`p-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${withdrawData.method === m ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-50 text-slate-300"}`}>{m}</button>
                ))}
              </div>
              <input type="text" required placeholder="Account Number" value={withdrawData.accountNumber} onChange={(e) => setWithdrawData({...withdrawData, accountNumber: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none" />
              <input type="text" required placeholder="Account Title" value={withdrawData.accountName} onChange={(e) => setWithdrawData({...withdrawData, accountName: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none" />
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all">{isSubmitting ? "Processing..." : "Confirm Withdrawal"}</button>
            </form>
          </div>
        </div>
      )}

      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
      
      <button 
        onClick={() => setShowSupport(true)}
        className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-[90] group"
      >
        <LifeBuoy size={24} className="group-hover:animate-spin" />
      </button>

    </div>
  );
}