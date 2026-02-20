"use client";
import React, { useState, useEffect } from 'react';
import { Flame, WifiOff } from 'lucide-react';

const OnlineStatus = () => {
  // New state to track internet connection
  const [isOnline, setIsOnline] = useState(true);

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
    const slowTick = Math.floor(timeData.totalSeconds / 30); 
    const fastTick = Math.floor(timeData.totalSeconds / 3);  
    const mainWave = (Math.sin(slowTick) + 1) / 2; 
    const jitterSeed = Math.sin(fastTick * 0.8) * 1000;
    const microDrop = (Math.cos(jitterSeed) + 1) / 2; 

    let base = 0, range = 0, volatility = 0;

    if (currentTime >= 15 && currentTime < 21) { 
      base = 2200; range = 1800; volatility = 0.08;
    } else if (currentTime >= 21 && currentTime < 24) { 
      base = 450; range = 350; volatility = 0.05;
    } else if (currentTime >= 0 && currentTime < 7) { 
      base = 120; range = 60; volatility = 0.02;
    } else if (currentTime >= 7 && currentTime < 12) { 
      base = 800; range = 700; volatility = 0.04; 
    } else { 
      base = 1500; range = 500; volatility = 0.05;
    }

    const currentMaxLoad = base + (mainWave * range);
    const finalCount = currentMaxLoad - (microDrop * (currentMaxLoad * volatility));
    return Math.floor(finalCount);
  };

  const [count, setCount] = useState(() => calculateSyncCount());
  const [isPeak, setIsPeak] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listen for connection changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const syncStats = () => {
      const timeData = getPKTTime();
      setIsPeak(timeData.decimal >= 15 && timeData.decimal < 21);
      setCount(calculateSyncCount());
    };

    const timer = setInterval(syncStats, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 select-none">
      <div className={`flex items-center gap-2 px-3 py-1.5 bg-white border rounded-xl shadow-sm transition-all duration-300 ${isOnline ? 'border-slate-100 hover:border-emerald-200' : 'border-red-100'}`}>
        
        {/* Connection Indicator */}
        <div className="relative flex h-2 w-2">
          {isOnline ? (
            <>
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300"></span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <>
              <span className="text-xs md:text-sm font-black text-slate-800 tabular-nums">
                {count.toLocaleString()}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold text-emerald-600 uppercase tracking-tight">
                Live
              </span>
            </>
          ) : (
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
              <WifiOff size={10} /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Only show Hot Match if online */}
      {isPeak && isOnline && (
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