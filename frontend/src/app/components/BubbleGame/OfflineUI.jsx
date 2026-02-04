"use client";
import React from 'react';
import { 
  Play, Pause, Volume2, VolumeX, RotateCcw, 
  LogOut, MousePointer2, Clock, AlertTriangle, CheckCircle2,
  Trophy, XCircle
} from 'lucide-react';

const OfflineUI = ({ 
  gameState, score, highScore, showTutorial, showMenu, settings, startSoundRef,
  startGame, setShowTutorial, togglePause, setSettings, resetGameData, onQuit 
}) => {

  return (
    <>
      {/* 1. START SCREEN */}
      {gameState === 'idle' && !showTutorial && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-lg flex flex-col items-center justify-center z-50 px-4 animate-in fade-in duration-500">
          <div className="bg-white border border-slate-100 p-10 rounded-[3rem] shadow-2xl text-center max-w-sm w-full">
            <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Brain<span className="text-emerald-500">Buffer</span></h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Training Module</p>
            <button onClick={() => { startSoundRef.current?.play(); startGame(); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
              Start Game <Play size={16} />
            </button>
            {onQuit && <button onClick={onQuit} className="mt-6 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-emerald-500 transition-colors">Return to Dashboard</button>}
          </div>
        </div>
      )}

      {/* 2. RESULT SCREEN (The Fix for the "Hanging" Issue) */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl flex flex-col items-center justify-center z-[300] px-4 animate-in zoom-in-95 duration-300">
          <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-2xl text-center max-w-sm w-full relative overflow-hidden">
            {/* Red header for Game Over */}
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={40} strokeWidth={2.5} />
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">Knocked Out!</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">Training Interrupted</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="block text-[8px] font-black text-slate-400 uppercase mb-1">Final Score</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight">{score}</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <span className="block text-[8px] font-black text-emerald-500 uppercase mb-1">Best Training</span>
                <span className="text-2xl font-black text-emerald-600 tracking-tight">{highScore}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={startGame} 
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Try Again <RotateCcw size={16} />
              </button>
              
              <button 
                onClick={onQuit} 
                className="w-full bg-white border border-slate-200 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-all active:scale-95"
              >
                Exit Training
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAUSE MENU */}
      {showMenu && (
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6 text-center">System Paused</h2>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-2">Music</span>
                <button onClick={() => {
                   const newVal = !settings.music;
                   setSettings({...settings, music: newVal});
                }} className={`p-2 rounded-lg transition-all ${settings.music ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  {settings.music ? <Volume2 size={20}/> : <VolumeX size={20}/>}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={togglePause} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors">Resume</button>
              <button onClick={resetGameData} className="w-full bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:text-red-500 hover:border-red-200">Reset Data</button>
              <button onClick={() => { togglePause(); onQuit && onQuit(); }} className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4 hover:text-slate-600">Quit Mission</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TUTORIAL */}
      {showTutorial && (
        <div className="absolute inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/50 relative overflow-hidden">
            {/* Tutorial content remains the same... */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-100">
                <MousePointer2 size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">How to Play</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Mission Briefing</p>
            </div>

            <div className="space-y-6 mb-8">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 font-black text-slate-300">1</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase">Order Matters</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                    Tap the bubbles in <strong>Ascending Order</strong> (1, 2, 3...). 
                  </p>
                </div>
              </div>
              {/* Other steps... */}
            </div>

            <button 
              onClick={() => {
                setShowTutorial(false);
                localStorage.setItem('tutorialSeen', 'true');
                if(startSoundRef.current) startSoundRef.current.play().catch(()=>{});
                startGame();
              }}
              className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              Start Mission <Play size={16} fill="currentColor"/>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineUI;