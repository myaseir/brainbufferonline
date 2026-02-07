"use client";
import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';

// --- COMPONENTS ---
import Auth from './components/Auth';
import Dashboard from './components/Dashboard/page';
import MatchmakingProvider from './components/MatchmakingProvider'; // The new logic provider
import BubbleGame from './components/BubbleGame'; // Points to your new folder

export default function Home() {
  const [view, setView] = useState('loading'); // 'loading' | 'auth' | 'dashboard' | 'searching' | 'playing'
  const [user, setUser] = useState(null);
  const [matchSocket, setMatchSocket] = useState(null);
  const [gameMode, setGameMode] = useState('offline'); // 'offline' | 'online'

  // --- 1. AUTH & USER DATA ---
  const fetchUserData = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setView('auth'); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const freshUser = await res.json();
        setUser(freshUser);
        setView('dashboard');
      } else {
        localStorage.removeItem('token');
        setView('auth');
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setView('dashboard'); 
    }
  };

  useEffect(() => { fetchUserData(); }, []);

  // --- 2. GAME CONNECTION HANDLER ---
  // This is called by MatchmakingProvider when a match is found
  const connectToGame = (matchId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const WS_BASE = API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

    // Create the game socket
    const gameSocket = new WebSocket(`${WS_BASE}/api/game/ws/match/${matchId}?token=${token}`);
    
    gameSocket.onerror = () => {
      toast.error("Game connection error.");
      setView('dashboard');
    };

    // Store socket and switch view
    setMatchSocket(gameSocket);
    setGameMode('online');
    
    // Slight delay to ensure socket open state
    setTimeout(() => {
      setView('playing');
    }, 100);
  };

  // --- 3. CLEANUP HELPERS ---
  const handleQuitGame = () => {
    if(matchSocket) matchSocket.close();
    setMatchSocket(null);
    setView('dashboard');
    fetchUserData();
  };

  const handleNextMatch = () => {
    if(matchSocket) matchSocket.close();
    setMatchSocket(null);
    setView('searching'); // Automatically starts searching again
    fetchUserData();
  };

  return (
    <main className="min-h-screen bg-[#fcfdfd] select-none text-slate-800">
      <h1 className="sr-only">BrainBuffer | The Competitive Memory Training Arena for Real Rewards</h1>
      <noscript>
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col items-center justify-center p-10 text-center">
          <h2 className="text-2xl font-black text-slate-900 uppercase">BrainBuffer: The Best Earning Memory Game</h2>
          <p className="text-slate-500 mt-4">Please enable JavaScript to join the arena and start earning real cash.</p>
        </div>
      </noscript>
      <Toaster position="top-center" containerStyle={{ zIndex: 99999 }} />
      
      {/* ---------------- LOGIC LAYER ---------------- */}
      {/* Only active when searching. Unmounting cancels search automatically. */}
      {view === 'searching' && (
        <MatchmakingProvider 
          onMatchFound={connectToGame}
          setView={setView}
          fetchUserData={fetchUserData}
        />
      )}

      {/* ---------------- VIEW LAYER ---------------- */}

      {/* 1. LOADING */}
      {view === 'loading' && (
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* 2. AUTH */}
      {view === 'auth' && (
        <Auth onLoginSuccess={(response) => { 
          const token = response.access_token || response.user?.access_token;
          if (token) { localStorage.setItem('token', token); fetchUserData(); }
        }} />
      )}

      {/* 3. DASHBOARD */}
      {view === 'dashboard' && (
        <Dashboard 
          user={user} 
          onStartGame={() => setView('searching')} 
          onStartOffline={() => { 
            setGameMode('offline'); 
            setMatchSocket(null); 
            setView('playing'); 
          }} 
          onLogout={() => { localStorage.clear(); setUser(null); setView('auth'); }} 
          onJoinChallenge={connectToGame} 
        />
      )}

      {/* 4. SEARCHING UI */}
      {view === 'searching' && (
        <div className="flex flex-col items-center justify-center h-screen bg-[#fcfdfd] z-[200]">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-10"></div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Matchmaking</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">Scanning for Opponents...</p>
          <button 
            onClick={() => setView('dashboard')} 
            className="mt-16 px-16 py-5 bg-white text-slate-500 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-slate-200/50 border border-slate-100 hover:text-red-500 hover:bg-red-50/50 hover:border-red-200 active:scale-95 transition-all"
          >
            Cancel Search
          </button>
        </div>
      )}

      {/* 5. PLAYING */}
      {view === 'playing' && (
        <BubbleGame 
          mode={gameMode} 
          socket={matchSocket} 
          onQuit={handleQuitGame}
          onRestart={handleNextMatch} // Used for 'Find Next Match' button
          onRequeue={handleNextMatch} // Fallback if opponent leaves
        />
      )}
    </main>
  );
}