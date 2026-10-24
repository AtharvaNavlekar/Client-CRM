import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Layers,
  ArrowRight,
  Headphones
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type AuthView = 'login' | 'signup' | 'forgot';

export const LoginModal: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');
  const isReversed = view === 'signup' || view === 'forgot';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D0C]/90 backdrop-blur-sm p-4 sm:p-6 md:p-8 animate-in fade-in overflow-y-auto">
      <div className="relative flex w-full max-w-4xl min-h-[520px] sm:min-h-[580px] max-h-[92vh] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 outline-none">
        
        {/* Form Panel (Left) */}
        <div 
          className={`absolute top-0 bottom-0 w-full sm:w-1/2 bg-white transition-transform duration-700 ease-in-out z-10 flex flex-col justify-center px-6 py-8 sm:px-10 md:px-12 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            isReversed ? 'sm:translate-x-full' : 'sm:translate-x-0'
          }`}
        >
          <div className="max-w-sm w-full mx-auto my-auto py-2">
            {view === 'login' && <LoginForm setView={setView} />}
            {view === 'signup' && <SignUpForm setView={setView} />}
            {view === 'forgot' && <ForgotForm setView={setView} />}
          </div>
        </div>

        {/* Enterprise Brand & Capability Showcase Panel (Right) */}
        <div 
          className={`hidden sm:block absolute top-0 bottom-0 w-1/2 transition-transform duration-700 ease-in-out p-3 ${
            isReversed ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="w-full h-full relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#003730] via-[#0A2621] to-[#041613] text-white p-8 flex flex-col justify-between border border-emerald-900/40 shadow-inner">
            {/* Subtle decorative background glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Brand Tag */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">DialPulse</span>
                  <span className="text-[10px] text-emerald-400/90 font-medium ml-1.5 uppercase tracking-widest">Enterprise</span>
                </div>
              </div>

              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/40 text-[10px] text-emerald-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>System Operational</span>
              </div>
            </div>

            {/* Core Capability Value Props */}
            <div className="relative z-10 space-y-6 my-auto py-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
                  High-Velocity Telecalling & Telecom Intelligence
                </h2>
                <p className="text-xs text-emerald-100/70 leading-relaxed">
                  Enterprise-grade lead distribution, TRAI-compliant outreach automation, and omnichannel customer communication.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start space-x-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-semibold text-white">Automated Compliance Guardrails</h3>
                    <p className="text-[11px] text-emerald-200/60 leading-normal mt-0.5">
                      Enforced 19:00–09:00 quiet hours, frequency capping, and instant DND exclusion.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <Layers className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-semibold text-white">Multi-Tier Access Control</h3>
                    <p className="text-[11px] text-emerald-200/60 leading-normal mt-0.5">
                      Hierarchical role scoping across Organization, Branch, and Telecaller levels.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <Headphones className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-semibold text-white">Direct Telephony & WhatsApp API</h3>
                    <p className="text-[11px] text-emerald-200/60 leading-normal mt-0.5">
                      Integrated carrier calling with cloud WhatsApp delivery and activity tracking.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Footnote */}
            <div className="relative z-10 pt-4 border-t border-emerald-900/50 flex items-center justify-between text-[10px] text-emerald-200/50 font-mono">
              <span className="flex items-center space-x-1">
                <Lock className="w-3 h-3 text-emerald-400/80 inline" />
                <span>256-Bit TLS 1.3 Encryption</span>
              </span>
              <span>SOC-2 &amp; TRAI Certified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- Sub-components for forms --- */

const LoginForm: React.FC<{ setView: (v: AuthView) => void }> = ({ setView }) => {
  const { login, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    clearSessionExpiredMessage();

    if (!email.trim() || !password) {
      setError('Please provide both your corporate email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Invalid authentication credentials. Please verify and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-emerald-50 text-[#00695C] border border-emerald-200/60 text-[11px] font-semibold tracking-wide uppercase">
          <Activity className="w-3.5 h-3.5 text-[#00695C]" />
          <span>DialPulse CRM Portal</span>
        </div>
        <h1 id="modal-login-title" className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Sign In to Your Workspace
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Enter your corporate credentials to access the telecalling and customer intelligence platform.
        </p>
      </div>

      {/* Notifications */}
      {sessionExpiredMessage && (
        <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left animate-in fade-in">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <span>{sessionExpiredMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs text-left animate-in fade-in">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3.5">
          {/* Email Field with Label */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-700">
              Corporate Email Address
            </label>
            <div className="relative flex items-center">
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.in"
                autoComplete="email"
                className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00695C]/20 focus:border-[#00695C] transition-colors shadow-xs"
                required
              />
              <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Password Field with Label */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-700">
              Account Password
            </label>
            <div className="relative flex items-center">
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00695C]/20 focus:border-[#00695C] transition-colors shadow-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Remember Me and Forgot Password */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center space-x-2 cursor-pointer group">
            <div className="relative flex items-center justify-center w-4 h-4 rounded border border-slate-300 bg-white group-hover:border-[#00695C] transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              {rememberMe && (
                <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-[#00695C]">
                  <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-xs text-slate-600 font-medium select-none">Remember this device</span>
          </label>
          <button 
            type="button" 
            onClick={() => setView('forgot')}
            className="text-xs text-[#00695C] font-semibold hover:text-[#005046] transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          id="btn-login-submit"
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#00695C] hover:bg-[#005046] active:scale-[0.99] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#00695C]/40 transition-all disabled:opacity-70 shadow-sm cursor-pointer mt-2"
        >
          <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
        
        {/* Footnote Access Help */}
        <div className="text-center pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Need workspace access?{' '}
            <button 
              type="button" 
              onClick={() => setView('signup')}
              className="text-[#00695C] font-semibold hover:underline transition-colors cursor-pointer"
            >
              Request Account Provisioning
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

const SignUpForm: React.FC<{ setView: (v: AuthView) => void }> = ({ setView }) => {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="space-y-2 text-left">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-emerald-50 text-[#00695C] border border-emerald-200/60 text-[11px] font-semibold tracking-wide uppercase">
          <Shield className="w-3.5 h-3.5 text-[#00695C]" />
          <span>Account Provisioning</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Request Workspace Access
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Submit your professional credentials to initiate role-based onboarding with your organization administrator.
        </p>
      </div>

      <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs text-left leading-relaxed">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#00695C]" />
        <span>
          <strong>Corporate Policy:</strong> User accounts are provisioned and audited by authorized organization owners and IT administrators.
        </span>
      </div>

      <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-3 text-left">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Priya Iyer"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00695C]/20 focus:border-[#00695C] transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Corporate Email</label>
            <input
              type="email"
              placeholder="priya@company.in"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00695C]/20 focus:border-[#00695C] transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Proposed Department / Role</label>
            <input
              type="text"
              placeholder="e.g. Sales Team Lead — Mumbai Branch"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00695C]/20 focus:border-[#00695C] transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#00695C] hover:bg-[#005046] active:scale-[0.99] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#00695C]/40 transition-all shadow-sm cursor-pointer mt-2"
        >
          <span>Submit Access Request</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-center pt-2">
        <button 
          type="button" 
          onClick={() => setView('login')}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 font-medium hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Sign In</span>
        </button>
      </div>
    </div>
  );
};

const ForgotForm: React.FC<{ setView: (v: AuthView) => void }> = ({ setView }) => {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="space-y-2 text-left">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px] font-semibold tracking-wide uppercase">
          <Lock className="w-3.5 h-3.5 text-amber-700" />
          <span>Security Administration</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Credential Recovery
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Initiate a verified password recovery request routed to your designated IT security administrator.
        </p>
      </div>

      <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs text-left leading-relaxed">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#00695C]" />
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
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00695C]/20 focus:border-[#00695C] transition-colors"
          />
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#00695C] hover:bg-[#005046] active:scale-[0.99] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#00695C]/40 transition-all shadow-sm cursor-pointer mt-2"
        >
          <span>Transmit Reset Instructions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-center pt-2">
        <button 
          type="button" 
          onClick={() => setView('login')}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 font-medium hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Sign In</span>
        </button>
      </div>
    </div>
  );
};
