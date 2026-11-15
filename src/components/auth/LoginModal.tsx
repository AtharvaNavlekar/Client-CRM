import React, { useState } from 'react';
import { ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-react';
import { AuthBrand } from './AuthBrand';
import { LoginForm, AuthView } from './LoginForm';
import { AuthVisualPanel } from './AuthVisualPanel';

export const LoginModal: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[#075B65] p-3 sm:p-6 lg:p-8 py-4 sm:py-6 overflow-y-auto">
      {/* Decorative Geometric Wave & Curve Background Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 1920 1080"
        >
          <defs>
            <linearGradient id="tealWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#26C6DA" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#80DEEA" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path
            d="M-100,200 C300,50 700,320 1100,140 C1500,-40 1700,200 2020,150"
            fill="none"
            stroke="url(#tealWaveGrad)"
            strokeWidth="2"
          />
          <path
            d="M-100,450 C400,250 850,550 1350,300 C1650,150 1850,420 2020,380"
            fill="none"
            stroke="url(#tealWaveGrad)"
            strokeWidth="1.75"
          />
          <path
            d="M-100,750 C350,900 850,550 1400,800 C1750,950 1900,650 2020,720"
            fill="none"
            stroke="url(#tealWaveGrad)"
            strokeWidth="1.5"
          />
          <circle
            cx="20%"
            cy="25%"
            r="380"
            fill="none"
            stroke="#26C6DA"
            strokeWidth="1"
            strokeDasharray="6 8"
            opacity="0.3"
          />
          <circle
            cx="80%"
            cy="75%"
            r="480"
            fill="none"
            stroke="#80DEEA"
            strokeWidth="1"
            strokeDasharray="8 10"
            opacity="0.25"
          />
        </svg>
      </div>

      {/* Main Centered Authentication Container */}
      <div className="relative z-10 flex flex-col lg:flex-row w-full sm:w-[92%] max-w-[1450px] min-h-0 lg:min-h-[600px] lg:h-[min(740px,90dvh)] lg:max-h-[92dvh] bg-white rounded-3xl lg:rounded-[36px] overflow-hidden shadow-2xl shadow-teal-950/40 border border-white/20 my-auto">
        
        {/* Left Section: Authentication Form (~53% Desktop Width) */}
        <section 
          className="w-full lg:w-[53%] bg-white p-5 sm:p-8 lg:p-10 xl:p-12 flex flex-col justify-between overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="User Authentication Form"
        >
          {view === 'login' && <LoginForm view={view} setView={setView} />}
          {view === 'signup' && <SignUpForm view={view} setView={setView} />}
          {view === 'forgot' && <ForgotForm setView={setView} />}
        </section>

        {/* Right Section: Immersive Visual Experience Panel (~47% Desktop Width) */}
        <section 
          className="hidden lg:flex lg:w-[47%] h-full p-3.5 pl-0 bg-white"
          aria-label="Visual Overview and Enterprise Highlights"
        >
          <AuthVisualPanel />
        </section>

      </div>
    </div>
  );
};

/* --- Supplementary Flows: Sign Up & Password Recovery --- */

