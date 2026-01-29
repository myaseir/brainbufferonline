"use client";
import { useState, useEffect, useRef } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import BubbleGame from './components/Bubble'; 

export default function Home() {
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [matchSocket, setMatchSocket] = useState(null);
  const [gameMode, setGameMode] = useState('offline');
  
  // Track the matchmaking socket so we can kill it on Cancel
  const matchmakingSocketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const balance = localStorage.getItem('wallet_balance');
    
    if (token && username) {
      setUser({ username, token, wallet_balance: balance || 0 });
      setView('dashboard');
    } else {
      setView('auth');
    }
  }, []);

  const startOfflineGame = () => {
    setGameMode('offline');
    setMatchSocket(null);
    setView('playing');
  };

  const startOnlineMatch = () => {
    const token = localStorage.getItem('token');
    if (!token) return setView('auth');

    // 1. Set View
    setView('searching');
    
    // 2. Safety Cleanup: Close any existing ghost connection
    if (matchmakingSocketRef.current) {
        matchmakingSocketRef.current.onmessage = null; 
        matchmakingSocketRef.current.close();
    }

    // 3. Open New Connection
    const mmWs = new WebSocket(`ws://127.0.0.1:8000/api/game/ws/matchmaking?token=${token}`);
    matchmakingSocketRef.current = mmWs;

    mmWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === "MATCH_FOUND") {
        // Match found! Connect to the specific game ID
        const gameSocket = new WebSocket(`ws://127.0.0.1:8000/api/game/ws/match/${data.match_id}?token=${token}`);
        setMatchSocket(gameSocket);
        setGameMode('online');
        setView('playing');
        
        // Close the matchmaking queue socket
        mmWs.close();
      }
      
      if (data.status === "TIMEOUT") {
        alert("No opponent found. Try again!");
        setView('dashboard');
        mmWs.close();
      }
    };

    mmWs.onerror = () => {
      // Only alert if the connection wasn't intentionally closed
      if (mmWs.readyState !== WebSocket.CLOSED) {
         // alert("Connection Error. Is the server running?"); // Optional: Silence this for smoother UX
         setView('dashboard');
      }
    };
  };

  const cancelSearch = () => {
    if (matchmakingSocketRef.current) {
        matchmakingSocketRef.current.onmessage = null; // Stop listening
        matchmakingSocketRef.current.close(); // Kill connection
    }
    setView('dashboard');
  };

  return (
    <main className="min-h-screen bg-[#fcfdfd] select-none text-slate-800">
      
      {/* Loading Spinner */}
      {view === 'loading' && (
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {view === 'auth' && (
        <Auth onLoginSuccess={(u) => { setUser(u); setView('dashboard'); }} />
      )}

      {view === 'dashboard' && (
        <Dashboard 
          user={user} 
          onStartGame={startOnlineMatch} 
          onStartOffline={startOfflineGame} 
          onLogout={() => { localStorage.clear(); setView('auth'); }} 
        />
      )}

      {/* Searching Screen */}
      {view === 'searching' && (
        <div className="flex flex-col items-center justify-center h-screen bg-[#fcfdfd] animate-in fade-in duration-500">
          <div className="relative mb-10">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
              Match<span className="text-emerald-500">Making</span>
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">
              Searching for Opponent...
            </p>
          </div>
          <button 
            onClick={cancelSearch} 
            className="mt-16 px-10 py-4 bg-white text-slate-400 rounded-2xl text-[10px] font-black hover:text-red-500 transition-all uppercase tracking-widest shadow-lg border border-slate-100 active:scale-95"
          >
            Cancel Search
          </button>
        </div>
      )}

      {view === 'playing' && (
        <BubbleGame 
          mode={gameMode} 
          socket={matchSocket} 
          
          // 1. Play Again Button (Summary Screen)
          onRestart={() => {
            if(matchSocket) matchSocket.close();
            setMatchSocket(null);
            startOnlineMatch();
          }}

          // 2. Auto-Requeue (If opponent leaves early)
          onRequeue={() => {
            if(matchSocket) matchSocket.close();
            setMatchSocket(null);
            startOnlineMatch(); 
          }}
          
          // 3. Quit Button (Summary Screen)
          onQuit={() => {
            if(matchSocket) matchSocket.close();
            setView('dashboard');
          }} 
        />
      )}
    </main>
  );
}