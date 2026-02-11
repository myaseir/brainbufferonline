"use client";
import { useState } from 'react';
import { Mail, Lock, ShieldCheck, ArrowRight, RefreshCcw, CheckCircle2 } from 'lucide-react';

export default function ForgetPassword({ onBack }) {
  const [step, setStep] = useState('request'); // 'request', 'verify', or 'new_password'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Step 1: Request OTP
  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        setStep('verify');
        setMessage("Security code dispatched to your email.");
      } else {
        const data = await res.json();
        setError(data.detail || "Request failed.");
      }
    } catch (err) { setError("Backend server unreachable."); }
    finally { setLoading(false); }
  };

  // Step 2: Verify OTP (Local check before showing password fields)
// Step 2: ACTUALLY verify the code with the Backend
const handleVerify = async (e) => {
  e.preventDefault();
  if (otp.length !== 6) return setError("Please enter a 6-digit code.");
  
  setLoading(true);
  setError("");
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/password/verify-code?code=${otp}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (res.ok) {
      setStep('new_password'); // Only moves forward if Backend confirms the code
    } else {
      const data = await res.json();
      setError(data.detail || "Invalid code. Please check your email.");
    }
  } catch (err) {
    setError("Connection lost. Try again.");
  } finally {
    setLoading(false);
  }
};

// Step 3: Final Password Update
const handleSubmitNewPassword = async (e) => {
  e.preventDefault();
  if (passwords.new !== passwords.confirm) return setError("Passwords do not match.");
  
  setLoading(true);
  setError("");
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: otp, // Sending the code again for final security check
        new_password: passwords.new
      }),
    });

    if (res.ok) {
      setStep('success');
      setTimeout(() => onBack(), 2500);
    } else {
      const data = await res.json();
      setError(data.detail || "Session expired. Restart reset process.");
    }
  } catch (err) { setError("Update failed."); }
  finally { setLoading(false); }
};

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900">
          Reset <span className="text-green-500">Access</span>
        </h2>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
          {step === 'request' && 'Identity Verification'}
          {step === 'verify' && 'Enter Security Code'}
          {step === 'new_password' && 'Secure New Credentials'}
          {step === 'success' && 'Reset Complete'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center gap-2">
          <ShieldCheck className="text-red-500 shrink-0" size={16} />
          <p className="text-[11px] font-bold text-slate-700">{error}</p>
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="group relative flex items-center">
            <Mail className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="email" placeholder="Commander Email" required
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]">
            {loading ? <RefreshCcw className="animate-spin" /> : 'Request Code'} <ArrowRight size={16} />
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-4">
          <input 
            type="text" placeholder="000000" maxLength={6} required
            className="w-full text-center text-3xl font-black py-4 bg-slate-50 border border-slate-100 rounded-xl tracking-[0.3em]"
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px]">
            Verify Code
          </button>
        </form>
      )}

      {step === 'new_password' && (
        <form onSubmit={handleSubmitNewPassword} className="space-y-4">
          <div className="group relative flex items-center">
            <Lock className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="password" placeholder="New Password" required
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:border-green-400 outline-none transition-all font-bold text-sm"
              value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})}
            />
          </div>
          <div className="group relative flex items-center">
            <ShieldCheck className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
            <input 
              type="password" placeholder="Confirm Password" required
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:border-green-400 outline-none transition-all font-bold text-sm"
              value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-green-500 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
            {loading ? <RefreshCcw className="animate-spin" /> : 'Confirm New Password'}
          </button>
        </form>
      )}

      {step === 'success' && (
        <div className="text-center py-8 animate-bounce">
          <CheckCircle2 className="mx-auto text-green-500 mb-4" size={64} />
          <p className="text-sm font-bold text-slate-700">{message}</p>
        </div>
      )}

      {step !== 'success' && (
        <button 
          type="button" onClick={onBack}
          className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-green-500 transition-colors"
        >
          Return to Portal
        </button>
      )}
    </div>
  );
}