"use client";
import { useState, useEffect } from 'react';
import { Trophy, Wallet, Play, LogOut, TrendingUp, History, User, Zap, Target, Crown } from 'lucide-react';

export default function Dashboard({ user, onStartGame, onStartOffline, onLogout }) {
  const [stats, setStats] = useState({ top_players: [], global_stats: { total_pool: 0 } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
   const fetchStats = async () => {
    try {
      // 👇 Updated to use Environment Variable
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leaderboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };
  fetchStats();
}, []);

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-800 p-4 md:p-8 font-sans selection:bg-green-100">
      {/* Soft Light Green Decorative Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-green-100/50 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-emerald-50/50 blur-[100px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        
        {/* --- DYNAMIC HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/80 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-lg shadow-green-900/5">
          <div className="flex items-center gap-5">
            <div className="relative">
              {/* User Logo: Light Green Gradient */}
              <div className="w-16 h-16 bg-gradient-to-tr from-green-400 to-emerald-300 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                <User size={32} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-4 border-white rounded-full"></div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {user?.username || 'Commander'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-green-100">Rank: Elite</span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">• Pakistan Server</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end px-6 border-r border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Wallet Balance</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900 tabular-nums">{user?.wallet_balance || 0}</span>
                <span className="text-xs font-bold text-green-500 uppercase">PKR</span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-4 bg-slate-50 hover:bg-red-50 hover:text-red-500 border border-slate-100 rounded-2xl transition-all duration-300 shadow-sm"
            >
              <LogOut size={24} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- LEFT MODES --- */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-green-900/5">
              <div className="flex items-center gap-3 mb-2">
                <Target className="text-green-500" size={20} />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Battle Selection</h2>
              </div>

              {/* Main Button: Light Green / Mint Gradient */}
              <button 
                onClick={onStartGame}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-green-400 to-emerald-400 p-6 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_10px_25px_rgba(52,211,153,0.3)]"
              >
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <Play className="fill-white text-white translate-x-1" size={32} />
                  <div className="text-center">
                    <span className="block text-xl font-black text-white uppercase tracking-tighter">Ranked Match</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-90">Win 20 PKR • Entry 10 PKR</span>
                  </div>
                </div>
                {/* Shine Animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </button>

              <button 
                onClick={onStartOffline}
                className="w-full bg-white hover:bg-slate-50 border border-slate-100 p-6 rounded-3xl transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-400 group-hover:text-green-600 transition-colors">
                    <Zap size={24} />
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">Practice Arena</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No stakes • Training</span>
                  </div>
                </div>
              </button>
            </div>

            {/* PRIZE POOL */}
            <div className="relative group overflow-hidden bg-white border border-white rounded-[2.5rem] p-8 shadow-xl shadow-green-900/5">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="text-amber-400" size={18} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Economy</span>
                </div>
                <div className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                  {stats.global_stats.total_pool}<span className="text-lg text-slate-300 ml-2 font-bold">PKR</span>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12 transition-transform group-hover:scale-110 text-slate-900">
                <Trophy size={160} />
              </div>
            </div>
          </div>

          {/* --- RIGHT: LEADERBOARD --- */}
          <div className="lg:col-span-8">
            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-green-900/5">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-green-50/20">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-green-500" size={24} />
                  <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900">Top Tier Command</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Updates</span>
              </div>

              <div className="p-4 space-y-2">
                {loading ? (
                  <div className="py-20 flex justify-center">
                    <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  stats.top_players.map((player, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-5 rounded-2xl transition-all hover:bg-slate-50 border border-transparent hover:border-slate-100 ${idx === 0 ? 'bg-green-50/50 border-green-100' : ''}`}
                    >
                      <div className="flex items-center gap-6">
                        <span className={`text-xl font-black w-8 ${idx === 0 ? 'text-green-500' : idx === 1 ? 'text-slate-300' : 'text-slate-100'}`}>
                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 tracking-wide uppercase text-sm">{player.username}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Wins: {player.total_wins}</span>
                            <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Lvl {Math.floor(player.total_wins/5) + 1}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 tabular-nums">{player.wallet_balance}</span>
                        <span className="text-[10px] font-bold text-slate-400 ml-2 uppercase font-sans">PKR</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-slate-50/30 border-t border-slate-50 text-center">
                <button className="inline-flex items-center gap-3 text-slate-400 hover:text-green-500 transition-colors py-2 group">
                  <History size={18} className="group-hover:rotate-[-45deg] transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Request Combat Logs</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}