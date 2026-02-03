import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameAudio } from './useGameAudio';
import { useGameGeneration } from './useGameGeneration';
import { toast } from 'react-hot-toast';

export const useBubbleGame = ({ mode, socket, onQuit, onRestart, onRequeue }) => {
  // --- 1. CORE STATE ---
  const [gameState, setGameState] = useState('idle'); 
  const [isPaused, setIsPaused] = useState(false);
  
  // --- 2. LOAD SUB-HOOKS ---
  const { 
    settings, setSettings, vibrate, playSound, bgMusicInstance, refs: audioRefs 
  } = useGameAudio(gameState, isPaused);
  
  const { generatePositions, generateNumbers } = useGameGeneration();

  // --- 3. GAME STATE ---
  const [opponentScore, setOpponentScore] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...'); 
  const [opponentName, setOpponentName] = useState('Opponent'); 
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [resultMessage, setResultMessage] = useState(null); 
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
  const [countdown, setCountdown] = useState(3);
  const [roundTimer, setRoundTimer] = useState(10);
  const [showPerfectRound, setShowPerfectRound] = useState(false);
  const [showRoundScreen, setShowRoundScreen] = useState(false);
  const [won, setWon] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [reconnectTimer, setReconnectTimer] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // --- REFS ---
  const serverRoundsRef = useRef(null); 
  const currentStepRef = useRef(0);
  const waitingTimeoutRef = useRef(null);
  const roundTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const roundEndTimeRef = useRef(0); 
  const processingClickRef = useRef(new Set());
  const scoreRef = useRef(0);
  
  // 🔒 THE KILL SWITCH REF
  const matchEndedRef = useRef(false);
  
  const maxRound = 20;

  // --- TIMERS & CLEANUP ---
  const clearAllTimers = useCallback(() => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (audioRefs.tick.current) { 
          audioRefs.tick.current.pause(); 
          audioRefs.tick.current.currentTime = 0; 
      }
  }, [audioRefs.tick]);

  // --- GAME LOOP LOGIC ---
  const handleGameOver = (isForfeit = false) => {
    clearAllTimers(); 
    setRoundTimer(0); 
    setGameState('gameover');
    
    if (mode === 'online' && socket && !isForfeit) {
       setWaitingForResult(true);
    }
    playSound(audioRefs.gameOver);
  };

  const startTimer = (durationMs) => {
    if (matchEndedRef.current) return; // 🔒 Stop if match is dead

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundEndTimeRef.current = Date.now() + durationMs;
    const roundTotalDuration = Math.max(10000 - ((round - 1) * 500), 2000);

    roundTimerRef.current = setInterval(() => {
      if (matchEndedRef.current) { clearInterval(roundTimerRef.current); return; } // 🔒 Double check

      const now = Date.now();
      const msLeft = roundEndTimeRef.current - now;

      if (msLeft <= 0) {
        clearInterval(roundTimerRef.current);
        setRoundTimer(0);
        
        if (mode === 'online' && socket) {
           socket.send(JSON.stringify({ type: 'GAME_OVER', score: scoreRef.current }));
        }
        handleGameOver();
      } else {
        const progress = (roundTotalDuration - msLeft) / roundTotalDuration;
        const visualRemaining = 10 * (1 - progress);
        const secs = Math.max(0, Math.ceil(visualRemaining));
        setRoundTimer(secs);
        if (secs <= 3 && !document.hidden) {
          if (audioRefs.tick.current?.paused) playSound(audioRefs.tick);
        }
      }
    }, 100);
  };

  const startRound = useCallback((roundNum) => {
      if (matchEndedRef.current) return; // 🔒 

      clearAllTimers(); 
      setRoundTimer(10); 
      processingClickRef.current.clear();
      currentStepRef.current = 0; 
      setCurrentStep(0); 
      setShowRoundScreen(true);
      setCountdown(3);
      
      let counter = 3;
      countdownIntervalRef.current = setInterval(() => {
        if (matchEndedRef.current) { clearInterval(countdownIntervalRef.current); return; } // 🔒

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

  const startGame = useCallback(() => {
      if (mode === 'online' && !serverRoundsRef.current) return;
      
      // Reset everything strictly
      matchEndedRef.current = false; // 🔓 Unlock
      clearAllTimers();
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
      setResultMessage(null); 
      startRound(1);
      if (settings.music && !document.hidden) bgMusicInstance?.play().catch(() => {});
  }, [mode, startRound, clearAllTimers, settings.music, bgMusicInstance]);

  // --- CLICK HANDLER ---
  const handleClick = (num) => {
    // 🔒 Strict Block
    if (matchEndedRef.current || gameState !== 'playing' || isPaused || error) return;
    
    if (processingClickRef.current.has(num)) return;
    processingClickRef.current.add(num);
    
    const sorted = [...numbers].sort((a, b) => a - b);
    setClickedNumbers(prev => [...prev, num]);

    if (num === sorted[currentStepRef.current]) {
      currentStepRef.current += 1;
      setCurrentStep(prev => prev + 1);
      setCorrectNumbers(prev => [...prev, num]);
      vibrate(50);
      playSound(audioRefs.correct);

      const pointsPerPop = 10;
      const newScore = scoreRef.current + pointsPerPop;
      scoreRef.current = newScore; 
      setScore(newScore);

      if (newScore > highScore) {
        localStorage.setItem('highScore', newScore);
        setHighScore(newScore);
      }

      if (currentStepRef.current === sorted.length) {
        clearAllTimers();
        if (round >= maxRound) {
          if (mode === 'online' && socket) {
            socket.send(JSON.stringify({ type: 'GAME_OVER', score: newScore }));
            setWaitingForResult(true);
          } else {
            setWon(true);
            playSound(audioRefs.win);
          }
          handleGameOver();
        } else {
          if (mode === 'online' && socket) {
            socket.send(JSON.stringify({ type: 'SCORE_UPDATE', score: newScore }));
          }
          if (!error) {
            setShowPerfectRound(true);
            setTimeout(() => setShowPerfectRound(false), 1200);
          }
          setRound(r => r + 1);
          setTimeout(() => startRound(round + 1), 1000);
        }
      }
    } else {
      clearAllTimers();
      setError(true);
      vibrate(200);
      playSound(audioRefs.wrong);

      setTimeout(() => {
        if (mode === 'online' && socket) {
          socket.send(JSON.stringify({ type: 'GAME_OVER', score: scoreRef.current }));
        }
        handleGameOver();
      }, 600);
    }
  };

  // --- ACTIONS ---
  const togglePause = () => {
    if (matchEndedRef.current || gameState === 'idle' || gameState === 'gameover') return;
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

  // --- SOCKET EFFECT ---
  useEffect(() => {
    if (mode === 'online' && socket) {
      setConnectionStatus('Connected. Waiting for Opponent...');
      let readyInterval = null;

      const sendReady = () => {
         if (socket.readyState === WebSocket.OPEN && !serverRoundsRef.current) {
            console.log("Sending CLIENT_READY...");
            socket.send(JSON.stringify({ type: "CLIENT_READY" }));
         }
      };

      sendReady();
      socket.onopen = sendReady;

      readyInterval = setInterval(() => {
        if (serverRoundsRef.current) {
            clearInterval(readyInterval); 
        } else {
            sendReady();
        }
      }, 1000);

      const handleSocketMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // 🛡️ SECURITY: If match is declared dead, IGNORE ALL future syncs/updates
          if (matchEndedRef.current && data.type !== 'MATCH_ABORTED') {
             console.warn("Ignoring packet (Match Ended):", data.type);
             return; 
          }

          if (data.type === 'GAME_START') { 
            console.log("GAME STARTED!");
            clearInterval(readyInterval); 
            setShowTutorial(false); 
            matchEndedRef.current = false; // Ensure it's unlocked
            
            serverRoundsRef.current = data.rounds; 
            if(data.opponent_name) setOpponentName(data.opponent_name);
            setScore(data.your_current_score || 0);
            scoreRef.current = data.your_current_score || 0;
            setOpponentScore(data.op_current_score || 0);
            setConnectionStatus('Match Starting...');
            startGame();
          } 
          else if (data.type === 'WAITING_FOR_OPPONENT') {
            setReconnectTimer(data.seconds_left);
          }
          else if (data.type === 'SYNC_STATE') {
            setReconnectTimer(null);
            setOpponentScore(data.opponent_score);
            if (data.your_score !== undefined && data.your_score > scoreRef.current){
              setScore(data.your_score);
              scoreRef.current = data.your_score;
            }
          }
          else if (data.type === 'OPPONENT_FINISHED') {
             setOpponentScore(data.score);
             toast.success(`Opponent Finished! Score: ${data.score}`, { icon: '🏁' });
          }
          // 🚨 CRITICAL FIX: MATCH ABORTED LOGIC
          else if (data.type === 'MATCH_ABORTED') {
            matchEndedRef.current = true; // 🔒 LOCK THE GAME IMMEDIATELY
            clearAllTimers();
            
            clearInterval(readyInterval);
            const leaver = data.leaver_name || 'Opponent';
            setConnectionStatus(`${leaver} left. Refunded.`); 
            
            // Force game over state so UI blocks interaction
            setGameState('gameover');
            setResultMessage(`${leaver} Disconnected`);
            
            setTimeout(() => { if (onRequeue) onRequeue(); else if (onQuit) onQuit(); }, 3000);
          }
          // 🚨 CRITICAL FIX: RESULT LOGIC
          else if (data.type === 'RESULT') {
            matchEndedRef.current = true; // 🔒 LOCK THE GAME IMMEDIATELY
            clearAllTimers();
            
            socket.onclose = null;
            socket.onerror = null;
            
            if (waitingTimeoutRef.current) {
              clearTimeout(waitingTimeoutRef.current);
              waitingTimeoutRef.current = null;
            }
            
            setWaitingForResult(false);
            setScore(data.my_score);
            scoreRef.current = data.my_score;
            setOpponentScore(data.op_score);

            if (data.summary) {
              setResultMessage(data.summary);
            }

            if (data.status === "DRAW") {
              setIsDraw(true); setWon(false);
            } else if (data.status === "WON") {
              setWon(true); setIsDraw(false);
              playSound(audioRefs.win);
            } else {
              setWon(false); setIsDraw(false);
              playSound(audioRefs.gameOver);
            }
            setGameState('gameover'); 
          }
        } catch (err) { console.error("Socket Error:", err); }
      };

      socket.onclose = (e) => {
        if (matchEndedRef.current || e.code === 1000) return; 
        setGameState(current => {
          if (current === 'gameover') return current; 
          if (onQuit) onQuit(); 
          return current;
        });
      };

      socket.addEventListener('message', handleSocketMessage);
      return () => {
        socket.removeEventListener('message', handleSocketMessage);
        if (readyInterval) clearInterval(readyInterval);
      };
    }
  }, [mode, socket, onQuit, startGame, clearAllTimers, onRequeue, playSound, audioRefs]);

  // ... (Remainder of effects are unchanged) ...
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

  useEffect(() => {
      const savedHighScore = parseInt(localStorage.getItem('highScore')) || 0;
      const tutorialSeen = localStorage.getItem('tutorialSeen') === 'true';
      setHighScore(savedHighScore);
      if (!tutorialSeen) setShowTutorial(true);
      return () => clearAllTimers();
  }, [clearAllTimers]);

  return {
    gameState, isPaused, opponentScore, connectionStatus, opponentName,
    waitingForResult, isForfeit, numbers, positions, score, round,
    currentStep, error, clickedNumbers, correctNumbers, isDraw, won,
    countdown, roundTimer, showPerfectRound, showRoundScreen, highScore,
    reconnectTimer, showMenu, showTutorial, settings, resultMessage,
    setSettings, setShowTutorial, startGame, togglePause, handleClick,
    shareScore, resetGameData, 
    startSoundRef: audioRefs.start,
    tickAudioRef: audioRefs.tick,
    correctAudioRef: audioRefs.correct,
    wrongAudioRef: audioRefs.wrong,
    gameOverAudioRef: audioRefs.gameOver,
    winAudioRef: audioRefs.win
  };
};