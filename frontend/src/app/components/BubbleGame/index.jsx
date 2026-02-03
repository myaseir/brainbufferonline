"use client";
import React, { useMemo } from 'react';
import ParticlesBackground from '../ParticlesBackground';
import GameNavbar from '../GameNavbar'; 
import GameBoard from './GameBoard';
import OfflineUI from './OfflineUI';
import OnlineUI from './OnlineUI';
import { 
  Trophy, X, MinusCircle, RotateCcw, Share2, 
  Coins, UserX, AlertTriangle, LogOut // ✅ Added LogOut Icon
} from 'lucide-react';
import { useBubbleGame } from '../../hooks/useBubbleGame'; 

const BubbleGame = ({ mode = 'offline', socket = null, onQuit = null, onRestart = null, onRequeue = null }) => {
  
  // 🧠 THE BRAIN
  const logic = useBubbleGame({ mode, socket, onQuit, onRestart, onRequeue });

  // 🎨 HELPER: Determine Result Styling & Data
  const resultData = useMemo(() => {
    // 1. Check for Disconnects first based on the summary message
    const isDisconnect = logic.resultMessage?.toLowerCase().includes('disconnected') || logic.resultMessage?.toLowerCase().includes('left');
    
    if (isDisconnect && logic.won) {
      return {
        title: "Opponent Fled",
        subtitle: "Automatic Victory",
        icon: UserX,
        color: "emerald",
        bg: "bg-emerald-50",
        text: "text-emerald-600",
        border: "border-emerald-100",
        pkr: "+90 PKR",
        pkrColor: "text-emerald-600"
      };
    }

    // 2. Standard Outcomes
    if (logic.isDraw) {
      return {
        title: "Match Draw",
        subtitle: "Equal Proficiency",
        icon: MinusCircle,
        color: "amber",
        bg: "bg-amber-50",
        text: "text-amber-600",
        border: "border-amber-100",
        pkr: "REFUNDED",
        pkrColor: "text-amber-500"
      };
    }
    
    if (logic.won) {
      return {
        title: "Victory!",
        subtitle: "Dominant Performance",
        icon: Trophy,
        color: "emerald",
        bg: "bg-emerald-50",
        text: "text-emerald-600",
        border: "border-emerald-100",
        pkr: "+90 PKR",
        pkrColor: "text-emerald-600"
      };
    }
    
    // Loss
    return {
      title: "Defeat",
      subtitle: "Better Luck Next Time",
      icon: X,
      color: "red",
      bg: "bg-red-50",
      text: "text-red-500",
      border: "border-red-100",
      pkr: "-50 PKR",
      pkrColor: "text-red-500"
    };
  }, [logic.won, logic.isDraw, logic.resultMessage]);

  const Icon = resultData.icon;

  return (
    <div className="relative h-screen w-full bg-[#fcfdfd] overflow-hidden select-none font-sans text-slate-800">
      <ParticlesBackground />
      
      {/* Audio Elements */}
      <audio ref={logic.tickAudioRef} src="/gametimer.mp3" preload="auto" />
      <audio ref={logic.correctAudioRef} src="/tap.wav" preload="auto" />
      <audio ref={logic.wrongAudioRef} src="/error.mp3" preload="auto" />
      <audio ref={logic.gameOverAudioRef} src="/over.wav" preload="auto" />
      <audio ref={logic.winAudioRef} src="/win.wav" preload="auto" />
      <audio ref={logic.startSoundRef} src="/start.wav" />

      {/* Top Bar */}
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

      {/* 🎮 SHARED GAME BOARD */}
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

      {/* 🔀 DYNAMIC OVERLAYS */}
      {mode === 'offline' ? (
        <OfflineUI 
           gameState={logic.gameState}
           showTutorial={logic.showTutorial}
           showMenu={logic.showMenu}
           settings={logic.settings}
           startSoundRef={logic.startSoundRef}
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

      {/* Round Transition */}
      {logic.showRoundScreen && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center z-[90] animate-in fade-in duration-300">
          <span className="text-slate-400 font-bold uppercase tracking-[0.4em] mb-6">Stage {logic.round}</span>
          <div className="text-9xl font-black text-emerald-500 tracking-tighter animate-pulse">{logic.countdown}</div>
        </div>
      )}

      {/* 🏆 PROFESSIONAL RESULT SCREEN */}
      {logic.gameState === 'gameover' && !logic.waitingForResult && (
         <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-xl flex items-center justify-center z-[150] p-6 animate-in fade-in zoom-in duration-300">
             <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden border border-white/50">
                
                {/* Decorative Background Glow for Winners */}
                {logic.won && (
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-emerald-100/50 to-transparent blur-3xl -z-10 pointer-events-none" />
                )}

                {/* 1. STATUS ICON */}
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl transform transition-transform hover:scale-105 border-4 border-white ${resultData.bg} ${resultData.text}`}>
                  <Icon size={48} strokeWidth={2.5} />
                </div>

                {/* 2. HEADLINES */}
                <div className="text-center mb-6">
                   <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">
                     {resultData.title}
                   </h2>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                     {resultData.subtitle}
                   </p>
                </div>

                {/* 3. FINANCIAL RESULT (Online Only) */}
                {mode === 'online' && (
                  <div className={`flex items-center justify-center gap-2 mb-8 py-3 px-6 rounded-2xl border ${resultData.bg} ${resultData.border}`}>
                     <Coins size={18} className={resultData.pkrColor} />
                     <span className={`text-lg font-black ${resultData.pkrColor}`}>
                       {resultData.pkr}
                     </span>
                  </div>
                )}

                {/* 4. SCOREBOARD */}
                <div className="flex justify-between items-center gap-4 mb-8">
                    {/* User */}
                    <div className="flex-1 text-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">You</span>
                        <div className="text-2xl font-black text-slate-800">{logic.score}</div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-slate-300 font-black text-xs">VS</div>

                    {/* Opponent */}
                    <div className="flex-1 text-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                           {mode === 'online' ? logic.opponentName : 'Best'}
                         </span>
                         <div className={`text-2xl font-black ${mode === 'offline' ? 'text-emerald-500' : 'text-slate-400'}`}>
                           {mode === 'online' ? logic.opponentScore : logic.highScore}
                         </div>
                    </div>
                </div>

                {/* 5. SPECIFIC MESSAGE (Disconnects, etc) */}
                {logic.resultMessage && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wide mb-6 text-center flex items-center justify-center gap-2">
                    <AlertTriangle size={14} className="text-slate-400"/>
                    {logic.resultMessage}
                  </div>
                )}

                {/* 6. ACTIONS */}
                <div className="space-y-3">
                   {/* PRIMARY BUTTON: Replay (Offline) OR Return (Online) */}
                   <button 
                      onClick={() => mode === 'offline' ? logic.startGame() : onQuit()} 
                      className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
                   >
                      {mode === 'offline' ? 'Replay Mission' : 'Return to Dashboard'} <RotateCcw size={16}/>
                   </button>

                   {/* ✅ NEW BUTTON: Exit (Offline Only) */}
                   {mode === 'offline' && (
                     <button 
                        onClick={onQuit}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                     >
                        Exit to Menu <LogOut size={16} />
                     </button>
                   )}
                   
                   {/* SHARE BUTTON */}
                   <button onClick={logic.shareScore} className="w-full bg-white border-2 border-slate-100 text-slate-500 font-bold py-3 rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                      Share Result <Share2 size={14}/>
                   </button>
                </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default BubbleGame;