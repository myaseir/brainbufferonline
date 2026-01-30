"use client";

import { useState, useEffect } from 'react';
import { Mail, Lock, User, ShieldCheck, ArrowRight, RefreshCcw, RotateCcw } from 'lucide-react';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState('form'); 
  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', username: '' });
  };

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSignupRequest = async (e) => {
    if (e) e.preventDefault();
    if (!formData.email.includes('@')) return alert("Please enter a valid email.");
    setLoading(true);
    try {
      // 👇 Updated to use the Environment Variable
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStep('otp');
        setResendTimer(60); 
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Action failed.");
      }
    } catch (err) {
      alert("Backend server connection failed.");
    } finally {
      setLoading(false);
    }
  };

 const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // ✅ SAVE THE TOKEN TO LOCAL STORAGE IMMEDIATELY
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('wallet_balance', data.user.wallet_balance);

        // ✅ PASS THE WHOLE DATA OBJECT (so page.js sees access_token)
        onLoginSuccess(data); 
      } else {
        alert(data.detail || "Login failed.");
      }
    } catch (err) {
      alert("Login server error.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) return alert("Please enter a 6-digit code.");
    setLoading(true);
    try {
      // 👇 Updated to use the Environment Variable
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: verificationCode }),
      });

      if (res.ok) {
        alert("Account verified! You can now log in.");
        setIsLogin(true);
        setStep('form');
        setVerificationCode('');
      } else {
        alert("Invalid or expired code.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfdfd] p-4 font-sans text-slate-800 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-100/50 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-50/50 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-green-900/5 p-8 md:p-10 border border-white relative z-10">
        
        {/* Branding */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-green-400 to-emerald-300 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-green-200">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
            Brain<span className="text-green-500">Buffer</span>
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
            {step === 'otp' ? 'Security Verification' : (isLogin ? 'Authorized Access Only' : 'Create Commander Profile')}
          </p>
        </div>

        {step === 'form' ? (
          <form onSubmit={isLogin ? handleLogin : handleSignupRequest} className="space-y-4">
            {!isLogin && (
              <div className="group">
                <div className="relative flex items-center">
                  <User className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Username"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm text-slate-700"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="group">
              <div className="relative flex items-center">
                <Mail className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  placeholder="Email Address"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm text-slate-700"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="group">
              <div className="relative flex items-center">
                <Lock className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
                <input 
                  type="password" 
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm text-slate-700"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-green-400 to-emerald-400 text-white font-black py-4 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 mt-6"
            >
              <span className="relative z-10 uppercase tracking-widest text-xs">
                {loading ? <RefreshCcw className="animate-spin" /> : (isLogin ? 'Log in' : 'Sign Up')}
              </span>
              {!loading && <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            </button>

            <div className="text-center pt-4">
              <button 
                type="button"
                onClick={toggleMode}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-green-500 transition-colors"
              >
                {isLogin ? "New ? Register" : "Existing Member? Login"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="text-center p-6 bg-green-50/50 rounded-2xl border border-green-100">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Verify Identity</p>
              <p className="text-slate-900 font-bold text-sm">{formData.email}</p>
            </div>
            
            <input 
              type="text" 
              placeholder="000000" 
              maxLength={6}
              className="w-full text-center text-3xl tracking-[0.3em] font-black py-5 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:border-green-400 outline-none transition-all text-slate-800"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            />

            <button 
              onClick={handleVerifyCode}
              disabled={loading}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest text-xs disabled:opacity-70"
            >
              {loading ? 'Validating...' : 'Confirm Identity'}
            </button>

            <div className="flex flex-col gap-4">
              <button 
                type="button"
                onClick={() => handleSignupRequest()}
                disabled={resendTimer > 0 || loading}
                className="flex items-center justify-center gap-2 mx-auto text-[10px] font-black uppercase tracking-widest text-green-600 disabled:text-slate-300 transition-colors"
              >
                <RotateCcw size={14} className={loading ? "animate-spin" : ""} />
                {resendTimer > 0 ? `Resend Available in ${resendTimer}s` : "Resend Security Code"}
              </button>
              
              <button 
                onClick={() => { setStep('form'); setVerificationCode(''); }}
                className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
              >
                Cancel Registration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}