"use client"; 
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation'; 
import { toast } from 'react-hot-toast';
import { Swords, Check, X } from 'lucide-react'; 

const LobbyListener = ({ onJoinChallenge }) => {
  const router = useRouter();
  const socketRef = useRef(null);
  const loadingToastId = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [incomingChallenge, setIncomingChallenge] = useState(null);

  const connectWS = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // -----------------------------------------------------------
    // 🚀 PRODUCTION AUTO-FIX
    // -----------------------------------------------------------
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    
    // If Vercel is HTTPS, we MUST use WSS (Secure WebSocket)
    // This fixes the "Mobile connection failed" error automatically
    if (typeof window !== "undefined" && window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
        wsUrl = wsUrl.replace('ws://', 'wss://');
    }

    // 1. Initialize Connection
    const socket = new WebSocket(`${wsUrl}/ws/lobby?token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('✅ Connected to Lobby');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (loadingToastId.current) {
        toast.dismiss(loadingToastId.current);
        loadingToastId.current = null;
      }

      switch (data.type) {
        case 'INCOMING_CHALLENGE':
          // Mobile Vibration (Android Only usually)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          
          setIncomingChallenge({
            challengerId: data.challenger_id,
            challengerName: data.challenger_name,
            betAmount: data.bet_amount
          });
          toast('New Challenge Received!', { icon: '⚔️' });
          break;

        case 'MATCH_START':
          toast.success('Match Starting!', { duration: 3000 });
          setIncomingChallenge(null); 
          
          // Smooth navigation wrapper
          setTimeout(() => {
            if (onJoinChallenge) {
                onJoinChallenge(data.match_id);
            } else {
                router.push(`/game/${data.match_id}`);
            }
          }, 1000);
          break;

        case 'ERROR':
          toast.error(data.message);
          setIncomingChallenge(null); 
          break;
      }
    };

    socket.onclose = () => {
      console.log('❌ Disconnected. Retrying...');
      // Reconnect quickly if mobile signal drops
      reconnectTimeoutRef.current = setTimeout(connectWS, 2000);
    };

    // 2. Global Send Function
    window.sendChallenge = (targetId, targetName) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'SEND_CHALLENGE',
          target_id: targetId,
          username: targetName 
        }));
      } else {
        toast.error("Reconnecting to lobby...");
      }
    };

  }, [router, onJoinChallenge]);

  // 3. Lifecycle & Mobile Visibility Handler
  useEffect(() => {
    connectWS();

    // Reconnect when user switches apps and comes back
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED)) {
        connectWS();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      delete window.sendChallenge;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectWS]);

  const handleAccept = () => {
    if (!socketRef.current || !incomingChallenge) return;
    socketRef.current.send(JSON.stringify({
      type: 'ACCEPT_CHALLENGE',
      challenger_id: incomingChallenge.challengerId
    }));
    loadingToastId.current = toast.loading("Verifying wallets...");
  };

  if (!incomingChallenge) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[95%] max-w-sm border-4 border-emerald-500 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
        
        <div className="text-center relative z-10">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 animate-bounce">
            <Swords size={32} />
          </div>
          
          <h3 className="text-xl font-black text-slate-800 uppercase italic">Challenge!</h3>
          <p className="text-slate-600 mt-2 text-sm">
            <strong className="text-slate-900">{incomingChallenge.challengerName}</strong> wants to battle.
          </p>

          <div className="my-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entry Fee</p>
            <p className="text-2xl font-black text-emerald-600">Rs. {incomingChallenge.betAmount}</p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setIncomingChallenge(null)}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold active:scale-95 transition-transform"
            >
              Decline
            </button>
            <button 
              onClick={handleAccept}
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg active:scale-95 transition-transform"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyListener;