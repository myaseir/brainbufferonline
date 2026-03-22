"use client";
import React, { useMemo } from 'react';
import ParticlesBackground from '../ParticlesBackground';
import GameNavbar from '../GameNavbar'; 
import GameBoard from './GameBoard';
import OfflineUI from './OfflineUI';
import OnlineUI from './OnlineUI';
import { 
  Trophy, X, MinusCircle, RotateCcw, Share2, 
  Coins, UserX, AlertTriangle, LogOut, ArrowRight
} from 'lucide-react';
import { useBubbleGame } from '../../hooks/useBubbleGame'; 

const BubbleGame = ({ mode = 'offline', socket = null, onQuit = null, onRestart = null, onRequeue = null }) => {
  const logic = useBubbleGame({ mode, socket, onQuit, onRestart, onRequeue });

  // 🎨 ADVANCED UI LOGIC: Tailored for Pakistani Market Stakes (100 Entry / 200 Win)
  const resultData = useMemo(() => {
    const isDisconnect = logic.resultMessage?.toLowerCase().includes('disconnected') || 
                         logic.resultMessage?.toLowerCase().includes('left') ||
                         logic.resultMessage?.toLowerCase().includes('fled');
    
    if (isDisconnect && logic.won) {
      return {
        title: "Opponent Fled",
        subtitle: "Victory by Default",
        icon: UserX,
        theme: "emerald",
        pkr: "+200 PKR", 
        gradient: "from-emerald-500 to-teal-600"
      };
    }

    if (logic.isDraw) {
      return {
        title: "Match Draw",
        subtitle: "Equal Skill Level",
        icon: MinusCircle,
        theme: "amber",
        pkr: "REFUNDED +100",
        gradient: "from-amber-400 to-orange-500"
      };
    }
    
    if (logic.won) {
      return {
        title: "Victory!",
        subtitle: "The Arena is Yours",
        icon: Trophy,
        theme: "emerald",
        pkr: "+200 PKR",
        gradient: "from-emerald-400 to-green-600"
      };
    }
    
    return {
      title: "Defeat",
      subtitle: "Close Match",
      icon: X,
      theme: "red",
      pkr: "-100 PKR",
      gradient: "from-red-500 to-rose-700"
    };
  }, [logic.won, logic.isDraw, logic.resultMessage]);

  const Icon = resultData.icon;

  return (
    <div className="relative h-[100dvh] w-full bg-[#fcfdfd] overflow-hidden select-none font-sans text-slate-800 touch-none">
      <ParticlesBackground />
      
      {/* 🎵 AUDIO ENGINE */}
      <audio ref={logic.tickAudioRef} src="https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/gametimer.mp3" preload="auto" crossOrigin="anonymous" />
      <audio ref={logic.correctAudioRef} src="https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/tap.wav" preload="auto" crossOrigin="anonymous" />
      <audio ref={logic.wrongAudioRef} src="https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/error.mp3" preload="auto" crossOrigin="anonymous" />
      <audio ref={logic.gameOverAudioRef} src="https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/over.wav" preload="auto" crossOrigin="anonymous" />
      <audio ref={logic.winAudioRef} src="https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/win.wav" preload="auto" crossOrigin="anonymous" />
      <audio ref={logic.startSoundRef} src="https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/start.wav" preload="auto" crossOrigin="anonymous" />

      {/* 🏗️ NAVIGATION & HUD */}
      <GameNavbar 
        score={logic.score}
        mode={mode}
        opponentName={logic.opponentName}
        opponentScore={logic.opponentScore}
        highScore={logic.highScore}
        roundTimer={logic.roundTimer}
        onTogglePause={logic.togglePause}
        isReconnecting={logic.reconnectTimer !== null} 
      />

      {/* 🎮 MAIN ARENA */}
      <main className="relative h-full w-full flex items-center justify-center p-4">
        <GameBoard 
          numbers={logic.numbers}
          positions={logic.positions}
          clickedNumbers={logic.clickedNumbers}
          correctNumbers={logic.correctNumbers}
          gameState={logic.gameState}
          error={logic.error}
          isPaused={logic.isPaused}
          handleClick={logic.handleClick}
        />
      </main>

      {/* 🔀 DYNAMIC INTERFACE OVERLAYS */}
      {mode === 'offline' ? (
        <OfflineUI 
           gameState={logic.gameState}
           showTutorial={logic.showTutorial}
           showMenu={logic.showMenu}
           settings={logic.settings}
           startGame={logic.startGame}
           setShowTutorial={logic.setShowTutorial}
           togglePause={logic.togglePause}
           setSettings={logic.setSettings}
           resetGameData={logic.resetGameData}
           onQuit={onQuit}
        />
      ) : (
        <OnlineUI 
           gameState={logic.gameState}
           connectionStatus={logic.connectionStatus}
           waitingForResult={logic.waitingForResult}
           opponentName={logic.opponentName}
        />
      )}

      {/* ⚡ STAGE TRANSITION (Modern Zoom Effect) */}
      {logic.showRoundScreen && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl flex flex-col items-center justify-center z-[90] animate-in fade-in zoom-in-95 duration-500">
          <div className="p-8 rounded-[3rem] bg-white shadow-2xl border border-slate-100 flex flex-col items-center scale-110">
            <span className="text-slate-400 font-black uppercase tracking-[0.5em] text-[10px] mb-4">Phase {logic.round}</span>
            <div className="text-[12rem] font-black text-emerald-500 leading-none tracking-tighter animate-pulse">
              {logic.countdown}
            </div>
          </div>
        </div>
      )}

      {/* 🔄 SYNCING (Modern Glassmorphism) */}
      {logic.gameState === 'syncing' && (
        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-xl flex flex-col items-center justify-center z-[140] animate-in fade-in duration-700">
          <div className="p-10 bg-white rounded-[3rem] shadow-2xl border border-white flex flex-col items-center">
             <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
             </div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Syncing Battle</h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Verifying Arena Data...</p>
          </div>
        </div>
      )}

      {/* 🏆 THE WINNER'S CIRCLE: Result Screen */}
      {logic.gameState === 'gameover' && !logic.waitingForResult && logic.resultMessage && (
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xl flex items-center justify-center z-[150] p-4 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="bg-white rounded-[3.5rem] p-8 max-w-md w-full shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden border border-white">
               
               {/* Decorative Payout Glow */}
               <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-full h-64 bg-${resultData.theme}-500/10 blur-[100px] pointer-events-none`} />

               {/* Icon Header */}
               <div className={`w-28 h-28 rounded-[2.5rem] bg-gradient-to-tr ${resultData.gradient} p-0.5 mx-auto mb-8 shadow-2xl`}>
                  <div className="w-full h-full bg-white rounded-[2.4rem] flex items-center justify-center text-slate-800">
                    <Icon size={48} className={`text-${resultData.theme}-500`} strokeWidth={2.5} />
                  </div>
               </div>

               <div className="text-center mb-8">
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">
                    {resultData.title}
                  </h2>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {resultData.subtitle}
                  </p>
               </div>

               {/* 💰 PKR PAYOUT (Psychology Driven) */}
               {mode === 'online' && (
                 <div className={`mb-10 py-5 px-6 rounded-[2rem] bg-gradient-to-br ${resultData.gradient} shadow-xl shadow-${resultData.theme}-500/20 text-center`}>
                    <div className="flex items-center justify-center gap-2">
                      <Coins size={20} className="text-white/80" />
                      <span className="text-3xl font-black text-white tracking-tighter italic">
                        {resultData.pkr}
                      </span>
                    </div>
                 </div>
               )}

               {/* Score Comparison */}
               <div className="grid grid-cols-3 items-center gap-2 mb-10">
                  <div className="text-center bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100">
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">YOU</span>
                      <div className="text-3xl font-black text-slate-800 tabular-nums">{logic.score}</div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="h-px w-full bg-slate-100" />
                    <span className="text-slate-300 font-black text-[10px] py-2">VS</span>
                    <div className="h-px w-full bg-slate-100" />
                  </div>

                  <div className="text-center bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100">
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {mode === 'online' ? logic.opponentName?.substring(0, 8) : 'RECORD'}
                      </span>
                      <div className={`text-3xl font-black tabular-nums ${mode === 'offline' ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {mode === 'online' ? logic.opponentScore : logic.highScore}
                      </div>
                  </div>
               </div>

               {/* Action Center */}
               <div className="space-y-4">
                  <button 
                    onClick={() => mode === 'offline' ? logic.startGame() : onQuit()} 
                    className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl shadow-slate-300"
                  >
                    {mode === 'offline' ? 'Deploy Again' : 'Dashboard'} <RotateCcw size={16}/>
                  </button>

                  <div className="flex gap-3">
                    {mode === 'offline' && (
                      <button 
                        onClick={onQuit}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                      >
                        Exit <LogOut size={14} />
                      </button>
                    )}
                    <button 
                       onClick={logic.shareScore} 
                       className="flex-1 bg-white border-2 border-slate-100 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all hover:border-slate-300"
                    >
                       Share <Share2 size={14}/>
                    </button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default BubbleGame;