import { useEffect, useRef, useState } from 'react';

let bgMusicInstance = null;

export const useGameAudio = (gameState, isPaused) => {
  const [settings, setSettings] = useState({ music: true, sfx: true, vibration: true });
  
  const tickAudioRef = useRef(null);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const gameOverAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const startSoundRef = useRef(null);

  // 1. Initialize Music & HANDLE EXIT (The Fix)
  useEffect(() => {
    // A. Init Logic
    if (typeof window !== 'undefined' && !bgMusicInstance) {
      bgMusicInstance = new Audio('/bgmusic.mp3');
      bgMusicInstance.loop = true;
      bgMusicInstance.preload = "auto";
      bgMusicInstance.volume = 0.5;
    }

    // B. CLEANUP LOGIC (Runs when you quit/leave the page)
    return () => {
      if (bgMusicInstance) {
        bgMusicInstance.pause();
        bgMusicInstance.currentTime = 0; // Reset song for next time
      }
    };
  }, []); // Empty array = Only runs on Mount and Unmount

  // 2. MAIN MUSIC CONTROL LOGIC
  useEffect(() => {
    if (!bgMusicInstance) return;

    const handleMusicState = async () => {
      // PLAY: Active Game & Not Paused & Music ON
      if ((gameState === 'showing' || gameState === 'playing') && !isPaused && settings.music) {
        try {
          if (gameState === 'showing' && bgMusicInstance.paused) {
             bgMusicInstance.currentTime = 0;
          }
          await bgMusicInstance.play();
        } catch (e) {}
      } 
      // PAUSE: Menu Open
      else if (isPaused) {
        bgMusicInstance.pause();
      }
      // STOP: Game Over / Idle / Music OFF
      else if (gameState === 'gameover' || gameState === 'idle' || !settings.music) {
        bgMusicInstance.pause();
        if (gameState === 'gameover' || gameState === 'idle') {
           bgMusicInstance.currentTime = 0;
        }
      }
    };

    handleMusicState();
  }, [gameState, isPaused, settings.music]);

  // 3. Tab Visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (bgMusicInstance) bgMusicInstance.pause();
        if (tickAudioRef.current) { 
          tickAudioRef.current.pause(); 
          tickAudioRef.current.currentTime = 0; 
        }
      } else {
        if (settings.music && !isPaused && (gameState === 'playing' || gameState === 'showing')) {
          bgMusicInstance?.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [settings.music, isPaused, gameState]);

  const vibrate = (pattern = 200) => {
    if (settings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const playSound = (ref) => {
    if (settings.sfx && ref.current) {
        ref.current.currentTime = 0;
        ref.current.play().catch(() => {});
    }
  };

  return {
    settings,
    setSettings,
    vibrate,
    playSound,
    bgMusicInstance,
    refs: {
      tick: tickAudioRef,
      correct: correctAudioRef,
      wrong: wrongAudioRef,
      gameOver: gameOverAudioRef,
      win: winAudioRef,
      start: startSoundRef,
    }
  };
};