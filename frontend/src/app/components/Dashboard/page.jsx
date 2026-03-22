"use client";
import { useState, useEffect, useCallback } from 'react';
import Navbar from './Navbar';
import { toast } from 'react-hot-toast';
import Leaderboard from './Leaderboard';
import RecentMatches from './RecentMatches';
import FriendSidebar from './FriendSidebar';
import LobbyListener from '../LobbyListener';
import SupportModal from './SupportModal';
import { useNetworkCheck } from '../../hooks/useNetworkCheck'; 
import ReferralCard from './ReferralCard';
import TransactionSidebar from './TransactionSidebar'; // 👈 Add this
import { 
  Target, Play, Zap, Crown, Trophy, X, DollarSign, UserCheck, ArrowRight,
  Smartphone, Hash, Banknote, CheckCircle2, Wallet, Lock, 
  Loader2, LifeBuoy 
} from 'lucide-react';

export default function DashboardPage({ user, onStartGame, onStartOffline, onLogout, onJoinChallenge }) {
  const [stats, setStats] = useState({ top_players: [], global_stats: { total_pool: 0 } });
  const [loading, setLoading] = useState(true);
  const accountNo = "02910048003531010";
  const [copied, setCopied] = useState(false);
  // UI States
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [transactions, setTransactions] = useState([]);
const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  // Form States
  const [depositData, setDepositData] = useState({ amount: "", fullName: "", senderNumber: "", trxId: "" });
  const [withdrawData, setWithdrawData] = useState({ amount: "", method: "Easypaisa", accountNumber: "", accountName: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // 📡 Network Check
  const { checkPing, latency, measureStability } = useNetworkCheck();
  const [isCheckingNet, setIsCheckingNet] = useState(false);

  // User State
  const [localUser, setLocalUser] = useState(user);
const handleOpenHistory = async () => {
    setIsHistoryLoading(true); // Start spinning
    setShowHistory(true);      // Open sidebar
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            setTransactions(data);
        }
    } catch (err) {
        toast.error("Failed to load history");
    } finally {
        setIsHistoryLoading(false); // Stop spinning
    }
};
  // --- 🔄 REFRESH & FETCH LOGIC ---
const handleCopy = () => {
    navigator.clipboard.writeText(accountNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leaderboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) { 
      console.error("Leaderboard fetch failed", err); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("User fetch failed", err);
    }
    return null;
  }, []);

  const handleDataUpdate = async () => {
    const token = localStorage.getItem('token');
    const [updatedUser] = await Promise.all([
      fetchUserData(),
      fetchStats(),
      // 🚀 Fetch transaction history here
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => res.json()).then(data => setTransactions(data))
    ]);

    if (updatedUser) {
      setLocalUser(updatedUser);
      toast.success("Dashboard Updated");
    }
};

  useEffect(() => {
    fetchStats();
    checkPing(); 
    // Auto-refresh stats and user data every 30 seconds
    const interval = setInterval(() => {
        fetchStats();
        fetchUserData().then(data => data && setLocalUser(data));
    }, 30000);
    return () => clearInterval(interval);
  }, [checkPing, fetchStats, fetchUserData]); 

  useEffect(() => {
    if (user) {
      setLocalUser(user);
    }
  }, [user]);

  // --- ⚔️ GAMEPLAY LOGIC ---

  const currentBalance = localUser?.wallet_balance || 0;
  const canPlayRanked = currentBalance >= 100;

  const handleRankedSearch = async () => {
    if (!canPlayRanked) {
        toast.error("Insufficient balance! You need 100 PKR to play.", { icon: '💰' });
        return;
    }
    setIsCheckingNet(true);
    const result = await measureStability(); 
    setIsCheckingNet(false);

    if (result.passed) {
        onStartGame(); 
    } else {
        if (result.spikes > 0) {
            toast.error(`Network Unstable! Detected ${result.spikes} lag spikes.`, { icon: '📉' });
        } else {
            toast.error(`High Latency (Avg ${result.avg}ms). Too slow for Ranked.`, { icon: '🐌' });
        }
    }
  };

  // --- 💰 WALLET LOGIC ---

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
        alert(errorData.detail || "Submission failed.");
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
        handleDataUpdate(); // Soft refresh wallet balance
      } else { alert("Withdrawal failed."); }
    } catch (err) { alert("Error connecting to server"); } finally { setIsSubmitting(false); }
  };
useEffect(() => {
  // 🚀 Every time the user lands on the dashboard, force a balance sync
  const syncBalance = async () => {
    try {
      await fetchUserData(); // Your existing function that calls /api/auth/me
      console.log("Dashboard balance synchronized with server.");
    } catch (err) {
      console.error("Failed to sync balance:", err);
    }
  };

  syncBalance();
}, []); // Empty dependency array means it runs once every time the component mounts
  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 p-4 md:p-8 relative">
      <LobbyListener onJoinChallenge={onJoinChallenge} />
