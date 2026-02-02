"use client"; 
import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Search, Users, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

const FriendSidebar = ({ isOpen, onClose, currentUser, onRequestCountChange }) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setFriends(data);
    } catch (err) { console.error(err); }
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
          if (onRequestCountChange) {
              onRequestCountChange(data.length);
          }
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchRequests(); 
    fetchFriends();
    const interval = setInterval(() => {
        fetchRequests();
        if(isOpen) fetchFriends();
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 1) {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/friends/search?q=${searchQuery}`, {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const sendFriendRequest = async (username) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/friends/request?username=${username}`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.message) {
        toast.success("Request Sent!");
        setSearchQuery('');
        setSearchResults([]);
    } else {
        toast.error(data.error);
    }
  };

  const acceptRequest = async (reqId) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/friends/accept/${reqId}`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    toast.success("Friend Added!");
    fetchRequests(); 
    fetchFriends();  
  };

  // 🔥 NEW: DECLINE FUNCTION
  const declineRequest = async (reqId) => {
    const token = localStorage.getItem('token');
    
    // Optimistic UI update (remove from list immediately)
    setRequests(prev => prev.filter(r => r.request_id !== reqId));
    toast("Request Declined", { icon: '🗑️' });

    // Send to backend
    await fetch(`${API_URL}/api/friends/decline/${reqId}`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Refresh to be sure
    fetchRequests(); 
  };

  const handleChallenge = (friendId, friendName) => {
    if (window.sendChallenge) {
        const myName = currentUser?.username || "Player";
        window.sendChallenge(friendId, myName); 
        
        toast.success(
            <div className="flex flex-col">
                <span className="font-black text-slate-800 text-sm">Challenge Sent!</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Waiting for {friendName}...
                </span>
            </div>, 
            {
                icon: '⚔️',
                duration: 4000,
                style: {
                    borderRadius: '16px',
                    background: '#ffffff',
                    color: '#334155',
                    border: '2px solid #ecfdf5',
                    padding: '12px 16px',
                    boxShadow: '0px 10px 30px -10px rgba(16, 185, 129, 0.2)',
                    minWidth: '250px',
                },
                iconTheme: { primary: '#10b981', secondary: '#ecfdf5' },
            }
        );
    } else {
        toast.error("Connection not ready. Refresh page.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[40]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[50] flex flex-col border-l border-slate-100 animate-in slide-in-from-right duration-300">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="text-emerald-500" size={20} />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Social Hub</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-4 relative">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Find players..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden">
                {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                        <span className="text-sm font-bold text-slate-700">{user.username}</span>
                        <button onClick={() => sendFriendRequest(user.username)} className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-200">
                            <UserPlus size={14} />
                        </button>
                    </div>
                ))}
            </div>
          )}
        </div>

        <div className="flex px-4 gap-6 border-b border-slate-100">
          <button onClick={() => setActiveTab('friends')} className={`pb-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'friends' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>My Crew ({friends.length})</button>
          <button onClick={() => setActiveTab('requests')} className={`pb-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'requests' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>Requests ({requests.length})</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'friends' ? (
            friends.length === 0 ? (
                <div className="text-center mt-10 text-slate-400 text-sm">No friends yet. <br/> Search above to add some!</div>
            ) : (
                friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-slate-500 font-bold">{friend.username[0].toUpperCase()}</div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${friend.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">{friend.username}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{friend.is_online ? 'Online' : 'Offline'}</p>
                            </div>
                        </div>
                        {friend.is_online && (
                             <button onClick={() => handleChallenge(friend.id, friend.username)} className="group flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-emerald-500 transition-all hover:scale-105">
                                <Zap size={12} className="group-hover:fill-current" /> Battle
                             </button>
                        )}
                    </div>
                ))
            )
          ) : (
            requests.length === 0 ? (
                <div className="text-center mt-10 text-slate-400 text-sm">No pending requests.</div>
            ) : (
                requests.map(req => (
                    <div key={req.request_id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold">{req.username[0].toUpperCase()}</div>
                            <span className="text-sm font-bold text-slate-700">{req.username}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => acceptRequest(req.request_id)} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"><Check size={16}/></button>
                            
                            {/* 🔥 ATTACHED THE DECLINE HANDLER HERE */}
                            <button 
                                onClick={() => declineRequest(req.request_id)} 
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            >
                                <X size={16}/>
                            </button>
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