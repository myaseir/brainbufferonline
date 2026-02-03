import React from 'react';
import { Loader2, Clock } from 'lucide-react';

const OnlineUI = ({ 
  gameState, connectionStatus, waitingForResult, opponentName
}) => {
  return (
    <>
      {/* 1. SYNCING / WAITING FOR OPPONENT */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-white/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest animate-pulse">{connectionStatus}</p>
        </div>
      )}

      {/* 2. WAITING FOR RESULT */}
      {waitingForResult && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl flex items-center justify-center z-[150] p-6">
          <div className="bg-white border border-slate-100 rounded-[3rem] p-10 max-w-sm w-full text-center">
             <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-slate-50 border-t-emerald-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center"><Clock size={32} className="text-slate-300" /></div>
             </div>
             <h2 className="text-2xl font-black text-slate-900 uppercase">Syncing Result</h2>
             <p className="text-slate-500 text-xs font-bold mt-2">Waiting for <span className="text-emerald-500">@{opponentName}</span>...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default OnlineUI;