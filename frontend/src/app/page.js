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
  const [isConnecting, setIsConnecting] = useState(false);
  
  const matchmakingSocketRef = useRef(null);

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

  // --- 🚀 NEW: DIRECT CHALLENGE JOINER ---
  // This function skips matchmaking and connects directly to a specific Match ID
  const joinChallengeMatch = (matchId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const WS_URL = API_URL.replace(/^http/, 'ws'); 

    // Connect directly to the Game Room
    const gameSocket = new WebSocket(`${WS_URL}/api/game/ws/match/${matchId}?token=${token}`);
    
    setMatchSocket(gameSocket);
    setGameMode('online'); // Challenges are always online
    setView('playing');    // Switch view immediately
  };

  // --- 🔍 MATCHMAKING LOGIC ---
  const startOnlineMatch = () => {
    const token = localStorage.getItem('token');
    if (!token || isConnecting) return;

    setIsConnecting(true);
    setView('searching');
    
    if (matchmakingSocketRef.current) {
        matchmakingSocketRef.current.onmessage = null; 
        matchmakingSocketRef.current.close();
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const WS_URL = API_URL.replace(/^http/, 'ws'); 

    setTimeout(() => {
      try {
        const mmWs = new WebSocket(`${WS_URL}/api/game/ws/matchmaking?token=${token}`);
        matchmakingSocketRef.current = mmWs;

        mmWs.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === "MATCH_FOUND") {
            const gameSocket = new WebSocket(`${WS_URL}/api/game/ws/match/${data.match_id}?token=${token}`);
            setMatchSocket(gameSocket);
            setGameMode('online');
            setView('playing');
            setIsConnecting(false);
            mmWs.onmessage = null;
            mmWs.close();
          }

          if (data.type === "ERROR") {
            console.error("Matchmaking Error:", data.message);
            if (data.message === "Insufficient Balance") {
                alert("⚠️ Insufficient Funds! You need at least 50 PKR to play.");
            }
            setIsConnecting(false);
            setView('dashboard');
            mmWs.close();
          }
        };

        mmWs.onerror = (err) => {
          console.error("WebSocket Connection Failed. Resetting...");
          setIsConnecting(false);
          setView('dashboard');
        };

        mmWs.onclose = () => setIsConnecting(false);

      } catch (err) {
        setIsConnecting(false);
        setView('dashboard');
      }
    }, 800); 
  };

  const cancelSearch = () => {
    if (matchmakingSocketRef.current) {
      matchmakingSocketRef.current.onmessage = null; 
      matchmakingSocketRef.current.onerror = null; 
      matchmakingSocketRef.current.close();
      matchmakingSocketRef.current = null;
    }
    setIsConnecting(false);
    setView('dashboard');
  };

  return (
    <main className="min-h-screen bg-[#fcfdfd] select-none text-slate-800">
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        containerStyle={{
           zIndex: 99999 // This forces it to be ON TOP of the sidebar
        }}
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
          onStartGame={startOnlineMatch} 
          onStartOffline={() => { setGameMode('offline'); setMatchSocket(null); setView('playing'); }} 
          onLogout={() => { localStorage.clear(); setUser(null); setView('auth'); }} 
          
          // ✅ PASS THIS PROP DOWN
          onJoinChallenge={joinChallengeMatch} 
        />
      )}

      {view === 'searching' && (
        <div className="flex flex-col items-center justify-center h-screen bg-[#fcfdfd]">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-10"></div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Matchmaking</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">Scanning for Opponents...</p>
          <button onClick={cancelSearch} className="mt-16 px-10 py-4 bg-white text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg border border-slate-100 active:scale-95 transition-all">
            Cancel Search
          </button>
        </div>
      )}

      {view === 'playing' && (
        <BubbleGame 
          mode={gameMode} 
          socket={matchSocket} 
          onRestart={() => { 
            if(matchSocket) matchSocket.close(); 
            setMatchSocket(null); 
            setTimeout(() => startOnlineMatch(), 1000); 
          }}
          onQuit={() => { 
            if(matchSocket) matchSocket.close(); 
            setMatchSocket(null); 
            fetchUserData(); 
          }} 
        />
      )}
    </main>
  );
}