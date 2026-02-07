"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { 
  Mail, Lock, User, ShieldCheck, ArrowRight, 
  RefreshCcw, RotateCcw, Smartphone, Scale, BookOpen, ChevronDown 
} from 'lucide-react';
import Link from 'next/link';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState('form'); 
  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
const [acceptedTerms, setAcceptedTerms] = useState(false);
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

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSignupRequest = async (e) => {
    if (e) e.preventDefault();
    if (!acceptedTerms) {
    return alert("You must accept the Terms and Conditions to join the arena.");
  }
    if (!formData.email.includes('@')) return alert("Please enter a valid email.");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          username: formData.username.trim()
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStep('otp');
        setResendTimer(60); 
      } else {
        alert(data.detail || "Action failed.");
      }
    } catch (err) {
      alert("Backend server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: formData.email.trim().toLowerCase(), 
          password: formData.password 
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
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

  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    if (verificationCode.length !== 6) return alert("Please enter a 6-digit code.");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase(), code: verificationCode }),
      });

      if (res.ok) {
        alert("Account verified! You can now log in.");
        setIsLogin(true);
        setStep('form');
        setVerificationCode('');
      } else {
        const err = await res.json();
        alert(err.detail || "Invalid or expired code.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (

    
    <div className="min-h-screen bg-[#fcfdfd] font-sans text-slate-800 scroll-smooth overflow-x-hidden">
      {/* Add this inside the main <div> of your return */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "BrainBuffer",
      "operatingSystem": "ANDROID",
      "applicationCategory": "GameApplication",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "ratingCount": "1050"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "PKR"
      }
    })
  }}
/>
      {/* 1. HERO & AUTH SECTION */}
      <section className="min-h-[80vh] md:min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Decorative Glows */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-100/40 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-50/40 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-green-900/10 p-6 md:p-10 border border-white relative z-10 transition-all hover:shadow-green-900/20">
          
          {/* Branding */}
        
<div className="text-center mb-6 md:mb-8">
<div className="w-20 h-20 md:w-24 md:h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl shadow-green-500/20 animate-pulse relative overflow-hidden border border-slate-800">
  <Image 
    src="/brainbuffer.png" 
    alt="BrainBuffer Logo"
    width={96}      // Increased to match container
    height={96} 
    className="object-contain p-1" // Reduced padding from p-2 to p-1 to make the brain bigger
  />
</div>
  <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 uppercase">
    Brain<span className="text-green-500">Buffer</span>
  </h1>
  <p className="text-slate-400 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.25em] mt-2">
    {step === 'otp' ? 'Verification' : (isLogin ? 'Competitive Arena Access' : 'Register Commander Profile')}
  </p>
