"use client"; 
import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Search, Users, Zap, Loader2 } from 'lucide-react'; // Added Loader2
import { toast } from 'react-hot-toast';

const FriendSidebar = ({ isOpen, onClose, currentUser, onRequestCountChange }) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true); // 🟢 New Loading State
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const mapped = data.map(f => ({
            ...f,
            is_online: f.status === 'online'
        }));
        setFriends(mapped);
      }
    } catch (err) { 
        console.error(err); 
    } finally {
        setLoading(false); // Stop loading after fetch
    }
  };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      
      if (Array.isArray(data)) {
          setRequests(data);
          if (onRequestCountChange) onRequestCountChange(data.length);
      }
    } catch (err) { console.error(err); }
  };

  // INITIAL FETCH
  useEffect(() => {
    const initFetch = async () => {
        setLoading(true);
        await Promise.all([fetchRequests(), fetchFriends()]);
        setLoading(false);
    };

    if (isOpen) {
        initFetch();
    }

    const handleStatusUpdate = (event) => {
        const { userId, status } = event.detail;
        setFriends(prev => prev.map(f => 
            f.id === userId ? { ...f, is_online: status === 'online' } : f
        ));
    };

    window.addEventListener('friendStatusUpdate', handleStatusUpdate);
    const interval = setInterval(fetchRequests, 30000); 

    return () => {
        window.removeEventListener('friendStatusUpdate', handleStatusUpdate);
        clearInterval(interval);
    };
  }, [isOpen]);

  const handleChallenge = (friendId, friendName) => {
    if (window.sendChallenge) {
        window.sendChallenge(friendId, currentUser?.username || "Player"); 
        toast.success(
            <div className="flex flex-col">
                <span className="font-black text-slate-800 text-sm">Challenge Sent!</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Waiting for {friendName}...
                </span>
            </div>, 
            { icon: '⚔️', duration: 4000 }
        );
    } else {
        toast.error("Lobby connection not active.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[40]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[50] flex flex-col border-l border-slate-100 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="text-emerald-500" size={20} />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Social Hub</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex px-4 mt-4 gap-6 border-b border-slate-100">
          <button onClick={() => setActiveTab('friends')} className={`pb-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'friends' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>
            Crew ({friends.length})
          </button>
          <button onClick={() => setActiveTab('requests')} className={`pb-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'requests' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>
            Inbox ({requests.length})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            /* 🟢 THE LOADING LOGO */
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="text-emerald-500 animate-spin w-10 h-10" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
                loading
              </p>
            </div>
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? (
                <div className="text-center mt-10 text-slate-400 text-sm italic">No friends found.</div>
            ) : (
                friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                                    {friend.username[0].toUpperCase()}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${friend.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">{friend.username}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{friend.is_online ? 'Online' : 'Offline'}</p>
                            </div>
                        </div>
                        {friend.is_online && (
                            <button 
                                onClick={() => handleChallenge(friend.id, friend.username)} 
                                className="group flex items-center justify-center bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 border-2 border-transparent hover:bg-slate-800 hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 shadow-md"
                            >
                                <Zap size={12} className="mr-1.5 fill-yellow-400 text-yellow-400 group-hover:scale-110 transition-transform" />
                                <span className="group-hover:text-emerald-400 transition-colors">Battle</span>
                            </button>
                        )}
                    </div>
                ))
            )
          ) : (
            requests.length === 0 ? (
                <div className="text-center mt-10 text-slate-400 text-sm italic">No requests pending.</div>
            ) : (
                requests.map(req => (
                    <div key={req.request_id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold">{req.username[0].toUpperCase()}</div>
                            <span className="text-sm font-bold text-slate-700">{req.username}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => acceptRequest(req.request_id)} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"><Check size={16}/></button>
                            <button onClick={() => declineRequest(req.request_id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><X size={16}/></button>
                        </div>
                    </div>
                ))
            )
          )}
        </div>
      </div>
    </>
  );
};

export default FriendSidebar;