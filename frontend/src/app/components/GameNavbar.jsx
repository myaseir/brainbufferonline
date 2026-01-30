"use client";
import React from 'react';
import { Trophy, Users } from 'lucide-react';

const GameNavbar = ({ 
  score, 
  mode, 
  opponentName, 
  opponentScore, 
  highScore, 
  roundTimer, 
  onTogglePause 
}) => {
  return (
    <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
      
      {/* --- LEFT: SCORE BOARD --- */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {/* Current Score */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
          <Trophy size={18} className="text-yellow-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Score</span>
            <span className="font-black text-slate-800 text-lg leading-none">{score}</span>
          </div>
        </div>

        {/* Online Mode: Opponent Score */}
        {mode === 'online' && (
          <div className="bg-white/90 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
            <Users size={18} className="text-red-400" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider truncate max-w-[80px]">
                {opponentName}
              </span>
              <span className="font-black text-slate-600 text-sm leading-none">{opponentScore}</span>
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
          ${roundTimer <= 3 ? 'border-red-200 shadow-red-100 animate-pulse' : ''}
        `}>
          <span className={`font-mono text-3xl font-black ${roundTimer <= 3 ? 'text-red-500' : 'text-slate-800'}`}>
            {roundTimer}
          </span>
        </div>
      </div>

      {/* --- RIGHT: PAUSE BUTTON (Offline Only) --- */}
      {mode === 'offline' && (
        <button 
          onClick={onTogglePause} 
          className="bg-white/90 backdrop-blur-md border border-slate-100 p-3 rounded-2xl shadow-sm hover:text-emerald-500 transition-colors pointer-events-auto active:scale-90"
        >
          <div className="space-y-1">
            <div className="w-5 h-0.5 bg-slate-400 rounded-full"></div>
            <div className="w-5 h-0.5 bg-slate-400 rounded-full"></div>
          </div>
        </button>
      )}
    </div>
  );
};

export default GameNavbar;