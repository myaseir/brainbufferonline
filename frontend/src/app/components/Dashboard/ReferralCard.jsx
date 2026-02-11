"use client";
import React, { useState } from 'react';
import { Share2, Copy, Gift, Check, Loader2, Sparkles, ArrowRight, Heart, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ReferralCard = ({ user, onUpdateUser }) => {
  const [claimCode, setClaimCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.preventDefault();
    if (!user?.referral_code) return toast.error("Referral code not found");
    navigator.clipboard.writeText(user.referral_code).then(() => {
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareToWhatsApp = () => {
    const referralCode = user?.referral_code || "MYCODE";
    // 🧠 Updated for "Social Growth" hook
    const message = 
      `🧠 Join me on BrainBuffer! 🇵🇰\n\n` +
      `I'm sharpening my skills and competing in the ultimate brain challenges. Use my code to join my network and let's see who's faster! ⚡\n\n` +
      `1️⃣ Download the app\n` +
      `2️⃣ Enter my code: ${referralCode}\n\n` +
      `🚀 Join here: \n` +
      `https://www.brainbufferofficial.com\n\n` +
      `_Play. Compete. Win._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleClaim = async () => {
    if (!claimCode) return toast.error("Please enter a code");
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallet/referral/claim`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: claimCode.trim().toUpperCase() })
      });
      const data = await res.json();
      if (res.ok) {
        // 📝 Updated message: Honest feedback
        toast.success("Success! You're now linked with your friend.");
        if (onUpdateUser) onUpdateUser();
        setClaimCode('');
      } else {
        toast.error(data.detail || "Invalid code");
      }
    } catch (err) {
      toast.error("Network connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 font-sans">
        <div className="relative p-6 sm:p-8 space-y-6">
          <div className="relative text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl mb-2 shadow-sm">
              <Users size={28} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Build Your Network</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Invite friends to BrainBuffer and see your <span className="font-bold text-indigo-600">Influence Score</span> grow!
            </p>
          </div>

          <div className="flex justify-center">
            <button 
              type="button"
              onClick={handleCopy}
              className="group relative flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-white rounded-2xl p-3 transition-all duration-300 w-52 outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Your Unique Code</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-black text-slate-800 tracking-wider group-hover:text-indigo-600 transition-colors pointer-events-none">
                  {user?.referral_code || "..."}
                </span>
                <div className="text-slate-300 group-hover:text-indigo-600 transition-colors">
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </div>
              </div>
            </button>
          </div>

          <button 
            onClick={shareToWhatsApp}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3"
          >
            <Share2 size={18} />
            <span>Invite via WhatsApp</span>
          </button>
        </div>

        {!user?.referred_by && (
          <div className="bg-slate-50 border-t border-slate-100 p-6 sm:p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <Heart size={16} className="text-pink-500" fill="currentColor" />
                <span>Got a friend's code?</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="ENTER CODE HERE" 
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all uppercase placeholder:normal-case"
                />
                <button 
                  onClick={handleClaim}
                  disabled={loading || !claimCode}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 transition-colors flex items-center justify-center min-w-[3rem]"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 italic">
                Enter a friend's code to show your support and link your accounts.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralCard;