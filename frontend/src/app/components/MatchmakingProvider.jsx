import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

const MatchmakingProvider = ({ onMatchFound, setView, fetchUserData }) => {
  const mmSocketRef = useRef(null);
  const connectTimeoutRef = useRef(null); // 1. Track the connection timer

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        setView('auth');
        return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const WS_BASE = API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const wsUrl = `${WS_BASE}/api/game/ws/matchmaking?token=${token}`;
    
    // 2. DELAY connection by 500ms
    // If React unmounts this component quickly (Strict Mode), we cancel this timer 
    // before the socket ever opens.
    connectTimeoutRef.current = setTimeout(() => {
        console.log("Matchmaking: Initiating connection...");
        
        const socket = new WebSocket(wsUrl);
        mmSocketRef.current = socket;

        socket.onopen = () => {
            console.log("Matchmaking: Connected");
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === "MATCH_FOUND") {
                    socket.onclose = null; 
                    socket.onerror = null;
                    onMatchFound(data.match_id);
                    socket.close(1000);
                }
                
                if (data.type === "ERROR") {
                    // Suppress "Session Active" toasts if they happen during a race condition
                    if (data.message && data.message.includes("active")) {
                        console.warn("Session active conflict (harmless in dev).");
                        return; 
                    }
                    
                    toast.error(data.message || "Matchmaking Error");
                    setView('dashboard');
                    fetchUserData();
                }

                if (data.type === "TIMEOUT") {
                    toast.error("No opponents found.");
                    setView('dashboard');
                }
            } catch (e) {
                console.error("Matchmaking Parse Error", e);
            }
        };

        socket.onclose = (e) => {
            if (e.code === 1000) return;
            
            // If the socket closes, checking if we are still in "searching" mode
            // prevents kicking the user if they manually cancelled.
            setView((currentView) => {
                if (currentView === 'searching') return 'dashboard';
                return currentView;
            });
        };

        socket.onerror = () => {
             // Let onclose handle the UI transition
        };

    }, 500); // <-- The 500ms Delay

    // 3. CLEANUP
    return () => {
        // If we unmount BEFORE the 500ms is up, KILL the timer.
        // The socket never opens, so the server never sees a duplicate connection.
        if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
        }

        if (mmSocketRef.current) {
            console.log("Matchmaking: Closing socket");
            // Remove listeners so we don't get errors while closing
            mmSocketRef.current.onclose = null; 
            mmSocketRef.current.onerror = null;
            mmSocketRef.current.close(1000);
            mmSocketRef.current = null;
        }
    };
  }, []);

  return null;
};

export default MatchmakingProvider;