<TransactionSidebar 
  isOpen={showHistory} 
  onClose={() => setShowHistory(false)} 
  transactions={transactions} 
  loading={isHistoryLoading} // 👈 Pass the loading state
/>
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
          onOpenHistory={handleOpenHistory}
          requestCount={requestCount}
          onRefresh={handleDataUpdate}
        />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
  {/* --- LEFT COLUMN: Battle & Stats --- */}
  <div className="lg:col-span-4 space-y-8">
    
    <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-green-900/5">
      <div className="flex items-center gap-3">
        <Target className="text-emerald-500" size={20} />
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Battle Selection</h2>
      </div>
      
      {/* 🏆 PSYCHOLOGY-OPTIMIZED RANKED BUTTON */}
      <button
        onClick={canPlayRanked ? handleRankedSearch : () => setShowDepositModal(true)}
        disabled={isCheckingNet}
        className={`w-full group relative overflow-hidden p-8 rounded-[2.5rem] transition-all duration-500 shadow-2xl 
          ${canPlayRanked && !isCheckingNet
            ? "bg-slate-900 border-b-4 border-emerald-500 hover:translate-y-[-4px] active:translate-y-[2px] active:border-b-0" 
            : "bg-slate-100 grayscale opacity-80"
          }`}
      >
        {/* ✨ PRO-DEAL BADGE: Positioned to catch the eye first (Top-Right) */}
        {canPlayRanked && !isCheckingNet && (
          <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-400 to-orange-500 text-[10px] font-black text-slate-900 px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg animate-pulse">
            Zero Commission
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-5">
          {/* Animated Icon Container */}
          <div className={`p-5 rounded-3xl transition-all duration-700 ${canPlayRanked ? "bg-emerald-500/10 group-hover:scale-110 group-hover:rotate-[360deg]" : "bg-slate-200"}`}>
            {isCheckingNet ? (
              <Loader2 className="animate-spin text-emerald-500" size={36} />
            ) : canPlayRanked ? (
              <Trophy className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" size={36} />
            ) : (
              <Lock className="text-slate-400" size={36} />
            )}
          </div>

          <div className="text-center">
            <span className={`block text-xs font-bold uppercase tracking-[0.2em] mb-1 ${canPlayRanked ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isCheckingNet ? "Verifying Connection..." : "Official Ranked Match"}
            </span>
            
            <h3 className={`text-3xl font-black uppercase tracking-tighter leading-none ${canPlayRanked ? 'text-white' : 'text-slate-500'}`}>
              {canPlayRanked ? "Win 200 PKR" : "Arena Locked"}
            </h3>

            {/* 💰 VALUE PROPOSITION: Highlight the 100% Return */}
            {canPlayRanked && !isCheckingNet && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                  <span>ENTRY 100</span>
                  <div className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="text-emerald-500">PAYOUT 100%</span>
                </div>
                
                {/* Visual Anchor for the "Big Prize" */}
                <div className="bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-2xl border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                  <span className="text-sm font-black tracking-widest uppercase">Play Now</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Glossy Reflection Sweep */}
    <div className="absolute top-0 left-[-150%] w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:left-[150%] transition-all duration-1000 ease-in-out" />
      </button>

      {/* PRACTICE BUTTON: Secondary and less vibrant to drive users to Ranked */}
     {/* PRACTICE ARENA: Clean, Professional, and Trustworthy */}
<button 
  onClick={onStartOffline} 
  disabled={isCheckingNet} 
  className="w-full group relative overflow-hidden bg-white hover:bg-slate-50 border-2 border-slate-100 p-6 rounded-[2rem] transition-all duration-300 flex items-center justify-between active:scale-95 shadow-sm hover:shadow-md"
>
  <div className="flex items-center gap-5">
    {/* Icon Container with subtle animation */}
    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-all duration-500">
      <Zap size={28} className="group-hover:animate-pulse" />
    </div>

    <div className="text-left space-y-0.5">
      {/* Simple, clear title */}
      <span className="block text-base font-black text-slate-800 uppercase tracking-tight">
        Free Practice
      </span>
      
      {/* Easiest terms for users to understand */}
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          No Money Needed • Just for Fun
        </span>
        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter mt-1 bg-emerald-50 px-2 py-0.5 rounded-md self-start">
          Improve Your Skill
        </span>
      </div>
    </div>
  </div>

  {/* Interactive Arrow */}
  <div className="bg-slate-50 p-3 rounded-xl group-hover:bg-emerald-500 transition-colors duration-300">
    <ArrowRight size={20} className="text-slate-300 group-hover:text-white transform group-hover:translate-x-1 transition-all duration-300" />
  </div>

  {/* Subtle Shine Effect */}
  <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-slate-900/5 to-transparent group-hover:left-[100%] transition-all duration-1000" />
</button>
    </div>

    {/* SYSTEM LIQUIDITY CARD: Builds Trust/Social Proof */}
    <div className="relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-white rounded-[2.5rem] p-8 shadow-xl shadow-green-900/5">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="text-amber-400" size={18} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Total System Liquidity
          </span>
        </div>
        <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
          {Number(stats?.system_liquidity || stats?.global_stats?.system_liquidity || 0).toLocaleString()}
          <span className="text-lg text-emerald-500 ml-2 font-black italic"> PKR</span>
        </div>
      </div>
      <Trophy className="absolute -right-6 -bottom-6 opacity-[0.05] rotate-12 text-slate-900" size={180} />
    </div>

    <ReferralCard user={localUser} onUpdateUser={handleDataUpdate} />
    <RecentMatches matches={localUser?.recent_matches || []} />
  </div>

  {/* --- RIGHT COLUMN: Leaderboard --- */}
  <div className="lg:col-span-8">
    <Leaderboard players={stats.top_players} loading={loading} />
  </div>
</div>
      </div>

      {/* --- MODALS --- */}
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
            {/* The Account Number */}
      <p className="text-lg font-black tracking-widest break-all text-emerald-400">
        {accountNo}
      </p>

      {/* The Copy Button/Text */}
      <button
        onClick={handleCopy}
        className="px-2 py-1 text-xs font-bold  tracking-tighter transition-all rounded  text-emerald-400 hover:bg-emerald-400 hover:text-black"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
              <p className="text-[10px] font-black text-emerald-500 uppercase mt-1">Muhammad Yasir</p>
            </div>
            <form onSubmit={handleDeposit} className="space-y-4">
              <input type="number" min="1" required placeholder="Amount" value={depositData.amount} onChange={(e) => setDepositData({...depositData, amount: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold outline-none" />
              <input type="text" required placeholder="Account Name" value={depositData.fullName} onChange={(e) => setDepositData({...depositData, fullName: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold outline-none" />
              <input type="text" required placeholder="Phone Number" value={depositData.senderNumber} onChange={(e) => setDepositData({...depositData, senderNumber: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold outline-none" />
              <input type="text" required placeholder="TRX ID" value={depositData.trxId} onChange={(e) => setDepositData({...depositData, trxId: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-black outline-none" />
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all">{isSubmitting ? "Submitting..." : "Confirm Deposit"}</button>
            </form>
          </div>
        </div>
      )}

   {showWithdrawModal && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
      <button onClick={() => setShowWithdrawModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-xl text-slate-400"><X size={20} /></button>
      
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center"><Wallet size={24} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Withdrawal</h2>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Min. 100 PKR required</p>
        </div>
      </div>

      <form onSubmit={handleWithdraw} className="space-y-4">
        <div className="relative">
          <input 
            type="number" 
            min="500" 
            required 
            placeholder="Amount (PKR)" 
            value={withdrawData.amount} 
            onChange={(e) => setWithdrawData({...withdrawData, amount: e.target.value})} 
            className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" 
          />
          {withdrawData.amount > 0 && withdrawData.amount < 1000 && (
            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black text-red-500 uppercase">Min 1000</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {["Easypaisa", "JazzCash"].map((m) => (
            <button key={m} type="button" onClick={() => setWithdrawData({...withdrawData, method: m})} className={`p-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${withdrawData.method === m ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-50 text-slate-300"}`}>{m}</button>
          ))}
        </div>

        <input type="text" required placeholder="Account Number" value={withdrawData.accountNumber} onChange={(e) => setWithdrawData({...withdrawData, accountNumber: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold outline-none" />
        <input type="text" required placeholder="Account Title" value={withdrawData.accountName} onChange={(e) => setWithdrawData({...withdrawData, accountName: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl text-sm font-bold outline-none" />
        
        {/* 🕒 NEW: Withdrawal Timeframe Message */}
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
          <p className="text-[10px] text-amber-700 font-bold text-center leading-tight">
            ⚠️ PROCESSING TIME: 1-72 HOURS <br/>
            Requests are verified manually by the Brain Buffer team
          </p>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || withdrawData.amount < 1000} 
          className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-xl shadow-slate-900/10"
        >
          {isSubmitting ? "Processing..." : "Confirm Withdrawal"}
        </button>
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