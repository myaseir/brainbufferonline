"use client";
import ParticlesBackground from './ParticlesBackground';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Users, RotateCcw, Volume2, VolumeX, Play, X, Share2, Info, Check, MinusCircle, Loader2, Clock } from 'lucide-react';
import GameNavbar from './GameNavbar'; 

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
  const currentStepRef = useRef(0);
  const [opponentName, setOpponentName] = useState('Opponent'); 
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [isForfeit, setIsForfeit] = useState(false); 
  const [numbers, setNumbers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(false);
  const [clickedNumbers, setClickedNumbers] = useState([]);
  const [correctNumbers, setCorrectNumbers] = useState([]);
  const [isDraw, setIsDraw] = useState(false);
  const opponentFinishedRef = useRef(false);
  const [countdown, setCountdown] = useState(3);
  const [roundTimer, setRoundTimer] = useState(10);
  const [showPerfectRound, setShowPerfectRound] = useState(false);
  const [showRoundScreen, setShowRoundScreen] = useState(false);
  const [won, setWon] = useState(false);
  const [highScore, setHighScore] = useState(0);
const [reconnectTimer, setReconnectTimer] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [settings, setSettings] = useState({ music: true, sfx: true, vibration: true });
const waitingTimeoutRef = useRef(null);
  const roundTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const roundEndTimeRef = useRef(0); 
  const processingClickRef = useRef(new Set());
const scoreRef = useRef(0);
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
        
        if (data.type === 'GAME_START') { 
          clearInterval(readyInterval); 
          serverRoundsRef.current = data.rounds; 
          if(data.opponent_name) setOpponentName(data.opponent_name);
          setScore(data.your_current_score || 0);
          scoreRef.current = data.your_current_score || 0;
          setOpponentScore(data.op_current_score || 0);
          setConnectionStatus('Match Starting...');
          startGame();
        } 
        else if (data.type === 'WAITING_FOR_OPPONENT') {
          // 🔥 Handle the 10s grace period
          setReconnectTimer(data.seconds_left);
        }
        else if (data.type === 'SYNC_STATE') {
          setReconnectTimer(null); // Clear timer once opponent is back
          setOpponentScore(data.opponent_score);
          // Fixed: Check if your_score is defined
          if (data.your_score !== undefined && data.your_score > scoreRef.current){
            setScore(data.your_score);
            scoreRef.current = data.your_score;
          }
        }
        else if (data.type === 'MATCH_ABORTED') {
          clearInterval(readyInterval);
          const leaver = data.leaver_name || 'Opponent';
          setConnectionStatus(`${leaver} left. Refunded.`); 
          setTimeout(() => { if (onRequeue) onRequeue(); else if (onQuit) onQuit(); }, 2000);
        }
        else if (data.type === 'OPPONENT_FORFEIT') {
          setWon(true);
          setIsDraw(false);
          setWaitingForResult(false); 
          setIsForfeit(true); 
          if(data.leaver_name) setOpponentName(data.leaver_name); 
          handleGameOver(true); 
        }
        else if (data.type === 'RESULT') {
          // 1. Immediately stop the "Waiting" spinner
          console.log('RESULT Message Received:', data);
          if (waitingTimeoutRef.current) {
            clearTimeout(waitingTimeoutRef.current);
            waitingTimeoutRef.current = null;
          }
 
          setWaitingForResult(false);
          
          // 2. Update scores from the server for consistency
          setScore(data.my_score);
          scoreRef.current = data.my_score;
          setOpponentScore(data.op_score);
          
          // 3. Set the outcome
          if (data.status === "DRAW") {
            setIsDraw(true);
            setWon(false);
          } else if (data.status === "WON") {
            setWon(true);
            setIsDraw(false);
          } else {
            setWon(false);
            setIsDraw(false);
          }

          // 4. Move to Game Over screen
          setGameState('gameover');
          
          // 5. Clean up any remaining game sounds/timers
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
  
  // --- UPDATED GENERATION LOGIC (Robust Anti-Overlap) ---
  const generatePositions = useCallback((count) => {
      const newPositions = [];
      // Increased safety radius to strictly prevent overlap
      // Assuming 100% viewport, a bubble is approx 15-20% visually depending on screen ratio.
      const safetyRadius = 16; 
      
      for (let i = 0; i < count; i++) {
        let position, attempts = 0, overlaps = true;
        
        // Try up to 1000 times to find a non-overlapping spot
        while (overlaps && attempts < 1000) { 
          attempts++;
          // Margins to keep inside the container (10% to 90%)
          const left = 10 + Math.random() * 80; 
          const top = 10 + Math.random() * 80; 

          const hasCollision = newPositions.some(pos => {
            const dx = pos.left - left;
            // Weigh 'dy' slightly more to account for typical mobile aspect ratios
            const dy = (pos.top - top) * 1.2; 
            const distance = Math.sqrt(dx*dx + dy*dy);
            return distance < safetyRadius; 
          });

          if (!hasCollision) {
            position = { left, top };
            overlaps = false;
          }
        }

        // If we couldn't find a spot (rare), just push it anyway to avoid crash,
        // but the high attempt count usually solves it.
        if (position) newPositions.push(position);
        else newPositions.push({ left: 50, top: 50 }); // Fallback to center
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
        // 🔥 FIX 1: Send GAME_OVER to server when time runs out!
        // Without this, the server thinks you are still playing.
        if (mode === 'online' && socket) {
           socket.send(JSON.stringify({ 
             type: 'GAME_OVER', 
             score: scoreRef.current // Use the Ref to get the latest score
           }));
        }
        
        handleGameOver();
      } else {
        const progress = (roundTotalDuration - msLeft) / roundTotalDuration;
        const visualRemaining = 10 * (1 - progress);
        const secs = Math.max(0, Math.ceil(visualRemaining));
        setRoundTimer(secs);
        if (secs <= 3 && settings.sfx && !document.hidden) {
          if (tickAudioRef.current?.paused) tickAudioRef.current.play().catch(() => {});
        }
      }
    }, 100);
  };

 const startRound = useCallback((roundNum) => {
      clearAllTimers(); 
      setRoundTimer(10); 
      processingClickRef.current.clear();
      
      currentStepRef.current = 0; 
      setCurrentStep(0); 
      
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
      
      // 🔥 FIX 2: Clear the "Double Click Prevention" set
      // If you don't do this, numbers from the previous game remain unclickable!
      processingClickRef.current.clear(); 

      setScore(0);
      scoreRef.current = 0;
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
      setWaitingForResult(false); 
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

  const handleGameOver = (isForfeit = false) => {
    setRoundTimer(0);
    clearAllTimers(); 
    setGameState('gameover');
    
    if (mode === 'online' && socket) {
      if (!isForfeit) {
     setWaitingForResult(true);
    // 🔥 UPDATED: Timeout doesn't set won/isDraw - let RESULT handle it
    
    }
  }
    
    if (settings.sfx && !document.hidden) gameOverAudioRef.current?.play().catch(()=>{});
  };

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
  if (gameState !== 'playing' || isPaused || error) return;
  if (processingClickRef.current.has(num)) return;
  processingClickRef.current.add(num);

  const sorted = [...numbers].sort((a, b) => a - b);
  setClickedNumbers(prev => [...prev, num]);

  if (num === sorted[currentStepRef.current]) {
    // --- ✅ CORRECT CLICK ---
    currentStepRef.current += 1;
    setCurrentStep(prev => prev + 1);
    setCorrectNumbers(prev => [...prev, num]);
    vibrate(50);
    
    if (settings.sfx) correctAudioRef.current?.cloneNode().play().catch(() => {});

    // Update Score Logic
    const pointsPerPop = 10;
    const newScore = scoreRef.current + pointsPerPop;
    scoreRef.current = newScore; 
    setScore(newScore);

    if (newScore > highScore) {
      localStorage.setItem('highScore', newScore);
      setHighScore(newScore);
    }

    // --- 🚀 ROUND COMPLETION LOGIC ---
    if (currentStepRef.current === sorted.length) {
      clearAllTimers();

      // Check if it's the final round
      if (round >= maxRound) {
        if (mode === 'online' && socket) {
          socket.send(JSON.stringify({ type: 'GAME_OVER', score: newScore }));
        }
        setWon(true);
        handleGameOver();
        if (settings.sfx) winAudioRef.current?.play();
      } 
      else {
        // Not the final round: Send a single update for the completed round
        if (mode === 'online' && socket) {
          socket.send(JSON.stringify({ type: 'SCORE_UPDATE', score: newScore }));
        }
        
        // Show "Perfect" feedback
        if (!error) {
          setShowPerfectRound(true);
          setTimeout(() => setShowPerfectRound(false), 1200);
        }

        // Proceed to next round
        setRound(r => r + 1);
        setTimeout(() => startRound(round + 1), 1000);
      }
    }
  } else {
    // --- ❌ WRONG CLICK ---
    clearAllTimers();
    setError(true);
    vibrate(200);
    if (settings.sfx) wrongAudioRef.current?.play();

    setTimeout(() => {
      if (mode === 'online' && socket) {
        socket.send(JSON.stringify({ type: 'GAME_OVER', score: scoreRef.current }));
      }
      handleGameOver();
    }, 600);
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

     <GameNavbar 
  score={score}
  mode={mode}
  opponentName={opponentName}
  opponentScore={opponentScore}
  highScore={highScore}
  roundTimer={roundTimer}
  onTogglePause={togglePause}
  isReconnecting={reconnectTimer !== null}  // 🔥 NEW: Pass derived reconnecting state
/>

      {/* --- PLAY AREA --- */}
      <div className="absolute left-0 right-0 bottom-0 top-[120px]">
        {numbers.map((num, i) => {
          const isClicked = clickedNumbers.includes(num);
          const isCorrect = correctNumbers.includes(num);
          
          // --- UPDATED VISIBILITY LOGIC: Show number if showing, clicked, OR ERROR state exists ---
          const showNumber = gameState === 'showing' || isClicked || error;
          
          return (
            <button
              key={`${round}-${i}`}
              onClick={() => handleClick(num)}
              disabled={gameState !== 'playing' || isPaused || error}
              style={{ left: `${positions[i]?.left}%`, top: `${positions[i]?.top}%` }}
              className={`
                absolute w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-black text-2xl transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 shadow-lg border-2
                ${(gameState === 'showing' || gameState === 'playing') ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}
                
                ${isCorrect ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.6)] scale-110 z-10' : ''}
                
                ${/* UPDATED ERROR STYLING: Only the wrong clicked bubble turns red. No shake. */ ''}
                ${error && isClicked && !isCorrect ? 'bg-red-500 border-red-400 text-white z-20' : ''}
                
                ${/* UPDATED: If error exists but this wasn't the clicked bubble, show neutral style but revealed */ ''}
                ${error && !isClicked && !isCorrect ? 'bg-emerald-100 border-emerald-300 text-emerald-800 opacity-80' : ''}
                
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

{/* {reconnectTimer !== null && (
  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md z-[200] flex items-center justify-center">
    <div className="bg-white p-8 rounded-3xl shadow-2xl text-center animate-pulse">
      <Loader2 className="mx-auto mb-4 animate-spin text-emerald-500" />
      <h2 className="text-xl font-black uppercase tracking-tighter">Opponent Disconnected</h2>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
        Waiting {reconnectTimer}s for reconnection...
      </p>
    </div>
  </div>
)} */}
      {/* --- OVERLAYS --- */}
      {/* 1. START SCREEN */}
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
          <p className="text-slate-500 text-xs font-bold px-4">
    <span className="text-emerald-500">Syncing with server...</span>
</p>
<p className="text-slate-400 text-[10px] uppercase font-bold mt-1">
    Verifying match results
</p>
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

      {/* 4. GAME OVER */}
     {/* --- PROFESSIONAL GAME OVER / WAITING OVERLAY --- */}
{(waitingForResult || gameState === 'gameover') && (
  <div className="absolute inset-0 bg-white/90 backdrop-blur-xl flex items-center justify-center z-[150] p-6 animate-in fade-in zoom-in duration-300">
    <div className="bg-white border border-slate-100 rounded-[3rem] p-10 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] text-center relative overflow-hidden">
      
      {/* Subtle background decorative element */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-20" />

      {waitingForResult ? (
        /* --- WAITING STATE --- */
        <div className="py-8 space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-slate-50 border-t-emerald-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock size={32} className="text-slate-300 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Syncing Result</h2>
            <p className="text-slate-500 text-xs font-bold px-4 leading-relaxed">
              Waiting for <span className="text-emerald-500">@{opponentName}</span> to finalize their sequence...
            </p>
          </div>

          <div className="pt-4">
             <div className="flex justify-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
             </div>
          </div>
        </div>
      ) : (
        /* --- FINAL RESULT STATE --- */
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg transform transition-transform hover:scale-110
            ${isDraw ? 'bg-amber-100 text-amber-600' : (won ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500')}
          `}>
            {isDraw ? <MinusCircle size={40} /> : (won ? <Trophy size={40} /> : <X size={40} />)}
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">
            {isDraw ? "Match Draw" : (won ? "Victory!" : "Defeat")}
          </h2>

          {isForfeit && (
            <div className="inline-block px-3 py-1 bg-emerald-50 rounded-full mb-4">
              <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                Opponent Disconnected
              </p>
            </div>
          )}
          
          {mode === 'online' && (
            <p className={`text-[11px] font-black uppercase tracking-[0.2em] mb-6 
              ${isDraw ? 'text-amber-500' : (won ? 'text-emerald-500' : 'text-red-400')}
            `}>
              {isDraw ? 'Neutral Outcome • Refunded' : (won ? 'Earning: +90 PKR' : 'Loss: -50 PKR')}
            </p>
          )}

          <div className="flex justify-center items-center gap-6 my-8 py-6 border-y border-slate-50">
            <div className="text-center">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Operator</span>
              <span className="text-2xl font-black text-slate-800 leading-none">{score}</span>
            </div>
            
            <div className="w-px h-8 bg-slate-100" />

            <div className="text-center">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
                {mode === 'online' ? opponentName : 'Personal Best'}
              </span>
              <span className={`text-2xl font-black leading-none ${mode === 'offline' ? 'text-emerald-500' : 'text-slate-400'}`}>
                {mode === 'online' ? opponentScore : highScore}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {mode === 'online' && (
              <button onClick={onRestart} className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(16,185,129,0.2)] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98]">
                Find Next Match <Play size={16} fill="currentColor"/>
              </button>
            )}
            
            <button 
              onClick={() => { 
                if (mode === 'offline') { startSoundRef.current?.play(); startGame(); } 
                else { onQuit && onQuit(); } 
              }} 
              className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-lg transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {mode === 'offline' ? 'Re-Initialize' : 'Return to Menu'} <RotateCcw size={16}/>
            </button>

            <button onClick={shareScore} className="w-full bg-slate-50 text-slate-500 font-bold py-3 rounded-xl hover:bg-slate-100 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
              Export Stats <Share2 size={14}/>
            </button>
          </div>
        </div>
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
    </div>
  );
};

export default BubbleGame;