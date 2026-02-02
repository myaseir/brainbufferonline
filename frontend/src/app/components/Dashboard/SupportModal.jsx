"use client";
import { useState } from 'react';
import { X, AlertTriangle, Shield, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SupportModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('report'); // 'report', 'terms', 'privacy'
  const [reportData, setReportData] = useState({ type: 'payment', description: '', matchId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/support/report`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reportData)
      });

      if (res.ok) {
        toast.success("Report received. We will review it shortly.");
        onClose();
        setReportData({ type: 'payment', description: '', matchId: '' });
      } else {
        toast.error("Failed to send report. Please try again.");
      }
    } catch (err) {
      toast.error("Connection error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Help Center</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100">
          <button onClick={() => setActiveTab('report')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'report' ? 'bg-red-50 text-red-500 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>Report Issue</button>
          <button onClick={() => setActiveTab('terms')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'terms' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>Terms</button>
          <button onClick={() => setActiveTab('privacy')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'privacy' ? 'bg-blue-50 text-blue-500 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>Privacy</button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto">
          
          {/* --- REPORT FORM --- */}
          {activeTab === 'report' && (
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div className="bg-red-50 p-4 rounded-2xl flex gap-3 items-start">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <p className="text-xs text-red-800 font-medium">Found a bug or lost money due to an error? Describe it below. Include the Match ID if possible.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Issue Type</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400"
                  value={reportData.type}
                  onChange={(e) => setReportData({...reportData, type: e.target.value})}
                >
                  <option value="payment">💰 Payment Issue (Deposit/Withdraw)</option>
                  <option value="gameplay">🎮 Game Freeze / Bug</option>
                  <option value="cheater">🚫 Reporting a Cheater</option>
                  <option value="other">📝 Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Match ID (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. match_8a2b..." 
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400"
                  value={reportData.matchId}
                  onChange={(e) => setReportData({...reportData, matchId: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description</label>
                <textarea 
                  required
                  rows="4"
                  placeholder="Tell us what happened..."
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  value={reportData.description}
                  onChange={(e) => setReportData({...reportData, description: e.target.value})}
                />
              </div>

              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all flex items-center justify-center gap-2">
                {isSubmitting ? 'Sending...' : 'Submit Report'} <Send size={14}/>
              </button>
            </form>
          )}

          {/* --- TERMS OF SERVICE --- */}
          {activeTab === 'terms' && (
            <div className="prose prose-sm prose-slate max-w-none">
              <h3 className="font-black text-slate-900 uppercase">Terms of Service</h3>
              <p className="text-xs text-slate-500">Effective Date: Feb 2026</p>
              
              <h4 className="font-bold text-slate-800 mt-4">1. Skill Game, Not Gambling</h4>
              <p className="text-xs text-slate-600">BrainBuffer is strictly a game of skill (Memory & Speed). Outcomes are determined by the user's ability, not chance. By playing, you agree that you are not engaging in gambling activities.</p>

              <h4 className="font-bold text-slate-800 mt-4">2. Refunds & Disconnects</h4>
              <p className="text-xs text-slate-600">We are not responsible for losses due to your unstable internet connection. If our server fails, a refund is automatic.</p>
            </div>
          )}

          {/* --- PRIVACY POLICY --- */}
          {activeTab === 'privacy' && (
            <div className="prose prose-sm prose-slate max-w-none">
              <h3 className="font-black text-slate-900 uppercase">Privacy Policy</h3>
              
              <div className="flex gap-3 items-center mt-4 bg-blue-50 p-3 rounded-xl">
                <Shield className="text-blue-500" size={20} />
                <p className="text-xs text-blue-800 font-bold">Your data is encrypted.</p>
              </div>

              <h4 className="font-bold text-slate-800 mt-4">Data We Collect</h4>
              <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
                <li>Phone Number (For identity & payments)</li>
                <li>Device ID (To prevent fraud/multiple accounts)</li>
                <li>Game Performance Data</li>
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}