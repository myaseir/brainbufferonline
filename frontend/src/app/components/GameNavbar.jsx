"use client";
import React from 'react';
import { Trophy, Users, WifiOff } from 'lucide-react';
import { playPopSound } from '../utils/sounds';
const GameNavbar = ({ 
  score, 
  mode, 
  opponentName, 
  opponentScore, 
  highScore, 
  roundTimer, 
  onTogglePause,
  isReconnecting // New prop to show if opponent is away
}) => {
  // Logic to determine who is winning
  const isWinning = score > opponentScore;
  const isTied = score === opponentScore;

  return (
    <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
      
      {/* --- LEFT: SCORE BOARD --- */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {/* Current Score */}
        <div className={`bg-white/90 backdrop-blur-md border px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3 transition-colors ${mode === 'online' && isWinning && !isTied ? 'border-emerald-200' : 'border-slate-100'}`}>
          <Trophy size={18} className={mode === 'online' && isWinning && !isTied ? 'text-emerald-500' : 'text-yellow-500'} />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">You</span>
            <span className="font-black text-slate-800 text-lg leading-none">{score}</span>
          </div>
        </div>

        {/* Online Mode: Opponent Score */}
        {mode === 'online' && (
          <div className={`bg-white/90 backdrop-blur-md border px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3 transition-all duration-500 ${!isWinning && !isTied ? 'border-red-200' : 'border-slate-100'} ${isReconnecting ? 'opacity-50 grayscale' : 'opacity-100'}`}>
            {isReconnecting ? <WifiOff size={18} className="text-slate-400 animate-pulse" /> : <Users size={18} className={!isWinning && !isTied ? 'text-red-500' : 'text-slate-400'} />}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider truncate max-w-[80px]">
                {isReconnecting ? 'Reconnecting...' : (opponentName || 'Opponent')}
              </span>
              <span className="font-black text-slate-600 text-sm leading-none">
                {opponentScore?.toLocaleString() || 0}
              </span>
            </div>
          </div>
        )}

        {/* Offline Mode: High Score */}
        {mode === 'offline' && (
          <div className="bg-white/50 backdrop-blur-sm px-3 py-1 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100">
            Best: {highScore}
          </div>
        )}
      </div>

      {/* --- CENTER: TIMER --- */}
      <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-4">
        <div className={`
          bg-white/90 backdrop-blur-xl border border-slate-100 px-6 py-3 rounded-2xl shadow-lg transition-all duration-300 
          ${roundTimer <= 3 ? 'border-red-200 shadow-red-100 scale-110' : ''}
        `}>
          <span className={`font-mono text-3xl font-black ${roundTimer <= 3 ? 'text-red-500' : 'text-slate-800'}`}>
            {roundTimer}
          </span>
        </div>
      </div>

      {/* --- RIGHT: SYSTEM STATUS --- */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        {mode === 'offline' ? (
          <button 
            onClick={() => {
    playPopSound(); // 🔊 Play the sound first
    onTogglePause(); // Then run the pause logic
  }}
            
            className="bg-white/90 backdrop-blur-md border border-slate-100 p-3 rounded-2xl shadow-sm hover:text-emerald-500 transition-colors active:scale-90"
          >
            <div className="space-y-1">
              <div className="w-5 h-0.5 bg-slate-400 rounded-full"></div>
              <div className="w-5 h-0.5 bg-slate-400 rounded-full"></div>
            </div>
          </button>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">Live Match</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameNavbar;