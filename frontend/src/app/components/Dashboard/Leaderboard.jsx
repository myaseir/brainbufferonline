"use client";
import React, { useEffect, useState } from 'react';
import { TrendingUp, Trophy, Sparkles, Sword, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Leaderboard({ players, loading }) {
  const [prevWinner, setPrevWinner] = useState(null);

  useEffect(() => {
  if (!loading && players?.length > 0) {
    const currentWinner = players[0].username;
    
    // Trigger confetti only if the winner actually changed
    if (prevWinner && prevWinner !== currentWinner) {
      triggerWinnerConfetti();
    }
    
    // Only update if it's different to avoid unnecessary cycles
    if (prevWinner !== currentWinner) {
      setPrevWinner(currentWinner);
    }
  }
  // 🚀 REMOVED 'prevWinner' from dependencies to break the loop
}, [players, loading]);

  const triggerWinnerConfetti = () => {
    const end = Date.now() + 3000;
    const colors = ['#22d3ee', '#fbbf24', '#ffffff'];
    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const renderRankIcon = (index) => {
    const configs = {
      0: { color: 'text-cyan-300', size: 48, shadow: 'rgba(34,211,238,0.8)' },
      1: { color: 'text-amber-400', size: 38, shadow: 'rgba(251,191,36,0.5)' },
      2: { color: 'text-slate-300', size: 30, shadow: 'rgba(203,213,225,0.4)' }
    };
    const config = configs[index];

    if (config) {
      return (
        <div className="relative flex justify-center items-center group">
          <div className="relative overflow-hidden p-1 rounded-lg">
            <Trophy 
              className={`${config.color} drop-shadow-[0_0_15px_${config.shadow}] relative z-10 transition-transform duration-500 group-hover:scale-110`} 
              size={config.size} 
              strokeWidth={2.5} 
            />
            <div className="absolute inset-0 z-20 pointer-events-none shine-overlay"></div>
          </div>
          {index === 0 && (
            <Sparkles className="absolute -top-2 -right-2 text-white animate-pulse z-30" size={20} />
          )}
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700">
        <span className="text-xs font-black text-slate-500">{index + 1}</span>
      </div>
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
      <style jsx global>{`
        @keyframes shine { 
          0% { transform: translateX(-200%) skewX(-30deg); } 
          100% { transform: translateX(200%) skewX(-30deg); } 
        }
        .shine-overlay { 
          background: linear-gradient(to right, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%); 
          animation: shine 3s infinite linear; 
          width: 200%; 
          height: 100%; 
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>

      {/* Header */}
      <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
            <TrendingUp className="text-cyan-400" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white leading-none">Global Rankings</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Ranked by Victories</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-4">
             <Loader2 className="text-cyan-500 animate-spin" size={32} />
             <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Syncing Shared Brain...</p>
          </div>
        ) : (
          players.map((player, idx) => (
            <div 
              key={idx} 
              className={`flex items-center justify-between p-5 rounded-[2.5rem] border transition-all duration-500 ${
                idx === 0 
                ? 'bg-gradient-to-r from-cyan-950/30 via-slate-900 to-slate-900 border-cyan-500/40 shadow-[0_0_30px_rgba(34,211,238,0.1)]' 
                : 'bg-slate-900/30 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-6">
                <div className="w-16 flex justify-center">
                  {renderRankIcon(idx)}
                </div>
                <div>
                  <p className={`font-black uppercase tracking-tight ${idx === 0 ? 'text-white text-lg' : 'text-slate-300 text-sm'}`}>
                    {player.username}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                      idx === 0 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-400'
                    }`}>
                      <Sword size={10} className={idx === 0 ? 'animate-pulse' : ''} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        {player.total_wins || 0} Victories
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex flex-col">
                  {/* 🚀 Changed to show Ranking context instead of Balance */}
                  <span className={`text-xl font-black ${idx === 0 ? 'text-cyan-400' : 'text-white'}`}>
                    #{idx + 1}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Global Rank</span>
                </div>
              </div>
            </div>
          ))
        )}

        {!loading && players.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">No commanders in range</p>
          </div>
        )}
      </div>
    </div>
  );
}