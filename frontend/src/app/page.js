"use client";
import { useState, useEffect, useRef } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard/page';
import BubbleGame from './components/Bubble'; 
import { Toaster } from 'react-hot-toast';

export default function Home() {
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [matchSocket, setMatchSocket] = useState(null);
  const [gameMode, setGameMode] = useState('offline');
  
  // We no longer need isConnecting or matchmakingSocketRef here
  // because DashboardPage handles the search via HTTP API.

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
      } else if (res.status === 401) {
        localStorage.removeItem('token');
        setView('auth');
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setView('dashboard');
    }
  };

  useEffect(() => { fetchUserData(); }, []);

  // --- 🎮 UNIFIED GAME CONNECTOR ---
  // This function is called by Dashboard when:
  // 1. A Ranked Match is found (via API)
  // 2. A Challenge is accepted
  const connectToGame = (matchId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    // Ensure we use wss:// in production
    const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_BASE = API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

    // Connect directly to the Game Room
    const gameSocket = new WebSocket(`${WS_BASE}/api/game/ws/match/${matchId}?token=${token}`);
    
    setMatchSocket(gameSocket);
    setGameMode('online');
    setView('playing'); // Switch view immediately
  };

  return (
    <main className="min-h-screen bg-[#fcfdfd] select-none text-slate-800">
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        containerStyle={{ zIndex: 99999 }}
      />
      
      {view === 'loading' && (
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {view === 'auth' && (
        <Auth onLoginSuccess={(response) => { 
          const token = response.access_token || response.user?.access_token;
          if (token) { localStorage.setItem('token', token); fetchUserData(); }
        }} />
      )}

      {view === 'dashboard' && (
        <Dashboard 
          user={user} 
          // 1. Offline Mode
          onStartOffline={() => { 
            setGameMode('offline'); 
            setMatchSocket(null); 
            setView('playing'); 
          }} 
          
          // 2. Logout
          onLogout={() => { 
            localStorage.clear(); 
            setUser(null); 
            setView('auth'); 
          }} 
          
          // 3. ✅ NEW: Unified Handler for Ranked & Challenges
          onJoinChallenge={connectToGame} 
          onMatchFound={connectToGame} 
        />
      )}

      {/* Note: 'searching' view is removed because Dashboard handles that UI now */}

      {view === 'playing' && (
        <BubbleGame 
          mode={gameMode} 
          socket={matchSocket} 
          // Restart: In online mode, we usually go back to dashboard to queue again
          onRestart={() => { 
            if(matchSocket) matchSocket.close(); 
            setMatchSocket(null);
            fetchUserData(); // Refresh money
            setView('dashboard');
          }}
          onQuit={() => { 
            if(matchSocket) matchSocket.close(); 
            setMatchSocket(null); 
            fetchUserData(); 
            setView('dashboard');
          }} 
        />
      )}
    </main>
  );
}