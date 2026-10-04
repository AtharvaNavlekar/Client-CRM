import React, { useEffect, useRef } from 'react';
import { ShieldAlert, AlertTriangle, X, Lock } from 'lucide-react';

interface DevToolsWarningOverlayProps {
  isOpen: boolean;
  onDismiss?: () => void; // Maintained as optional for backwards compatibility, but dismiss action is intentionally omitted
}

/**
 * Full-screen Opaque Security Lock Screen shown when browser developer tools are detected.
 *
 * Implements strict security lock requirements:
 * - Opaque background: Prevents any sensitive CRM state (leads, phone numbers, messages) from being visible.
 * - Non-dismissible: No dismiss button, no close button, clicking outside does not dismiss.
 * - Event containment: Prevents keyboard navigation (Escape, Tab) from escaping to underlying CRM controls.
 * - Clear compliance copy without exposing internal technical detection details.
 */
export const DevToolsWarningOverlay: React.FC<DevToolsWarningOverlayProps> = ({ isOpen }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Trap focus inside the security overlay to prevent keyboard navigation to CRM controls
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Escape from bypassing
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Trap Tab key inside the lock screen
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (containerRef.current) {
          containerRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    // Focus the lock container
    if (containerRef.current) {
      containerRef.current.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="devtools-security-lock-screen"
      ref={containerRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="devtools-warning-title"
      aria-describedby="devtools-warning-desc"
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950 p-4 select-none outline-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-[#131722] p-8 shadow-2xl border border-slate-800 text-slate-100 text-center"
      >
        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-300 text-xs font-semibold tracking-wider uppercase mb-5">
          <Lock className="w-3.5 h-3.5 text-red-400" />
          <span>Security Lock Active</span>
        </div>

        {/* Shield Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Primary Security Title */}
        <h2 id="devtools-warning-title" className="text-xl font-bold tracking-tight text-white">
          Developer tools are restricted on this application.
        </h2>

        {/* Supporting Copy */}
        <p id="devtools-warning-desc" className="mt-3 text-sm text-slate-300 leading-relaxed">
          Browser inspection tools are restricted while using DialPulse CRM. Close developer tools to continue.
        </p>

        {/* Policy Box */}
        <div className="mt-5 p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-left text-xs text-slate-400 space-y-1.5">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Enterprise Data Protection Policy
          </div>
          <p>
            For compliance and sensitive CRM data protection, UI access and interactions are suspended while inspection tools remain active.
          </p>
          <p className="text-slate-500 text-[11px] pt-1">
            Once developer inspection tools are closed, application access will restore automatically. Unresolved lock states will terminate sessions for data security.
          </p>
        </div>
      </div>
    </div>
  );
};

interface AutomationWarningBannerProps {
  isVisible: boolean;
  onDismiss: () => void;
  reasons?: string[];
}

/**
 * Top-of-app notification banner displayed when client-side browser automation heuristics trigger.
 * Informs the user without hard-locking app functionality.
 */
export const AutomationWarningBanner: React.FC<AutomationWarningBannerProps> = ({
  isVisible,
  onDismiss,
  reasons
}) => {
  if (!isVisible) return null;

  return (
    <aside
      id="automation-detection-banner"
      aria-label="Automated browser warning"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/80 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="font-medium truncate">
          Automated browser access detected. If you are a human seeing this message, please disable browser automation extensions or contact support.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          aria-label="Close automation warning banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
