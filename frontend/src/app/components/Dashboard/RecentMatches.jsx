"use client";
import { History, ArrowUpRight, ArrowDownLeft, Minus } from 'lucide-react';

export default function RecentMatches({ matches = [] }) { // Default to empty array
  return (
    <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-green-900/5 mt-8">
      <div className="flex items-center gap-3 mb-6">
        <History className="text-slate-400" size={20} />
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Mission History</h2>
      </div>

      <div className="space-y-4">
        {matches?.length > 0 ? (
          matches.map((match, i) => {
            // Determine styles based on result
            const isWin = match.result === 'WIN';
            const isDraw = match.result === 'DRAW';
            const isLoss = match.result === 'LOSS';

            return (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-white transition-all hover:bg-white hover:shadow-md hover:scale-[1.01]">
                <div className="flex items-center gap-4">
                  {/* Icon Logic */}
                  <div className={`p-2 rounded-lg ${
                    isWin ? 'bg-green-100 text-green-600' : 
                    isDraw ? 'bg-amber-100 text-amber-600' : // Changed Draw to Amber for better visibility
                    'bg-red-100 text-red-600'
                  }`}>
                    {isWin && <ArrowUpRight size={16}/>}
                    {isDraw && <Minus size={16}/>}
                    {isLoss && <ArrowDownLeft size={16}/>}
                  </div>
                  
                  <div>
                    <p className="text-xs font-black uppercase text-slate-700">
                      {match.result} <span className="text-slate-400 mx-1">VS</span> {match.opponent || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                      {match.date ? new Date(match.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just Now'}
                    </p>
                  </div>
                </div>

                {/* Payout Logic */}
                <div className="text-right">
                  <span className={`text-sm font-black tabular-nums block ${
                    isWin ? 'text-green-500' : 
                    isDraw ? 'text-amber-500' : 
                    'text-red-500'
                  }`}>
                    {isWin ? '+' : isLoss ? '-' : ''}{match.payout || 0}
                  </span>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">PKR</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-3xl">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No deployments recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}