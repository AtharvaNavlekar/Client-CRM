import React, { useState } from 'react';
import { Mail, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthBrand } from './AuthBrand';

export type AuthView = 'login' | 'signup' | 'forgot';

interface LoginFormProps {
  view: AuthView;
  setView: (v: AuthView) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ view, setView }) => {
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
      setError('Please provide both your work email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(
        err?.data?.error ||
          err?.message ||
          'Invalid authentication credentials. Please verify your email and password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col justify-between h-full w-full max-w-md mx-auto py-2">
      {/* Top Header: Brand Identity & Nav Tabs */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 sm:pb-8">
          <AuthBrand />
          
            {/* Top Navigation Tabs: Sign Up / Log In */}
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

        {/* Section Heading & Subtitle */}
        <div className="space-y-1.5 mb-6 text-left">
          <h1 id="modal-login-title" className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
            Sign in to continue to your DialPulse workspace.
          </p>
        </div>

        {/* Notification & Inline Error Banners */}
        {sessionExpiredMessage && (
          <div className="flex items-start space-x-2.5 p-3.5 mb-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left animate-in fade-in motion-reduce:animate-none">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <span>{sessionExpiredMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2.5 p-3.5 mb-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs text-left animate-in fade-in motion-reduce:animate-none">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Address */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <div className="relative flex items-center">
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                autoComplete="email"
                required
                className="w-full min-h-[44px] pl-4 pr-11 py-3 text-base sm:text-sm rounded-xl border border-cyan-400/80 bg-white text-slate-900 placeholder-slate-400 hover:border-cyan-500 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-[#075B65]/20 focus:border-[#075B65] focus:shadow-sm origin-center motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-in-out motion-safe:focus:scale-[1.012] motion-reduce:transition-none motion-reduce:transform-none shadow-xs login-input"
              />
              <Mail className="w-4 h-4 text-cyan-600 absolute right-3.5 pointer-events-none transition-colors duration-200 motion-reduce:transition-none" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-700">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="w-full min-h-[44px] pl-4 pr-12 py-3 text-base sm:text-sm rounded-xl border border-cyan-400/80 bg-white text-slate-900 placeholder-slate-400 hover:border-cyan-500 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-[#075B65]/20 focus:border-[#075B65] focus:shadow-sm origin-center motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-in-out motion-safe:focus:scale-[1.012] motion-reduce:transition-none motion-reduce:transform-none shadow-xs login-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer transition-colors duration-150 motion-reduce:transition-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me and Forgot Password */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2.5 min-h-[40px] cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-cyan-400/80 text-[#075B65] focus:ring-[#075B65]/30 cursor-pointer accent-[#075B65] transition-all duration-150 motion-reduce:transition-none"
              />
              <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors duration-150 motion-reduce:transition-none">
                Remember me
              </span>
            </label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="min-h-[40px] inline-flex items-center text-xs text-[#075B65] hover:text-[#053e45] font-semibold transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Primary Action Button (Minimal Black/Navy Button using Theme Colors) */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl bg-navy hover:bg-navy-hover active:scale-[0.99] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 motion-safe:transition-[background-color,transform,box-shadow] motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:active:scale-100 disabled:opacity-60 shadow-md hover:shadow-lg cursor-pointer mt-3 login-submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-white" />
                <span>Logging in...</span>
              </>
            ) : (
              <span>Log In</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer Support Info */}
      <div className="pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400">
          DialPulse Enterprise CRM Platform &bull; Secure Encrypted Session
        </p>
      </div>
    </div>
  );
};
