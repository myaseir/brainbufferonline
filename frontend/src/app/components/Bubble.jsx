"use client";
import ParticlesBackground from './ParticlesBackground';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Users, RotateCcw, Volume2, VolumeX, Smartphone, Zap, Play, X, Share2, Info, Check, MinusCircle, Loader2, Clock } from 'lucide-react';

let bgMusicInstance = null;

// --- HELPER: Extract ID from Token ---
const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload).sub; 
  } catch (e) {
    return localStorage.getItem('user_id'); 
  }
};

const BubbleGame = ({ mode = 'offline', socket = null, onQuit = null, onRestart = null, onRequeue = null }) => {
  const [gameState, setGameState] = useState('idle'); 
  const [isPaused, setIsPaused] = useState(false);
  const [opponentScore, setOpponentScore] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...'); 
  const serverRoundsRef = useRef(null); 

  // --- NEW STATES FOR UI ---
  const [opponentName, setOpponentName] = useState('Opponent'); 
  const [waitingForResult, setWaitingForResult] = useState(false);
const [isForfeit, setIsForfeit] = useState(false); // Track if the win was via forfeit
  const [numbers, setNumbers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(false);
  const [clickedNumbers, setClickedNumbers] = useState([]);
  const [correctNumbers, setCorrectNumbers] = useState([]);
  const [isDraw, setIsDraw] = useState(false);
  
  const [countdown, setCountdown] = useState(3);
  const [roundTimer, setRoundTimer] = useState(10);
  const [showPerfectRound, setShowPerfectRound] = useState(false);
  const [showRoundScreen, setShowRoundScreen] = useState(false);
  const [won, setWon] = useState(false);
  const [highScore, setHighScore] = useState(0);

  const [showMenu, setShowMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [settings, setSettings] = useState({ music: true, sfx: true, vibration: true });

  const roundTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const roundEndTimeRef = useRef(0); 
  const processingClickRef = useRef(new Set());

  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const gameOverAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const startSoundRef = useRef(null);
  const tickAudioRef = useRef(null);

  const maxRound = 20;

  useEffect(() => {
    if (typeof window !== 'undefined' && !bgMusicInstance) {
      bgMusicInstance = new Audio('/bgmusic.mp3');
      bgMusicInstance.loop = true;
      bgMusicInstance.preload = "auto";
      bgMusicInstance.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (bgMusicInstance) bgMusicInstance.pause();
        if (tickAudioRef.current) { tickAudioRef.current.pause(); tickAudioRef.current.currentTime = 0; }
      } else {
        if (settings.music && !isPaused && (gameState === 'playing' || gameState === 'showing')) {
          bgMusicInstance?.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [settings.music, isPaused, gameState]);

  // --- SOCKET LOGIC ---
  useEffect(() => {
    if (mode === 'online' && socket) {
      setConnectionStatus('Connected. Waiting for Opponent...');
      let readyInterval = null;

      const sendReady = () => {
        if (socket.readyState === WebSocket.OPEN) {
             socket.send(JSON.stringify({ type: "CLIENT_READY" }));
        }
      };

      sendReady();
      socket.onopen = sendReady;

      readyInterval = setInterval(() => {
        if (serverRoundsRef.current) clearInterval(readyInterval); 
        else sendReady();
      }, 1000);

      const handleSocketMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'MATCH_START') {
            clearInterval(readyInterval); 
            serverRoundsRef.current = data.gameData.rounds;
            
            // --- 1. SET OPPONENT NAME ---
            if(data.opponent) setOpponentName(data.opponent);
            
            setConnectionStatus('Match Starting...');
            startGame();
          } 
          else if (data.type === 'MATCH_ABORTED') {
            clearInterval(readyInterval);
            setConnectionStatus('Opponent left. Re-queuing...');
            setTimeout(() => { if (onRequeue) onRequeue(); else if (onQuit) onQuit(); }, 1500);
          }
          else if (data.type === 'OPPONENT_UPDATE') {
            setOpponentScore(data.score);
          } 
          else if (data.type === 'OPPONENT_FORFEIT') {
    setWon(true);
    setIsDraw(false);
    setWaitingForResult(false); 
    setIsForfeit(true); // ✅ Set the forfeit flag
    if(data.leaver_name) setOpponentName(data.leaver_name); // ✅ Set leaver's name
    
    handleGameOver(true); 
}
else if (data.type === 'MATCH_ABORTED') {
    clearInterval(readyInterval);
    const leaver = data.leaver_name || 'Opponent';
    setConnectionStatus(`${leaver} left. Refunded.`); // ✅ Show leaver name
    setTimeout(() => { if (onRequeue) onRequeue(); else if (onQuit) onQuit(); }, 2000);
}
          else if (data.type === 'RESULT') {
            // --- 2. STOP WAITING WHEN RESULT ARRIVES ---
            setWaitingForResult(false);

            if (data.winner === "DRAW") {
                setIsDraw(true);
                setWon(false);
            } else {
                const myId = getUserIdFromToken(); 
                const winnerId = String(data.winner);
                setWon(myId === winnerId);
                setIsDraw(false);
            }
            setGameState('gameover');
            clearAllTimers();
          }
        } catch (err) { console.error("Socket Error:", err); }
      };

      socket.addEventListener('message', handleSocketMessage);
      return () => {
        socket.removeEventListener('message', handleSocketMessage);
        if (readyInterval) clearInterval(readyInterval);
      };
    }
  }, [mode, socket]);

  // ... (Keep existing Helper Functions: generatePositions, etc.) ...
  useEffect(() => {
      const savedHighScore = parseInt(localStorage.getItem('highScore')) || 0;
      const tutorialSeen = localStorage.getItem('tutorialSeen') === 'true';
      setHighScore(savedHighScore);
      if (!tutorialSeen) setShowTutorial(true);
      return () => clearAllTimers();
  }, []);
  
  const clearAllTimers = useCallback(() => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (tickAudioRef.current) { tickAudioRef.current.pause(); tickAudioRef.current.currentTime = 0; }
  }, []);

  const vibrate = (pattern = 200) => {
      if (settings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  };
  
  const generatePositions = useCallback((count) => {
      const newPositions = [];
      for (let i = 0; i < count; i++) {
        let position, attempts = 0, overlaps = true;
        while (overlaps && attempts < 200) {
          attempts++;
          const left = 10 + Math.random() * 80; 
          const top = 15 + Math.random() * 70;
          const hasCollision = newPositions.some(pos => {
            const dx = pos.left - left;
            const dy = (pos.top - top) * 1.5; 
            return Math.sqrt(dx*dx + dy*dy) < 22; 
          });
          if (!hasCollision) { position = { left, top }; overlaps = false; }
        }
        if (!position) position = { left: 50, top: 50 };
        newPositions.push(position);
      }
      return newPositions;
  }, []);
  
  const generateNumbers = useCallback((count) => {
      const nums = new Set();
      while (nums.size < count) nums.add(Math.floor(Math.random() * 20) + 1);
      return Array.from(nums);
  }, []);

  const startTimer = (durationMs) => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      roundEndTimeRef.current = Date.now() + durationMs; 
      const roundTotalDuration = Math.max(10000 - ((round - 1) * 500), 2000);
  
      roundTimerRef.current = setInterval(() => {
        const now = Date.now();
        const msLeft = roundEndTimeRef.current - now; 
        
        if (msLeft <= 0) {
          handleGameOver();
        } else {
          const progress = (roundTotalDuration - msLeft) / roundTotalDuration;
          const visualRemaining = 10 * (1 - progress);
          const secs = Math.max(0, Math.ceil(visualRemaining));
          setRoundTimer(secs);
          if (secs <= 3 && settings.sfx && !document.hidden) { 
             if (tickAudioRef.current?.paused) tickAudioRef.current.play().catch(()=>{});
          }
        }
      }, 100);
  };

  const startRound = useCallback((roundNum) => {
      clearAllTimers(); 
      setRoundTimer(10); 
      processingClickRef.current.clear();
      setShowRoundScreen(true);
      setCountdown(3);
      
      let counter = 3;
      countdownIntervalRef.current = setInterval(() => {
        counter -= 1;
        if (counter > 0) {
          setCountdown(counter);
        } else {
          clearInterval(countdownIntervalRef.current);
          setShowRoundScreen(false);
  
          if (mode === 'online' && serverRoundsRef.current) {
            const roundData = serverRoundsRef.current[roundNum - 1]; 
            if (roundData) {
              setNumbers(roundData.numbers);
              setPositions(roundData.positions);
            } else {
              const count = Math.min(3 + Math.floor((roundNum - 1) / 2), 8); 
              setNumbers(generateNumbers(count));
              setPositions(generatePositions(count));
            }
          } else {
            const count = Math.min(3 + Math.floor((roundNum - 1) / 2), 8); 
            setNumbers(generateNumbers(count));
            setPositions(generatePositions(count));
          }
  
          setCurrentStep(0);
          setError(false);
          setClickedNumbers([]);
          setCorrectNumbers([]);
          setGameState('showing'); 
        }
      }, 1000);
  }, [mode, generateNumbers, generatePositions, clearAllTimers]);
  
  useEffect(() => {
      if (gameState === 'showing' && !isPaused) {
        const revealTime = Math.max(3000 - (round - 1) * 300, 1000);
        hideTimerRef.current = setTimeout(() => {
          setGameState('playing');
          const realDuration = Math.max(10000 - ((round - 1) * 500), 2000); 
          startTimer(realDuration);
        }, revealTime);
        return () => clearTimeout(hideTimerRef.current);
      }
  }, [gameState, round, isPaused]); 

  const startGame = useCallback(() => {
      if (showTutorial) return; 
      if (mode === 'online' && !serverRoundsRef.current) return;
      clearAllTimers();
      setScore(0);
      setOpponentScore(0);
      setRound(1);
      setWon(false);
      setIsDraw(false);
      setError(false);
      setClickedNumbers([]);
      setCorrectNumbers([]);
      setRoundTimer(10); 
      setIsPaused(false);
      setGameState('idle'); 
      setWaitingForResult(false); // Reset Waiting State
      startRound(1);
      if (settings.music && !document.hidden) bgMusicInstance?.play().catch(() => {});
  }, [mode, startRound, clearAllTimers, showTutorial, settings.music]);

  const togglePause = () => {
    if (gameState === 'idle' || gameState === 'gameover') return;
    if (mode === 'online') return; 

    if (!isPaused) {
        setIsPaused(true);
        setShowMenu(true);
        clearAllTimers(); 
        bgMusicInstance?.pause();
    } else {
        setIsPaused(false);
        setShowMenu(false);
        if (gameState === 'playing') {
           const remaining = roundEndTimeRef.current - Date.now();
           if(remaining > 0) startTimer(remaining); else handleGameOver();
        }
        if (settings.music && !document.hidden) bgMusicInstance?.play().catch(()=>{});
    }
  };

  // 👇 UPDATE THE FUNCTION SIGNATURE to accept isForfeit
  const handleGameOver = (isForfeit = false) => {
    setRoundTimer(0);
    clearAllTimers(); 
    setError(true);
    setGameState('gameover');
    
    // 👇 WRAP THIS LOGIC
    if (mode === 'online' && socket) {
      // Only show "Waiting..." if it wasn't a forfeit
      if (!isForfeit) {
          setWaitingForResult(true);
      }
      socket.send(JSON.stringify({ type: 'GAME_OVER', finalScore: score }));
    }
    
    if (settings.sfx && !document.hidden) gameOverAudioRef.current?.play().catch(()=>{});
  };

  // ... (Keep existing handleClick, resetGameData, shareScore) ...
  const resetGameData = () => {
      if (confirm("Reset high score?")) {
          localStorage.clear();
          setHighScore(0);
          setShowMenu(false);
          setIsPaused(false);
          setGameState('idle');
          window.location.reload(); 
      }
  };
  
  const shareScore = () => {
      const text = `🧠 I scored ${score} on BrainBuffer! High Score: ${highScore}. Can you beat me?`;
      if (navigator.share) {
        navigator.share({ title: 'BrainBuffer', text: text, url: window.location.href }).catch(console.error);
      } else {
        navigator.clipboard.writeText(text);
        alert("Score copied to clipboard!");
      }
  };
  
  const handleClick = (num) => {
      if (gameState !== 'playing' || isPaused) return;
      if (processingClickRef.current.has(num)) return;
      processingClickRef.current.add(num);
  
      const sorted = [...numbers].sort((a, b) => a - b);
      setClickedNumbers(prev => [...prev, num]);
  
      if (num === sorted[currentStep]) {
        setCorrectNumbers(prev => [...prev, num]);
        vibrate(50);
        if(settings.sfx) correctAudioRef.current?.cloneNode().play().catch(()=>{});
  
        if (currentStep + 1 === sorted.length) {
          clearAllTimers(); 
          setRoundTimer(10); 
          const basePoints = numbers.length; 
          const timeBonus = Math.floor(roundTimer); 
          const newScore = score + basePoints + timeBonus;
  
          if (mode === 'online' && socket) socket.send(JSON.stringify({ type: 'SCORE_UPDATE', score: newScore }));
  
          if (newScore > highScore) {
            localStorage.setItem('highScore', newScore);
            setHighScore(newScore);
          }
          setScore(newScore);
  
          if (!error) {
            setShowPerfectRound(true);
            setTimeout(() => setShowPerfectRound(false), 1200);
          }
  
          if (round + 1 > maxRound) {
            if (mode === 'offline') {
              setWon(true);
              handleGameOver();
              if(settings.sfx) winAudioRef.current?.play();
            } else {
              setGameState('showing');
            }
          } else {
            setRound(r => r + 1);
            setTimeout(() => startRound(round + 1), 1000);
          }
        } else {
          setCurrentStep(prev => prev + 1);
        }
      } else {
        clearAllTimers(); 
        setError(true);
        vibrate([200, 100, 200]);
        if(settings.sfx) wrongAudioRef.current?.play();
        if (mode === 'online' && socket) socket.send(JSON.stringify({ type: 'GAME_OVER', finalScore: score }));
        
        setTimeout(() => {
          handleGameOver(); // Use common handler
          if(settings.sfx && !document.hidden) gameOverAudioRef.current?.play();
        }, 500);
      }
  };

  return (
    <div className="relative h-screen w-full bg-[#fcfdfd] overflow-hidden select-none font-sans text-slate-800">
      <ParticlesBackground />
      <audio ref={tickAudioRef} src="/gametimer.mp3" preload="auto" />
      <audio ref={correctAudioRef} src="/tap.wav" preload="auto" />
      <audio ref={wrongAudioRef} src="/error.mp3" preload="auto" />
      <audio ref={gameOverAudioRef} src="/over.wav" preload="auto" />
      <audio ref={winAudioRef} src="/win.wav" preload="auto" />
      <audio ref={startSoundRef} src="/start.wav" />

      {/* --- HUD --- */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
            <Trophy size={18} className="text-yellow-500" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Score</span>
              <span className="font-black text-slate-800 text-lg leading-none">{score}</span>
            </div>
          </div>
          {mode === 'online' && (
            <div className="bg-white/90 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
              <Users size={18} className="text-red-400" />
              <div>
                {/* --- 4. USE REAL OPPONENT NAME --- */}
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider truncate max-w-[80px]">{opponentName}</span>
                <span className="font-black text-slate-600 text-sm leading-none">{opponentScore}</span>
              </div>
            </div>
          )}
          {mode === 'offline' && (
            <div className="bg-white/50 backdrop-blur-sm px-3 py-1 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100">
              Best: {highScore}
            </div>
          )}
        </div>

        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-4">
          <div className={`bg-white/90 backdrop-blur-xl border border-slate-100 px-6 py-3 rounded-2xl shadow-lg transition-all duration-300 ${roundTimer <= 3 ? 'border-red-200 shadow-red-100 animate-pulse' : ''}`}>
            <span className={`font-mono text-3xl font-black ${roundTimer <= 3 ? 'text-red-500' : 'text-slate-800'}`}>{roundTimer}</span>
          </div>
        </div>

        {mode === 'offline' && (
          <button onClick={togglePause} className="bg-white/90 backdrop-blur-md border border-slate-100 p-3 rounded-2xl shadow-sm hover:text-emerald-500 transition-colors pointer-events-auto active:scale-90">
            <div className="space-y-1"><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div><div className="w-5 h-0.5 bg-slate-400 rounded-full"></div></div>
          </button>
        )}
      </div>

      {/* --- PLAY AREA --- */}
      <div className="absolute inset-0 pt-20">
        {numbers.map((num, i) => {
          const isClicked = clickedNumbers.includes(num);
          const isCorrect = correctNumbers.includes(num);
          const showNumber = gameState === 'showing' || isClicked;
          return (
            <button
              key={`${round}-${i}`}
              onClick={() => handleClick(num)}
              disabled={gameState !== 'playing' || isPaused}
              style={{ left: `${positions[i]?.left}%`, top: `${positions[i]?.top}%` }}
              className={`
                absolute w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-black text-2xl transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 shadow-lg border-2
                ${(gameState === 'showing' || gameState === 'playing') ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}
                ${isCorrect ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.6)] scale-110 z-10' : ''}
                ${error && !correctNumbers.includes(num) ? 'bg-red-500 border-red-400 text-white animate-shake' : ''}
                ${!isCorrect && !error ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200' : ''}
                ${isClicked && !isCorrect && !error ? 'opacity-50' : ''}
                active:scale-95 cursor-pointer
              `}
            >
              <span className={`drop-shadow-sm transition-opacity duration-300 ${showNumber ? 'opacity-100' : 'opacity-0'}`}>{num}</span>
              {isCorrect && <Check className="absolute text-white/80 w-full h-full p-4 animate-ping opacity-75" />}
            </button>
          );
        })}
      </div>

      {/* --- OVERLAYS --- */}
      {/* 1. START SCREEN (STRICTLY OFFLINE ONLY) */}
      {gameState === 'idle' && mode === 'offline' && !showTutorial && !showRoundScreen && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-lg flex flex-col items-center justify-center z-50 px-4">
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

      {/* 2. ONLINE SYNCHRONIZING */}
      {gameState === 'idle' && mode === 'online' && !showRoundScreen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-white/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest animate-pulse">{connectionStatus}</p>
          <p className="text-slate-400 text-[10px] uppercase mt-2">Waiting for opponent...</p>
        </div>
      )}

      {/* 3. TUTORIAL OVERLAY */}
      {showTutorial && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center border border-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-sm border border-emerald-100"><Info size={32} /></div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6">Protocol</h2>
            <div className="text-left space-y-3 mb-8">
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-transform hover:scale-[1.02]">
                <span className="w-8 h-8 shrink-0 rounded-full bg-white flex items-center justify-center font-black text-emerald-500 shadow-sm border border-emerald-100">1</span>
                <div><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Observation</span><p className="text-xs font-black text-slate-700 uppercase tracking-wide">Memorize the numbers</p></div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-transform hover:scale-[1.02]">
                <span className="w-8 h-8 shrink-0 rounded-full bg-white flex items-center justify-center font-black text-emerald-500 shadow-sm border border-emerald-100">2</span>
                <div><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Patience</span><p className="text-xs font-black text-slate-700 uppercase tracking-wide">Wait for bubbles to hide</p></div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-transform hover:scale-[1.02]">
                <span className="w-8 h-8 shrink-0 rounded-full bg-white flex items-center justify-center font-black text-emerald-500 shadow-sm border border-emerald-100">3</span>
                <div><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Execution</span><p className="text-xs font-black text-slate-700 uppercase tracking-wide">Tap in ascending order</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setShowTutorial(false); localStorage.setItem('tutorialSeen', 'true'); if(mode === 'offline') startGame(); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-2">Start Mission <Play size={16} /></button>
              {onQuit && <button onClick={onQuit} className="w-full text-slate-400 font-bold py-3 rounded-xl hover:text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">Back to Dashboard</button>}
            </div>
          </div>
        </div>
      )}

      {/* 4. GAME OVER (UPDATED) */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-lg flex items-center justify-center z-[100] p-6">
          <div className="bg-white border border-slate-100 rounded-[3rem] p-10 max-w-sm w-full shadow-2xl text-center">
            
            {/* --- 5. CONDITIONAL VIEW: WAITING vs RESULT --- */}
            {waitingForResult ? (
               <div className="py-10 animate-pulse">
                  <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6 shadow-sm">
                     <Clock size={40} className="text-slate-400" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                     Wait...
                  </h2>
                  <p className="text-slate-500 text-xs font-bold px-4">
                     <span className="text-emerald-500">{opponentName}</span> is still playing.
                  </p>
               </div>
            ) : (
               /* --- NORMAL RESULT VIEW --- */
               <>
  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg 
    ${isDraw ? 'bg-amber-100 text-amber-600' : (won ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500')}
  `}>
    {isDraw ? <MinusCircle size={40} /> : (won ? <Trophy size={40} /> : <X size={40} />)}
  </div>
  
  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">
    {isDraw ? "Match Draw" : (won ? "Victory!" : "Defeat")}
  </h2>

  {/* ✅ ADD THIS BLOCK BELOW THE TITLE */}
  {isForfeit && (
    <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-4 animate-bounce">
       {opponentName} fled the match!
    </p>
  )}
  
  {mode === 'online' && (
    <p className={`text-xs font-black uppercase tracking-widest mb-6 
      ${isDraw ? 'text-amber-500' : (won ? 'text-emerald-500' : 'text-red-400')}
    `}>
      {/* 💰 Update logic to 90/10 as requested earlier */}
      {isDraw ? 'Entry Fee Refunded' : (won ? 'Profit: +90 PKR' : 'Loss: -50 PKR')}
    </p>
  )}

                <div className="flex justify-center gap-8 my-8 pb-8 border-b border-slate-50">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">You</span>
                    <span className="text-2xl font-black text-slate-800">{score}</span>
                  </div>
                  {mode === 'online' && (
                    <>
                      <div className="w-px h-10 bg-slate-100 mt-2"></div>
                      <div className="text-center">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[60px]">{opponentName}</span>
                        <span className="text-2xl font-black text-slate-500">{opponentScore}</span>
                      </div>
                    </>
                  )}
                  {mode === 'offline' && (
                    <>
                      <div className="w-px h-10 bg-slate-100 mt-2"></div>
                      <div className="text-center">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Best</span>
                        <span className="text-2xl font-black text-emerald-500">{highScore}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  {mode === 'online' && (
                    <button onClick={onRestart} className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-95">
                      Find New Match <Play size={16}/>
                    </button>
                  )}
                  <button onClick={() => { if (mode === 'offline') { startSoundRef.current?.play(); startGame(); } else { onQuit && onQuit(); } }} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                    {mode === 'offline' ? 'Re-Initialize' : 'Return to Menu'} <RotateCcw size={16}/>
                  </button>
                  <button onClick={shareScore} className="w-full bg-emerald-50 text-emerald-600 font-black py-4 rounded-xl hover:bg-emerald-100 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                    Share Data <Share2 size={16}/>
                  </button>
                </div>
               </>
            )}
          </div>
        </div>
      )}

      {/* 5. PAUSE MENU */}
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
                   if(!newVal) bgMusicInstance?.pause(); else if(bgMusicInstance?.paused) bgMusicInstance?.play();
                }} className={`p-2 rounded-lg transition-all ${settings.music ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  {settings.music ? <Volume2 size={20}/> : <VolumeX size={20}/>}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={togglePause} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors">Resume</button>
              <button onClick={resetGameData} className="w-full bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:text-red-500 hover:border-red-200">Reset Data</button>
              <button onClick={() => { togglePause(); setGameState('idle'); clearAllTimers(); onQuit && onQuit(); }} className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4 hover:text-slate-600">Quit Mission</button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ROUND TRANSITION */}
      {showRoundScreen && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center z-[90] animate-in fade-in duration-300">
          <span className="text-slate-400 font-bold uppercase tracking-[0.4em] mb-6">Stage {round}</span>
          <div className="text-9xl font-black text-emerald-500 tracking-tighter animate-pulse">{countdown}</div>
        </div>
      )}

      {/* 7. PERFECT ROUND */}
      {showPerfectRound && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-8 py-2 rounded-full font-black uppercase tracking-widest shadow-lg shadow-emerald-200 z-[80] animate-in slide-in-from-top-4 duration-300">
          Perfect!
        </div>
      )}

      <style jsx>{`
        @keyframes shake { 0%, 100% { transform: translate(-50%, -50%); } 25% { transform: translate(-52%, -50%); } 75% { transform: translate(-48%, -50%); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default BubbleGame;