</div>

          {step === 'form' ? (
            <form onSubmit={isLogin ? handleLogin : handleSignupRequest} className="space-y-3 md:space-y-4">
              {!isLogin && (
                <div className="group relative flex items-center">
                  <User className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="Username"
                    className="w-full pl-12 pr-4 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm text-slate-700"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="group relative flex items-center">
                <Mail className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  placeholder="Email Address"
                  className="w-full pl-12 pr-4 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm text-slate-700"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div className="group relative flex items-center">
                <Lock className="absolute left-4 text-slate-400 group-focus-within:text-green-500 transition-colors" size={18} />
                <input 
                  type="password" 
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-green-400 outline-none transition-all font-bold text-sm text-slate-700"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
{!isLogin && (
  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-green-200">
    <div className="relative flex items-center h-5">
      <input
        id="terms"
        type="checkbox"
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
        className="w-5 h-5 rounded-md border-slate-300 text-green-500 focus:ring-green-500 cursor-pointer"
        required
      />
    </div>
    <div className="text-[10px] md:text-xs leading-tight">
      <label htmlFor="terms" className="font-bold text-slate-700 cursor-pointer">
        I accept the <Link href="/terms" className="text-green-600 underline">Terms and Conditions</Link>
      </label>
      <p className="text-slate-400 mt-1 font-medium italic">
        I acknowledge BrainBuffer is a skill-based arena and I am responsible for my cognitive performance.
      </p>
    </div>
  </div>
)}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-black py-3 md:py-4 rounded-xl shadow-lg transition-all active:scale-[0.97] flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                <span className="uppercase tracking-widest text-[10px] md:text-xs">
                  {loading ? <RefreshCcw className="animate-spin" /> : (isLogin ? 'Log in' : 'Join Arena')}
                </span>
                {!loading && <ArrowRight size={18} />}
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={toggleMode}
                  className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-green-500 transition-colors"
                >
                  {isLogin ? "New Challenger? Register" : "Member? Login"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4 md:space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="text-center p-4 md:p-6 bg-green-50/50 rounded-2xl border border-green-100">
                <p className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mb-1">Security Code Sent To</p>
                <p className="text-slate-900 font-bold text-xs md:text-sm truncate">{formData.email}</p>
              </div>
              
              <input 
                type="text" 
                placeholder="000000" 
                maxLength={6}
                className="w-full text-center text-2xl md:text-3xl tracking-[0.3em] font-black py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:border-green-400 outline-none transition-all text-slate-800"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
              />

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white font-black py-3 md:py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest text-xs disabled:opacity-70"
              >
                {loading ? 'Validating...' : 'Verify & Enter'}
              </button>

              <button 
                type="button"
                onClick={() => handleSignupRequest()}
                disabled={resendTimer > 0 || loading}
                className="w-full text-[10px] font-black uppercase tracking-widest text-green-600 disabled:text-slate-300"
              >
                <RotateCcw size={12} className={`inline mr-1 ${loading ? "animate-spin" : ""}`} />
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Security Code"}
              </button>
            </form>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all">
  
</div>

        {/* Scroll Hint */}
        <div 
          onClick={() => scrollToSection('download')}
          className="absolute bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap- md:gap-2 cursor-pointer z-20 group"
        >
           <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-green-500 transition-colors">Legal & App</span>
           <ChevronDown className="animate-bounce text-green-500" size={30} />
        </div>
      </section>

      {/* 2. APP DOWNLOAD & INSTALLATION GUIDE */}
      <section id="download" className="max-w-5xl mx-auto px-6 py-16 md:py-24 border-t border-slate-100">
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          <div className="w-full order-2 lg:order-1">
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 uppercase mb-6 flex flex-wrap items-center justify-center lg:justify-start gap-2 md:gap-3 text-center lg:text-left">
              <Smartphone className="text-green-500 shrink-0" /> 
              <span>Professional</span> 
              <span className="text-green-500">Installation</span>
            </h2>
            
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed mb-8 text-center lg:text-left">
              BrainBuffer is a direct-distributed eSports app. Since we host our own secure servers, 
              you will need to enable manual installation on your Android device.
            </p>

            <div className="space-y-4 md:space-y-6">
              {[
                { step: 1, title: "Download APK", desc: "Tap the download button. If prompted with \"File might be harmful,\" select Download anyway." },
                { step: 2, title: "Enable Unknown Sources", desc: "Open your phone Settings > Security > Install Unknown Apps. Toggle Allow from this source for your browser." },
                { step: 3, title: "Launch & Authenticate", desc: "Open the downloaded file, tap Install, and log in with your Commander Profile." }
              ].map((item) => (
                <div key={item.step} className="flex gap-4 p-4 md:p-5 bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:border-green-200">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-green-50 text-green-600 flex items-center justify-center font-black text-base md:text-lg shrink-0">{item.step}</div>
                  <div>
                    <p className="font-bold text-xs md:text-sm text-slate-800 uppercase tracking-tight">{item.title}</p>
                    <p className="text-[10px] md:text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6">
  <a 
  
    href="https://github.com/myaseir/brainbufferofficial/releases/download/v4.7.0/BrainBuffer.apk" 
    download="BrainBuffer.apk"
    /* Changed w-full to w-fit and added md:px-12 for a more substantial look on laptop */
    className="w-fit min-w-[240px] text-center bg-slate-900 text-white px-8 md:px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-[11px] hover:bg-green-600 transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
  >
    <Smartphone size={16} className="text-green-400" />
    Download BrainBuffer v4.7
  </a>
  
  <div className="flex flex-col items-center lg:items-start">
    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
      Current Build: <span className="text-slate-900">v4.7.0-Stable</span>
    </p>
    <p className="text-[9px] md:text-[10px] text-slate-300 font-bold uppercase tracking-widest">
      Size: 25MB • Android 6.0+
    </p>
  </div>
</div>
          </div>

          {/* Centered Phone Preview for Mobile */}
          <div className="w-full order-1 lg:order-2 flex justify-center lg:justify-end py-4">
            <div className="relative group">
              <div className="aspect-[9/16] w-56 md:w-64 bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] border-[6px] md:border-8 border-slate-900 overflow-hidden shadow-2xl transition-transform lg:group-hover:rotate-2 relative">
                <Image 
                  src="https://res.cloudinary.com/dxxqrjnje/image/upload/v1770102856/electronic_kits/c0klrdidzumkr74vw67f.jpg"
                  alt="BrainBuffer Gameplay Preview"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-green-400/20 blur-3xl rounded-full -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ETHICAL & LEGAL COMPLIANCE */}
      <section className="bg-slate-900 text-white py-16 md:py-24 px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 md:gap-12 relative z-10">
          <div className="space-y-4 md:space-y-6 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 text-green-400">
               <BookOpen size={24} />
               <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Islamic Foundation</h3>
            </div>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-medium">
              BrainBuffer is a strictly <span className="text-white font-bold">Skill-Based Arena</span>. 
              Our platform is engineered as a test of <span className="text-green-400">Aql (Intellectual Merit)</span>, 
              where outcomes are determined by memory, speed, and cognitive effort. 
              Aligned with the rationalist framework of 
              <a href="https://ask.ghamidi.org/forums/discussion/107102/" target="_blank" rel="noopener noreferrer" className="text-white underline decoration-green-500/50 hover:text-green-400 transition-colors font-bold ml-1">Scholars</a>, 
              activities where success depends on effort rather than chance are recognized as 
              legitimate economic pursuits, ethically <span className="text-white font-bold">distinct from gambling (Maisir)</span>.
            </p>
          </div>
          
          <div className="space-y-4 md:space-y-6 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 text-green-400">
               <Scale size={25} />
               <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Legal Standing</h3>
            </div>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-medium">
              BrainBuffer is a <span className="text-white font-bold">Competitive Skill-Based Arena</span> where 
              results are determined exclusively by cognitive precision and memory retention. In accordance with 
              established legal precedents and the exemptions provided under 
              <a href="https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-ap4%3D-sg-jjjjjjjjjjjjj" title="Pakistan Public Gambling Act Section 12 Exemption for Skill Games" target="_blank" rel="noopener noreferrer" className="text-white underline decoration-green-500/50 hover:text-green-400 transition-colors font-bold ml-1">Section 12 of the Public Gambling Act</a>, 
              competitions where <span className="text-green-400">Skill and Merit</span> are the dominant factors 
              in determining the outcome are recognized as legitimate professional activities, 
              distinct from games of chance.
            </p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-[30%] h-[30%] bg-green-500/5 blur-[120px] rounded-full"></div>
      </section>
<div className="fixed bottom-6 right-6 z-50">
  <button className="bg-white shadow-xl border border-slate-100 p-3 rounded-full hover:scale-110 transition-transform">
    <ShieldCheck size={20} className="text-green-500" />
  </button>
</div>
      {/* 4. FOOTER */}
      <footer className="py-12 md:py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-4 md:mb-6">Glacia Connection Deployment</p>
          <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed max-w-xl mx-auto italic">
            BrainBuffer is a premier eSports platform powered by 
            <span className="text-slate-900 font-bold ml-1">Glacia Connection</span>, 
            the technology division of our SECP-registered corporate entity. 
            Dedicated to fostering cognitive excellence and skill-based digital solutions for Pakistan’s youth.
          </p>
          <div className="mt-8 pt-8 border-t border-slate-100 flex flex-wrap justify-center gap-4 md:gap-8">
            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-300">© 2026 Glacia Connection</span>
            <Link href="/privacy" className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-green-500 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-green-500 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}