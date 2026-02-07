"use client";
import React, { useState } from 'react';
import { Share2, Copy, Gift, Check, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ReferralCard = ({ user, onUpdateUser }) => {
  const [claimCode, setClaimCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    // Prevent accidental form triggers or parent bubbling
    e.preventDefault();
    e.stopPropagation();

    if (!user?.referral_code) {
        toast.error("Referral code not found");
        return;
    }

    navigator.clipboard.writeText(user.referral_code)
      .then(() => {
        setCopied(true);
        toast.success("Code copied!");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy code");
      });
  };

const shareToWhatsApp = () => {
  const referralCode = user?.referral_code || "MYCODE";
  
  // Structured to highlight the 100 PKR immediately
  const message = 
    `🔥 *EARN 100 PKR INSTANTLY!* 💰\n\n` +
    `I'm using *BrainBuffer* to sharpen my mind and earn real cash. 🧠✨\n\n` +
    `1️⃣ Download the app below\n` +
    `2️⃣ Enter my code: *${referralCode}*\n` +
    `3️⃣ Get *100 PKR* added to your wallet immediately! 🎁\n\n` +
    `🚀 *Download Link:* \n` +
    `https://brainbufferofficial.com\n\n` +
    `_Play. Sharpen. Earn._ 🇵🇰`;

  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

  const handleClaim = async () => {
    if (!claimCode) return toast.error("Please enter a referral code");
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
        toast.success("Bonus Claimed! +100 PKR");
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
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

          <div className="relative text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl mb-2 shadow-sm">
              <Gift size={28} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Refer & Earn</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Share your code with friends. You both get <span className="font-bold text-emerald-600">100 PKR</span> when they join!
            </p>
          </div>

          {/* Improved Copy Button Section */}
          <div className="flex justify-center">
            <button 
              type="button"
              onClick={handleCopy}
              className="group relative flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-white rounded-2xl p-3 transition-all duration-300 w-52 outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Your Code</span>
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
                <Sparkles size={16} className="text-amber-500" fill="currentColor" />
                <span>Have a referral code?</span>
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="ENTER CODE" 
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
              <p className="text-xs text-slate-400">
                Enter a friend's code to unlock your <span className="text-emerald-600 font-medium">welcome bonus</span>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralCard;