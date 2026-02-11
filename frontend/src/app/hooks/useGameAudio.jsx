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

  // 1. Initialize Music & Handle Exit
  useEffect(() => {
    if (typeof window !== 'undefined' && !bgMusicInstance) {
     bgMusicInstance = new Audio('https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/bgmusic.mp3');
bgMusicInstance.crossOrigin = "anonymous";
      bgMusicInstance.loop = true;
      bgMusicInstance.preload = "auto";
      bgMusicInstance.volume = 0.5;
    }

    return () => {
      if (bgMusicInstance) {
        bgMusicInstance.pause();
        bgMusicInstance.currentTime = 0;
      }
    };
  }, []);

  // 2. REWRITTEN: CONTINUOUS MUSIC LOGIC
  useEffect(() => {
    if (!bgMusicInstance) return;

    const handleMusicState = async () => {
      // Logic: Music starts when game starts and DOES NOT stop until 'gameover' or 'idle'
      const isMatchActive = gameState !== 'gameover' && gameState !== 'idle';

      // PLAY: If Match is active (even between rounds) AND not paused AND settings allow it
      if (isMatchActive && !isPaused && settings.music) {
        try {
          // Only play if it's currently paused (prevents "stuttering" on state changes)
          if (bgMusicInstance.paused) {
            await bgMusicInstance.play();
          }
        } catch (e) {
          console.error("Audio play blocked:", e);
        }
      } 
      // PAUSE: Menu Open
      else if (isPaused) {
        bgMusicInstance.pause();
      }
      // STOP: Match is totally over (Knockout/Exit) or settings disabled
      else if (!isMatchActive || !settings.music) {
        bgMusicInstance.pause();
        bgMusicInstance.currentTime = 0; // Fully reset only when match ends
      }
    };

    handleMusicState();
  }, [gameState, isPaused, settings.music]);

  // 3. Tab Visibility (Kept same as your original)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (bgMusicInstance) bgMusicInstance.pause();
      } else {
        // Resume only if match is still active and not paused
        const isMatchActive = gameState !== 'gameover' && gameState !== 'idle';
        if (settings.music && !isPaused && isMatchActive) {
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