"use client";
import { useState } from 'react';
import { History, ArrowUpRight, ArrowDownLeft, Minus, Copy, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RecentMatches({ matches = [] }) { 
  // viewMode can be: 3, 10, or 'all'
  const [viewMode, setViewMode] = useState(3);

  const copyMatchId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    toast.success("Match ID copied!", {
      icon: <CheckCircle2 className="text-emerald-500" />,
      style: { borderRadius: '20px', background: '#333', color: '#fff', fontSize: '12px' }
    });
  };

  const displayedMatches = viewMode === 'all' 
    ? matches 
    : matches.slice(0, viewMode);

  const hasMore = matches.length > displayedMatches.length;
  // Show "See Less" if we have expanded beyond the initial 3
  const canSeeLess = viewMode !== 3;

  const handleSeeMore = () => {
    if (viewMode === 3) {
      setViewMode(10);
    } else {
      setViewMode('all');
    }
  };

  const handleSeeLess = () => {
    setViewMode(3);
    // Optional: Smooth scroll back to top of section if list was very long
    // document.getElementById('mission-history-header')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-green-900/5 mt-8">
      <div id="mission-history-header" className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="text-slate-400" size={20} />
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Mission History</h2>
        </div>
        {matches.length > 0 && (
           <span className="text-[10px] font-black text-slate-300 uppercase bg-slate-100 px-2 py-1 rounded-full">
             {matches.length} Total
           </span>
        )}
      </div>

      <div className="space-y-4">
        {displayedMatches.length > 0 ? (
          <>
            {displayedMatches.map((match, i) => {
              const res = (match.result || match.status || "").toUpperCase();
              const isWin = res === 'WON' || res === 'WIN';
              const isLoss = res === 'LOST' || res === 'LOSS';
              const isDraw = res === 'DRAW';

              return (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-white transition-all hover:bg-white hover:shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      isWin ? 'bg-emerald-100 text-emerald-600' : 
                      isDraw ? 'bg-amber-100 text-amber-600' : 
                      'bg-red-100 text-red-600'
                    }`}>
                      {isWin && <ArrowUpRight size={16}/>}
                      {isDraw && <Minus size={16}/>}
                      {isLoss && <ArrowDownLeft size={16}/>}
                    </div>
                    
                    <div>
                      <p className="text-xs font-black uppercase text-slate-700">
                        {res || 'MISSION'} <span className="text-slate-400 mx-1">Score:</span> {match.your_score || match.score || 0}
                      </p>
                      <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-1">
                        {match.timestamp ? new Date(match.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just Now'}
                      </p>

                      <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              ID: {match.match_id ? match.match_id.substring(0, 8) + '...' : 'N/A'}
                          </span>
                          <button 
                              onClick={() => copyMatchId(match.match_id)}
                              className="text-slate-300 hover:text-emerald-500 transition-colors active:scale-90"
                              title="Copy Match ID"
                          >
                              <Copy size={12} />
                          </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-black tabular-nums block ${
                      isWin ? 'text-emerald-500' : isDraw ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {isWin ? '+90' : isLoss ? '-50' : '+50'}
                    </span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">PKR</span>
                  </div>
                </div>
              );
            })}

            {/* ACTION BUTTONS (See More / See Less) */}
            <div className="flex flex-col items-center gap-2 mt-4">
              {hasMore && (
                <button 
                  onClick={handleSeeMore}
                  className="w-full py-3 flex flex-col items-center gap-1 group transition-all"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-green-500 transition-colors">
                    See {viewMode === 3 ? 'Recent 10' : 'All Missions'}
                  </span>
                  <ChevronDown size={16} className="text-slate-300 group-hover:text-green-500 animate-bounce" />
                </button>
              )}

              {canSeeLess && (
                <button 
                  onClick={handleSeeLess}
                  className="w-full py-2 flex flex-col items-center gap-1 group transition-all"
                >
                  <ChevronUp size={16} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover:text-red-400 transition-colors">
                    Show Less
                  </span>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-3xl">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No deployments recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}