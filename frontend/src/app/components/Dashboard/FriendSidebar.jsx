"use client"; 
import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Search, Users, Zap, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const FriendSidebar = ({ isOpen, onClose, currentUser, onRequestCountChange }) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🛡️ State to prevent spamming challenges
  const [challengingId, setChallengingId] = useState(null);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // --- 📋 DATA FETCHING ---
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

        const sorted = mapped.sort((a, b) => {
            if (a.is_online === b.is_online) return 0;
            return a.is_online ? -1 : 1;
        });

        setFriends(sorted);
      }
    } catch (err) { console.error(err); }
  };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
        if (onRequestCountChange) onRequestCountChange(data.length);
      }
    } catch (err) { console.error(err); }
  };

  // --- ⚔️ CHALLENGE LOGIC ---
  const handleBattleClick = (friendId, username) => {
    // Prevent multiple clicks
    if (challengingId === friendId) return;

    setChallengingId(friendId);
    
    if (window.sendChallenge) {
        window.sendChallenge(friendId, username);
        toast.success("Battle Request Sent!");
    } else {
        toast.error("Battle system offline");
        setChallengingId(null);
        return;
    }

    // Cooldown: Allow retrying after 10 seconds if no response
    setTimeout(() => setChallengingId(null), 10000);
  };

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
        toast.error(data.error || "Failed");
    }
  };

  const acceptRequest = async (reqId) => {
    // 🛡️ Immediate UI feedback to prevent double-click deduction
    const token = localStorage.getItem('token');
    
    // Remove from UI immediately so it can't be clicked again
    setRequests(prev => prev.filter(r => r.request_id !== reqId));
    
    try {
        const res = await fetch(`${API_URL}/api/friends/accept/${reqId}`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if(res.ok) {
            toast.success("Friend Added!");
            fetchFriends();
        } else {
            // If failed, fetch again to restore the request to the list
            fetchRequests();
            toast.error("Failed to accept");
        }
    } catch (err) {
        fetchRequests();
    }
  };

  const declineRequest = async (reqId) => {
    const token = localStorage.getItem('token');
    setRequests(prev => prev.filter(r => r.request_id !== reqId));
    
    await fetch(`${API_URL}/api/friends/decline/${reqId}`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    toast("Request Declined", { icon: '🗑️' });
    fetchRequests(); 
  };

  useEffect(() => {
    if (isOpen) {
      const initData = async () => {
        setLoading(true);
        await Promise.all([fetchFriends(), fetchRequests()]);
        setLoading(false);
      };
      initData();
    }
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

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[40]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[50] flex flex-col border-l border-slate-100">
        
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

        {/* 🔍 SEARCH BOX */}
        <div className="px-4 py-4 border-b border-slate-50">
          <div className="flex items-center w-full bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
            <Search className="text-slate-400 shrink-0" size={18} />
            <input 
              type="text" 
              placeholder="Find players..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow bg-transparent border-none py-3 pl-2 pr-1 text-sm font-bold focus:ring-0 outline-none text-slate-700"
            />
          </div>
          
          {searchQuery.length > 1 && (
            <div className="absolute left-4 right-4 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[60] overflow-hidden">
                {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic">No users found</div>
                ) : (
                    searchResults.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            <span className="text-sm font-bold text-slate-700">{user.username}</span>
                            <button onClick={() => sendFriendRequest(user.username)} className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-200">
                                <UserPlus size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex px-4 mt-2 gap-6 border-b border-slate-100">
          <button onClick={() => setActiveTab('friends')} className={`pb-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'friends' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>My Crew ({friends.length})</button>
          <button onClick={() => setActiveTab('requests')} className={`pb-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'requests' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}>Requests ({requests.length})</button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="text-emerald-500 animate-spin w-10 h-10" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Hub...</p>
            </div>
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? <div className="text-center mt-10 text-slate-400 text-sm italic">No friends yet.</div> :
            friends.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold uppercase">{f.username[0]}</div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${f.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">{f.username}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.is_online ? 'Online' : 'Offline'}</p>
                        </div>
                    </div>
                    {f.is_online && (
                        <button 
                            disabled={challengingId === f.id}
                            onClick={() => handleBattleClick(f.id, currentUser?.username)} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 ${
                                challengingId === f.id 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-slate-900 text-white hover:bg-emerald-500'
                            }`}
                        >
                            {challengingId === f.id ? (
                                <><Check size={12} /> Sent</>
                            ) : (
                                <><Zap size={12} /> Battle</>
                            )}
                        </button>
                    )}
                </div>
            ))
          ) : (
            requests.map(req => (
                <div key={req.request_id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold uppercase">{req.username[0]}</div>
                        <span className="text-sm font-bold text-slate-700">{req.username}</span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => acceptRequest(req.request_id)} 
                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"
                        >
                            <Check size={16}/>
                        </button>
                        <button 
                            onClick={() => declineRequest(req.request_id)} 
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                            <X size={16}/>
                        </button>
                    </div>
                </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default FriendSidebar;