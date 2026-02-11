"use client"; 
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation'; 
import { toast } from 'react-hot-toast';
import { Swords, Check, X, Loader2, Megaphone } from 'lucide-react'; 

const LobbyListener = ({ onJoinChallenge }) => {
  const router = useRouter();
  const socketRef = useRef(null);
  const loadingToastId = useRef(null);
  
  // Ref for the notification sound
  const notificationSound = useRef(null);

  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initialize sound - using a clean, professional "ping" sound
    notificationSound.current = new Audio('https://github.com/myaseir/brain-buffer-assets/raw/refs/heads/main/sword-clash.mp3');

    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const socket = new WebSocket(`${wsUrl}/ws/lobby?token=${token}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (loadingToastId.current && data.type !== 'ping') {
        toast.dismiss(loadingToastId.current);
        loadingToastId.current = null;
      }

      switch (data.type) {
        // 📢 NEW: GLOBAL ANNOUNCEMENT HANDLER
        case 'GLOBAL_ANNOUNCEMENT':
          // Play sound
          if (notificationSound.current) {
            notificationSound.current.play().catch(e => console.log("Audio play blocked by browser"));
          }

          toast(data.message, {
            duration: 8000,
            position: 'top-center',
            icon: '📢',
            style: {
              background: '#0f172a', // Slate-900
              color: '#fff',
              borderRadius: '16px',
              border: '2px solid #10b981', // Emerald-500
              fontSize: '14px',
              fontWeight: 'bold',
              maxWidth: '450px',
            },
          });
          break;

        case 'INCOMING_CHALLENGE':
          // Also play sound for incoming challenges
          if (notificationSound.current) {
            notificationSound.current.play().catch(e => console.log("Audio play blocked"));
          }

          setIncomingChallenge({
            challengerId: data.challenger_id,
            challengerName: data.challenger_name,
            betAmount: data.bet_amount,
            receivedAt: Date.now()
          });
          setIsProcessing(false); 
          toast('New Challenge Received!', { icon: '⚔️' });
          break;

        case 'CHALLENGE_EXPIRED':
          setIncomingChallenge(prev => {
            if (prev?.challengerId === data.challenger_id) {
                return null;
            }
            return prev;
          });
          break;

        case 'MATCH_START':
          toast.success('Match Starting! Deducting funds...', { duration: 3000 });
          setIncomingChallenge(null); 
          setIsProcessing(false);
          
          if (onJoinChallenge) {
            setTimeout(() => onJoinChallenge(data.match_id), 1000);
          } else {
            setTimeout(() => router.push(`/game/${data.match_id}`), 1000);
          }
          break;

        case 'MATCH_CANCELLED':
          toast.error(data.reason || "Match cancelled.", { duration: 5000 });
          setIncomingChallenge(null);
          setIsProcessing(false);
          router.push('/dashboard');
          break;

        case 'ERROR':
          toast.error(data.message);
          setIncomingChallenge(null); 
          setIsProcessing(false); 
          break;

        default:
          break;
      }
    };

    socket.onopen = () => console.log('✅ Connected to Global Lobby');
    socket.onclose = () => console.log('❌ Disconnected from Lobby');

    window.sendChallenge = (targetId, targetName) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'SEND_CHALLENGE', target_id: targetId, username: targetName }));
      } else {
        toast.error("Lobby connection lost.");
      }
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) socket.close();
      delete window.sendChallenge;
    };
  }, [router, onJoinChallenge]);

  const handleAccept = () => {
    if (!socketRef.current || !incomingChallenge || isProcessing) return;
    setIsProcessing(true);
    socketRef.current.send(JSON.stringify({
      type: 'ACCEPT_CHALLENGE',
      challenger_id: incomingChallenge.challengerId
    }));
    loadingToastId.current = toast.loading("Verifying wallets...");
  };

  const handleDecline = () => {
    if (isProcessing) return; 
    setIncomingChallenge(null);
    toast("Challenge Declined");
  };

  if (!incomingChallenge) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        key={incomingChallenge.receivedAt} 
        className="bg-white rounded-2xl shadow-2xl p-6 w-96 border-4 border-emerald-500 relative overflow-hidden"
      >
        {!isProcessing && (
            <div className="absolute top-0 left-0 h-2 bg-red-500 animate-timer-shrink" />
        )}

        <div className="text-center relative z-10">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            {isProcessing ? (
              <Loader2 size={32} className="animate-spin" />
            ) : (
              <Swords size={32} className="animate-bounce" />
            )}
          </div>

          <h3 className="text-2xl font-black text-slate-800 uppercase italic">
            {isProcessing ? "Joining..." : "Challenge!"}
          </h3>

          <p className="text-slate-600 mt-2 text-sm font-medium">
            <strong className="text-slate-900">{incomingChallenge.challengerName}</strong> wants to battle you.
          </p>

          <div className="my-6 bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entry Fee</p>
            <p className="text-3xl font-black text-emerald-600">Rs. {incomingChallenge.betAmount}</p>
          </div>

          <div className="flex gap-3">
            <button 
              disabled={isProcessing}
              onClick={handleDecline} 
              className={`flex-1 py-3 rounded-xl border-2 border-slate-200 font-bold transition-colors flex items-center justify-center gap-2 
                ${isProcessing ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <X size={18} /> Decline
            </button>
            
            <button 
              disabled={isProcessing}
              onClick={handleAccept} 
              className={`flex-1 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2
                ${isProcessing 
                  ? 'bg-emerald-200 text-emerald-500 cursor-not-allowed' 
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105 shadow-emerald-200'}`}
            >
              {isProcessing ? <>Wait...</> : <><Check size={18} /> Accept</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyListener;