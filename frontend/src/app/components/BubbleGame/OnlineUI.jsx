import React from 'react';
import { Loader2, Clock, AlertCircle } from 'lucide-react';

const OnlineUI = ({ 
  gameState, connectionStatus, waitingForResult, opponentName, resultMessage
}) => {
  // Check if the match was aborted (Refunded) based on the connectionStatus text
  const isAborted = connectionStatus?.toLowerCase().includes('aborted') || 
                    connectionStatus?.toLowerCase().includes('refunded');

  return (
    <>
      {/* 1. SYNCING / WAITING FOR OPPONENT / ABORTED STATE */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-white/50 backdrop-blur-sm px-6 text-center">
          {isAborted ? (
            <>
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-slate-900 font-black uppercase text-lg">Match Cancelled</h2>
              <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-tighter">{connectionStatus}</p>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
              <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest animate-pulse">
                {connectionStatus}
              </p>
            </>
          )}
        </div>
      )}

      {/* 2. WAITING FOR RESULT (Both finished, server calculating payout) */}
      {waitingForResult && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl flex items-center justify-center z-[150] p-6">
          <div className="bg-white border border-slate-100 rounded-[3rem] shadow-2xl shadow-emerald-500/10 p-10 max-w-sm w-full text-center">
             <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-slate-50 border-t-emerald-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock size={32} className="text-slate-300" />
                </div>
             </div>
             <h2 className="text-2xl font-black text-slate-900 uppercase">Finalizing...</h2>
             <p className="text-slate-500 text-xs font-bold mt-2 leading-relaxed">
               Waiting for <span className="text-emerald-500">@{opponentName}</span> to finish so we can verify the winner.
             </p>
          </div>
        </div>
      )}
    </>
  );
};

export default OnlineUI;