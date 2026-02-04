"use client"; 
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation'; 
import { toast } from 'react-hot-toast';
import { Swords, Check, X } from 'lucide-react'; 

const LobbyListener = ({ onJoinChallenge }) => {
  const router = useRouter();
  const socketRef = useRef(null);
  const loadingToastId = useRef(null);

  const [incomingChallenge, setIncomingChallenge] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const socket = new WebSocket(`${wsUrl}/ws/lobby?token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('✅ Connected to Global Lobby');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Always dismiss loading toast if a response comes back
      if (loadingToastId.current && data.type !== 'ping') {
        toast.dismiss(loadingToastId.current);
        loadingToastId.current = null;
      }

      switch (data.type) {
        // 🔥 NEW: Handle Real-Time Status Changes
        case 'USER_STATUS_CHANGE':
          // We dispatch a custom event so the FriendList component can hear it
          const statusEvent = new CustomEvent('friendStatusUpdate', { 
            detail: { userId: data.user_id, status: data.status } 
          });
          window.dispatchEvent(statusEvent);
          break;

        case 'INCOMING_CHALLENGE':
          setIncomingChallenge({
            challengerId: data.challenger_id,
            challengerName: data.challenger_name,
            betAmount: data.bet_amount
          });
          toast('New Challenge Received!', { icon: '⚔️' });
          break;

        case 'MATCH_START':
          toast.success('Match Starting! Deducting funds...', { duration: 3000 });
          setIncomingChallenge(null); 
          
          if (onJoinChallenge) {
            setTimeout(() => onJoinChallenge(data.match_id), 1000);
          } else {
            setTimeout(() => router.push(`/game/${data.match_id}`), 1000);
          }
          break;

        case 'ERROR':
          toast.error(data.message);
          setIncomingChallenge(null); 
          break;

        case 'ping':
          // Respond to heartbeat if necessary (optional)
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log('❌ Disconnected from Lobby');
    };

    // Global Send Function
    window.sendChallenge = (targetId, targetName) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'SEND_CHALLENGE',
          target_id: targetId,
          username: targetName 
        }));
      } else {
        toast.error("Lobby connection lost. Refreshing...");
      }
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) socket.close();
      delete window.sendChallenge;
    };
  }, [router, onJoinChallenge]);

  const handleAccept = () => {
    if (!socketRef.current || !incomingChallenge) return;

    socketRef.current.send(JSON.stringify({
      type: 'ACCEPT_CHALLENGE',
      challenger_id: incomingChallenge.challengerId
    }));
    
    loadingToastId.current = toast.loading("Verifying wallets...");
  };

  const handleDecline = () => {
    setIncomingChallenge(null);
    toast("Challenge Declined");
  };

  if (!incomingChallenge) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Challenge UI stays the same */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 border-4 border-emerald-500 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 animate-bounce">
            <Swords size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 uppercase italic">Challenge!</h3>
          <p className="text-slate-600 mt-2 text-sm font-medium">
            <strong className="text-slate-900">{incomingChallenge.challengerName}</strong> wants to battle you.
          </p>
          <div className="my-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entry Fee</p>
            <p className="text-3xl font-black text-emerald-600">Rs. {incomingChallenge.betAmount}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDecline} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
              <X size={18} /> Decline
            </button>
            <button onClick={handleAccept} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 hover:scale-105 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
              <Check size={18} /> Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyListener;