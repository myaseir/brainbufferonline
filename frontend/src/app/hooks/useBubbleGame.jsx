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
  const roundTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const roundEndTimeRef = useRef(0); 
  const processingClickRef = useRef(new Set());
  const scoreRef = useRef(0);
  const matchEndedRef = useRef(false); // 🔒 THE KILL SWITCH

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
 const handleGameOver = (forfeit = false) => {
    if (matchEndedRef.current) return;

    clearAllTimers(); 
    setRoundTimer(0); 
    setIsForfeit(forfeit);
    
    if (mode === 'online') {
        // 1. Enter a specific "Syncing" state instead of generic "gameover"
        setGameState('syncing'); 
        setWaitingForResult(true);
        
        if (socket && socket.readyState === WebSocket.OPEN && !forfeit) {
            socket.send(JSON.stringify({ type: 'GAME_OVER', score: scoreRef.current }));
        }
    } else {
        // Offline mode can jump straight to gameover
        setGameState('gameover');
        setWon(score > highScore);
    }
    
    playSound(audioRefs.gameOver);
  };

  const startTimer = (durationMs) => {
    if (matchEndedRef.current) return;

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundEndTimeRef.current = Date.now() + durationMs;
    const roundTotalDuration = Math.max(10000 - ((round - 1) * 500), 2000);

    roundTimerRef.current = setInterval(() => {
      if (matchEndedRef.current) { 
        clearInterval(roundTimerRef.current); 
        return; 
      }

      const now = Date.now();
      const msLeft = roundEndTimeRef.current - now;

      if (msLeft <= 0) {
        clearInterval(roundTimerRef.current);
        setRoundTimer(0);
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
      if (matchEndedRef.current) return;

      clearAllTimers(); 
      setRoundTimer(10); 
      processingClickRef.current.clear();
      currentStepRef.current = 0; 
      setCurrentStep(0); 
      setShowRoundScreen(true);
      setCountdown(3);
      
      let counter = 3;
      countdownIntervalRef.current = setInterval(() => {
        if (matchEndedRef.current) { 
            clearInterval(countdownIntervalRef.current); 
            return; 
        }

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
      matchEndedRef.current = false; 
      clearAllTimers();
      processingClickRef.current.clear(); 

      setScore(0);
      scoreRef.current = 0;
      setOpponentScore(0);
      setRound(1);
      setWon(false);
      setIsDraw(false);
      setError(false);
      setIsForfeit(false);
      setClickedNumbers([]);
      setCorrectNumbers([]);
      setRoundTimer(10); 
      setIsPaused(false);
      setGameState('idle'); 
      setWaitingForResult(false); 
      setResultMessage(null); 
      startRound(1);
      if (settings.music && !document.hidden) bgMusicInstance?.play().catch(() => {});
  }, [startRound, clearAllTimers, settings.music, bgMusicInstance]);

  // --- CLICK HANDLER ---
  const handleClick = (num) => {
    // 🔒 Critical: If server already ended the match, ignore all clicks
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
          handleGameOver();
        } else {
          if (mode === 'online' && socket) {
            socket.send(JSON.stringify({ type: 'SCORE_UPDATE', score: newScore }));
          }
          setShowPerfectRound(true);
          setTimeout(() => setShowPerfectRound(false), 1200);
          setRound(r => r + 1);
          setTimeout(() => startRound(round + 1), 1000);
        }
      }
    } else {
      clearAllTimers();
      setError(true);
      vibrate(200);
      playSound(audioRefs.wrong);
      // In online mode, we wait for server to tell us we lost, but locally we stop game
      setTimeout(() => handleGameOver(), 600);
    }
  };

  // --- ACTIONS ---
  const togglePause = () => {
    if (matchEndedRef.current || mode === 'online' || gameState === 'idle' || gameState === 'gameover') return; 

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

  // --- 🚀 STATUS WATCHER (HEARTBEAT) ---
  // If the user's internet is slow, this helps detect if the server already ended the match
  useEffect(() => {
    if (mode !== 'online' || gameState !== 'playing' || !socket || socket.readyState !== WebSocket.OPEN) return;

    const statusCheck = setInterval(() => {
        socket.send(JSON.stringify({ type: 'PING' }));
    }, 5000);

    return () => clearInterval(statusCheck);
  }, [mode, gameState, socket]);

  // --- SOCKET EFFECT ---
  useEffect(() => {
    if (mode === 'online' && socket) {
      setConnectionStatus('Awaiting Arena Initialization...');

      const handleSocketMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // If match is already marked as ended locally, only allow specific "un-abort" messages if applicable
          // Otherwise, ignore game state updates once match is finalized
          if (matchEndedRef.current && data.type !== 'RESULT' && data.type !== 'MATCH_ABORTED') return; 

          if (data.type === 'GAME_START') { 
            console.log("🚀 BATTLE START");
            setShowTutorial(false); 
            matchEndedRef.current = false;
            setReconnectTimer(null);
            
            serverRoundsRef.current = data.rounds; 
            if(data.opponent_name) setOpponentName(data.opponent_name);
            
            setScore(0);
            scoreRef.current = 0;
            setOpponentScore(0);
            setConnectionStatus('Match Starting...');
            startGame();
          } 
          else if (data.type === 'WAITING_FOR_OPPONENT') {
            setReconnectTimer(data.seconds_left);
            toast("Opponent connection unstable...", { icon: '⏳' });
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
          else if (data.type === 'MATCH_ABORTED') {
            matchEndedRef.current = true;
            clearAllTimers();
            setGameState('gameover');
            setWaitingForResult(false);
            setResultMessage(data.reason || `${data.leaver_name || 'Opponent'} Disconnected`);
            toast.error("Match Cancelled: Entry Fee Refunded");
          }
          else if (data.type === 'RESULT') {
            // 🚀 THE KILL SWITCH: Force match to end regardless of local state
            matchEndedRef.current = true;
            clearAllTimers();
            
            setWaitingForResult(false);
            setScore(data.my_score);
            scoreRef.current = data.my_score;
            setOpponentScore(data.op_score);
            setResultMessage(data.summary); 

            if (data.status === "DRAW") {
              setIsDraw(true); 
              setWon(false);
            } else if (data.status === "WON") {
              setWon(true);
              setIsDraw(false);
              playSound(audioRefs.win);
            } else {
              setWon(false);
              setIsDraw(false);
              playSound(audioRefs.gameOver);
            }
            setGameState('gameover'); 
          }
          else if (data.type === 'ping') {
            // Internal heartbeat to keep socket alive on mobile/Render
            socket.send(JSON.stringify({ type: 'pong' }));
          }
          else if (data.type === 'MATCH_CANCELLED' || (data.type === 'ERROR' && data.is_fatal)) {
    console.log("⚠️ MATCH FAILED TO INITIALIZE");
    matchEndedRef.current = true;
    clearAllTimers();
    
    // Reset status and show the reason
    setConnectionStatus('Match Aborted');
    setResultMessage(data.reason || "Opponent failed to connect. Funds refunded.");
    
    // Kick the user to the gameover screen so they aren't stuck on the spinner
    setGameState('gameover');
    setWaitingForResult(false);
    
    toast.error(data.reason || "Match Initialization Failed", { duration: 5000 });
}
        } catch (err) { console.error("Socket Logic Error:", err); }
      };

      if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "CLIENT_READY" }));
      } else {
          socket.onopen = () => socket.send(JSON.stringify({ type: "CLIENT_READY" }));
      }

      socket.addEventListener('message', handleSocketMessage);
      return () => {
        socket.removeEventListener('message', handleSocketMessage);
      };
    }
  }, [mode, socket, onQuit, startGame, clearAllTimers, playSound, audioRefs]);

  // --- SECONDARY EFFECTS ---
  useEffect(() => {
      if (gameState === 'showing' && !isPaused) {
        const revealTime = Math.max(3000 - (round - 1) * 300, 1000);
        hideTimerRef.current = setTimeout(() => {
          if (matchEndedRef.current) return;
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