const SignUpForm: React.FC<{ view: AuthView; setView: (v: AuthView) => void }> = ({ view, setView }) => {
  return (
    <div className="flex flex-col justify-between h-full w-full max-w-md mx-auto py-2 animate-in fade-in zoom-in-95 motion-reduce:animate-none duration-300">
      <div>
        {/* Top Header with Brand and Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 sm:pb-8">
          <AuthBrand />
          <nav className="flex items-center space-x-2" aria-label="Authentication Options">
            <button
              type="button"
              onClick={() => setView('signup')}
              className={`min-h-[40px] px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-200 motion-reduce:transition-none cursor-pointer ${
                view === 'signup'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-500'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setView('login')}
              className={`min-h-[40px] px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-200 motion-reduce:transition-none cursor-pointer ${
                view === 'login'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-500'
              }`}
            >
              Log In
            </button>
          </nav>
        </div>

        <div className="space-y-1.5 mb-6 text-left">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Request Access
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
            Submit your professional details to initiate verified workspace provisioning.
          </p>
        </div>

        <div className="flex items-start space-x-2.5 p-3.5 mb-5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs text-left leading-relaxed">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#075B65]" />
          <span>
            <strong>Corporate Governance:</strong> DialPulse user accounts are verified and provisioned by organization IT administrators.
          </span>
        </div>

        <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-3 text-left">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Priya Iyer"
                className="w-full min-h-[44px] px-4 py-2.5 text-base sm:text-sm rounded-xl border border-cyan-400/80 bg-white text-slate-900 placeholder-slate-400 hover:border-cyan-500 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-[#075B65]/20 focus:border-[#075B65] focus:shadow-sm transition-all duration-200 ease-in-out motion-reduce:transition-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Corporate Email</label>
              <input
                type="email"
                placeholder="priya@company.in"
                className="w-full min-h-[44px] px-4 py-2.5 text-base sm:text-sm rounded-xl border border-cyan-400/80 bg-white text-slate-900 placeholder-slate-400 hover:border-cyan-500 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-[#075B65]/20 focus:border-[#075B65] focus:shadow-sm transition-all duration-200 ease-in-out motion-reduce:transition-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Department / Role</label>
              <input
                type="text"
                placeholder="e.g. Sales Team Lead — Mumbai Branch"
                className="w-full min-h-[44px] px-4 py-2.5 text-base sm:text-sm rounded-xl border border-cyan-400/80 bg-white text-slate-900 placeholder-slate-400 hover:border-cyan-500 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-[#075B65]/20 focus:border-[#075B65] focus:shadow-sm transition-all duration-200 ease-in-out motion-reduce:transition-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl bg-black hover:bg-slate-900 active:scale-[0.99] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-black/40 transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:active:scale-100 shadow-md hover:shadow-lg cursor-pointer mt-3"
          >
            <span>Submit Access Request</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="pt-6 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => setView('login')}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 font-medium hover:text-slate-900 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Log In</span>
        </button>
      </div>
    </div>
  );
};

const ForgotForm: React.FC<{ setView: (v: AuthView) => void }> = ({ setView }) => {
  return (
    <div className="flex flex-col justify-between h-full w-full max-w-md mx-auto py-2 animate-in fade-in zoom-in-95 motion-reduce:animate-none duration-300">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 sm:pb-8">
          <AuthBrand />
          <button
            type="button"
            onClick={() => setView('login')}
            className="min-h-[40px] px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm bg-white border border-slate-300 text-slate-700 hover:border-slate-500 transition-all duration-200 motion-reduce:transition-none cursor-pointer"
          >
            Log In
          </button>
        </div>

        <div className="space-y-1.5 mb-6 text-left">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Reset Password
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
            Enter your verified corporate email to request a secure password reset link.
          </p>
        </div>

        <div className="flex items-start space-x-2.5 p-3.5 mb-5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs text-left leading-relaxed">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#075B65]" />
          <span>
            <strong>Security Notice:</strong> In accordance with enterprise RBAC policy, password resets require domain authentication confirmation.
          </span>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700">Verified Corporate Email</label>
            <input
              type="email"
              placeholder="name@company.in"
              required
              className="w-full min-h-[44px] px-4 py-3 text-base sm:text-sm rounded-xl border border-cyan-400/80 bg-white text-slate-900 placeholder-slate-400 hover:border-cyan-500 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-[#075B65]/20 focus:border-[#075B65] focus:shadow-sm transition-all duration-200 ease-in-out motion-reduce:transition-none"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl bg-black hover:bg-slate-900 active:scale-[0.99] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-black/40 transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:active:scale-100 shadow-md hover:shadow-lg cursor-pointer mt-3"
          >
            <span>Transmit Reset Instructions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="pt-6 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => setView('login')}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 font-medium hover:text-slate-900 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Log In</span>
        </button>
      </div>
    </div>
  );
};
