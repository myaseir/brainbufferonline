"use client";
import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';

const OnlineStatus = () => {
  const getPKTTime = () => {
    const options = { timeZone: 'Asia/Karachi', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const parts = formatter.formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    const s = parseInt(parts.find(p => p.type === 'second').value, 10);
    return { decimal: h + m / 60, totalSeconds: h * 3600 + m * 60 + s };
  };

  const calculateSyncCount = () => {
    const timeData = getPKTTime();
    const currentTime = timeData.decimal;
    
    // Shared Ticks
    const slowTick = Math.floor(timeData.totalSeconds / 30); 
    const fastTick = Math.floor(timeData.totalSeconds / 3);  

    // Deterministic Waves
    const mainWave = (Math.sin(slowTick) + 1) / 2; 
    const jitterSeed = Math.sin(fastTick * 0.8) * 1000;
    const microDrop = (Math.cos(jitterSeed) + 1) / 2; 

    let base = 0;
    let range = 0;
    let volatility = 0; // ⚡ New variable to control how "jumpy" the number is

    if (currentTime >= 15 && currentTime < 21) { 
      base = 2200; range = 1800; volatility = 0.08; // 8% variance at peak
    } else if (currentTime >= 21 && currentTime < 24) { 
      base = 450; range = 350; volatility = 0.05;   // 5% variance
    } else if (currentTime >= 0 && currentTime < 7) { 
      base = 120; range = 60; volatility = 0.02;    // 2% variance (Very stable at night)
    } else if (currentTime >= 7 && currentTime < 12) { 
      base = 800; range = 700; volatility = 0.04; 
    } else { 
      base = 1500; range = 500; volatility = 0.05;
    }

    // Calculation: Base + Wave - (Jitter * Volatility)
    // At night, (180 * 0.02) = ~3 users max drop.
    // At peak, (4000 * 0.08) = ~320 users max drop.
    const currentMaxLoad = base + (mainWave * range);
    const finalCount = currentMaxLoad - (microDrop * (currentMaxLoad * volatility));
    
    return Math.floor(finalCount);
  };

  const [count, setCount] = useState(() => calculateSyncCount());
  const [isPeak, setIsPeak] = useState(false);

  useEffect(() => {
    const syncStats = () => {
      const timeData = getPKTTime();
      setIsPeak(timeData.decimal >= 15 && timeData.decimal < 21);
      setCount(calculateSyncCount());
    };
    const timer = setInterval(syncStats, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-emerald-200 transition-all duration-300">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs md:text-sm font-black text-slate-800 tabular-nums">
            {count.toLocaleString()}
          </span>
          <span className="text-[9px] md:text-[10px] font-bold text-emerald-600 uppercase tracking-tight">
            Live
          </span>
        </div>
      </div>

      {isPeak && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-200 animate-in zoom-in slide-in-from-left-2 duration-500">
          <Flame size={12} className="fill-current animate-pulse" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">
            Hot Match
          </span>
        </div>
      )}
    </div>
  );
};

export default OnlineStatus;