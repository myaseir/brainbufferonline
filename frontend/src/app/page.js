"use client";
import { useState, useEffect, useRef } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard/page';
import BubbleGame from './components/Bubble'; 

export default function Home() {
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [matchSocket, setMatchSocket] = useState(null);
  const [gameMode, setGameMode] = useState('offline');
  
  const matchmakingSocketRef = useRef(null);

  // --- 📡 FETCH FRESH USER DATA ---
  const fetchUserData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setView('auth');
      return;
    }

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
        localStorage.setItem('username', freshUser.username);
        localStorage.setItem('wallet_balance', freshUser.wallet_balance);
        setView('dashboard');
      } else if (res.status === 401) {
        localStorage.removeItem('token');
        setView('auth');
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      const cachedUsername = localStorage.getItem('username');
      if (cachedUsername) {
        setUser({ username: cachedUsername, token, wallet_balance: localStorage.getItem('wallet_balance') || 0 });
        setView('dashboard');
      } else {
        setView('auth');
      }
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // --- 🔍 MATCHMAKING LOGIC ---
  const startOnlineMatch = () => {
    const token = localStorage.getItem('token');
    if (!token) return setView('auth');

    setView('searching');
    
    if (matchmakingSocketRef.current) {
        matchmakingSocketRef.current.onmessage = null; 
        matchmakingSocketRef.current.close();
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const WS_URL = API_URL.replace(/^http/, 'ws'); 

    const mmWs = new WebSocket(`${WS_URL}/api/game/ws/matchmaking?token=${token}`);
    matchmakingSocketRef.current = mmWs;

    mmWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "MATCH_FOUND") {
        const gameSocket = new WebSocket(`${WS_URL}/api/game/ws/match/${data.match_id}?token=${token}`);
        setMatchSocket(gameSocket);
        setGameMode('online');
        setView('playing');
        mmWs.close();
      }
      if (data.status === "TIMEOUT") {
        alert("No opponent found. Try again!");
        setView('dashboard');
        mmWs.close();
      }
    };

    mmWs.onerror = () => {
      if (mmWs.readyState !== WebSocket.CLOSED) setView('dashboard');
    };
  };

  // ✅ RESTORED CANCEL SEARCH FUNCTION
  const cancelSearch = () => {
    if (matchmakingSocketRef.current) {
        matchmakingSocketRef.current.onmessage = null; 
        matchmakingSocketRef.current.close();
    }
    setView('dashboard');
  };

  return (
    <main className="min-h-screen bg-[#fcfdfd] select-none text-slate-800">
      
      {view === 'loading' && (
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {view === 'auth' && (
        <Auth onLoginSuccess={(response) => { 
          // Extract token whether it's top-level or nested
          const token = response.access_token || (response.user && response.user.access_token);
          if (token) {
            localStorage.setItem('token', token);
            setTimeout(() => fetchUserData(), 50); 
          } else {
            console.error("Auth Failure: No token found", response);
            alert("Session could not be established.");
          }
        }} />
      )}

      {view === 'dashboard' && (
        <Dashboard 
          user={user} 
          onStartGame={startOnlineMatch} 
          onStartOffline={() => { setGameMode('offline'); setMatchSocket(null); setView('playing'); }} 
          onLogout={() => { localStorage.clear(); setUser(null); setView('auth'); }} 
        />
      )}

      {view === 'searching' && (
        <div className="flex flex-col items-center justify-center h-screen bg-[#fcfdfd]">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-10"></div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">MatchMaking</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Searching...</p>
          <button onClick={cancelSearch} className="mt-16 px-10 py-4 bg-white text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg border border-slate-100 active:scale-95">
            Cancel Search
          </button>
        </div>
      )}

      {view === 'playing' && (
        <BubbleGame 
          mode={gameMode} 
          socket={matchSocket} 
          onRestart={() => { if(matchSocket) matchSocket.close(); setMatchSocket(null); startOnlineMatch(); }}
          onQuit={() => { 
            if(matchSocket) matchSocket.close(); 
            setMatchSocket(null); 
            fetchUserData(); // Sync results
          }} 
        />
      )}
    </main>
  );
}