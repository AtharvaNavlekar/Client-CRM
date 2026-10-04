/* This is a defense-in-depth client deterrent and security locking control. It does not replace authoritative server-side security. Secrets, API keys, database credentials, and business logic must always remain strictly server-side. */

import React, { useEffect, useState } from 'react';

/**
 * Threshold in pixels between outer and inner window dimensions that indicates
 * a docked browser developer tools drawer is open.
 */
export const DEVTOOLS_DIMENSION_THRESHOLD = 160;

/**
 * Security lock states for application deterrence
 */
export type SecurityLockState = 'NORMAL' | 'SUSPICIOUS' | 'SECURITY_LOCKED';

export interface DevToolsDeterrenceOptions {
  consecutiveSamplesRequired?: number; // default: 3
  consecutiveClearRequired?: number;   // default: 3
  sampleIntervalMs?: number;           // default: 450
  sessionTimeoutMs?: number;           // default: 60000 (1 minute of persistent lock -> auto logout)
  onSessionTimeout?: () => void;
}

/**
 * Attaches a contextmenu event listener to document to prevent the default
 * browser right-click context menu on CRM views while preserving normal
 * form input interactions (typing, editing, text fields).
 * Returns a cleanup function.
 */
export function attachContextMenuDeterrence(): () => void {
  if (typeof document === 'undefined') return () => {};

  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const isEditable = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    // Allow native context menu in input fields for spelling, cut, copy, paste
    if (isEditable) {
      return;
    }

    // Intercept context menu elsewhere across the CRM to deter "Inspect Element"
    e.preventDefault();
  };

  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  };
}

/**
 * Attaches a keydown listener to window to intercept and block DevTools shortcuts:
 * - F12
 * - Ctrl+Shift+I / Cmd+Option+I (Inspect)
 * - Ctrl+Shift+J / Cmd+Option+J (Console)
 * - Ctrl+Shift+C / Cmd+Option+C (Element Inspector)
 * - Ctrl+U / Cmd+U (View Page Source)
 *
 * Normal user shortcuts like Ctrl+C (copy), Ctrl+V (paste), Ctrl+X (cut),
 * Ctrl+A (select all), and Tab (navigation) are preserved.
 *
 * Returns a cleanup function.
 */
export function attachKeyboardDeterrence(onShortcutDetected?: (shortcut: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShiftOrAlt = e.shiftKey || e.altKey;
    const key = e.key ? e.key.toLowerCase() : '';
    const keyCode = e.keyCode || e.which;

    let matchedShortcut: string | null = null;

    // F12 key (Key code 123)
    if (key === 'f12' || keyCode === 123) {
      matchedShortcut = 'F12';
    }
    // Ctrl+Shift+I or Cmd+Option+I (Inspect element / DevTools)
    else if (isCtrlOrCmd && isShiftOrAlt && (key === 'i' || keyCode === 73)) {
      matchedShortcut = 'Inspect (Ctrl/Cmd+Shift/Opt+I)';
    }
    // Ctrl+Shift+J or Cmd+Option+J (DevTools Console)
    else if (isCtrlOrCmd && isShiftOrAlt && (key === 'j' || keyCode === 74)) {
      matchedShortcut = 'Console (Ctrl/Cmd+Shift/Opt+J)';
    }
    // Ctrl+Shift+C or Cmd+Option+C (Inspect Element cursor)
    else if (isCtrlOrCmd && isShiftOrAlt && (key === 'c' || keyCode === 67)) {
      matchedShortcut = 'Element Inspector (Ctrl/Cmd+Shift/Opt+C)';
    }
    // Ctrl+U or Cmd+U (View HTML source)
    else if (isCtrlOrCmd && (key === 'u' || keyCode === 85)) {
      matchedShortcut = 'View Source (Ctrl/Cmd+U)';
    }

    if (matchedShortcut) {
      e.preventDefault();
      e.stopPropagation();
      if (onShortcutDetected) {
        onShortcutDetected(matchedShortcut);
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown, { capture: true });
  return () => {
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}

/**
 * Detects whether the current device is a mobile or tablet environment.
 * On mobile/tablet touch devices, docked developer tools do not exist;
 * layout dimension shifts occur naturally from dynamic browser address bars,
 * onscreen keyboards, and orientation changes.
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return Boolean(isMobileUA || (isTouch && window.innerWidth <= 1024));
}

/**
 * Checks whether developer tools appear open based on window dimension disparity.
 * Note: Only applies when outer dimensions are populated and valid.
 * Includes iframe check to avoid false positives when embedded in responsive previews.
 * Includes mobile/tablet exemption and zoom normalization to prevent false positives.
 */
export function isDevToolsDimensionExceeded(threshold = DEVTOOLS_DIMENSION_THRESHOLD): boolean {
  if (typeof window === 'undefined') return false;

  // On mobile/tablet devices, dimension disparity must not trigger due to address bars or rotation
  if (isMobileOrTabletDevice()) {
    return false;
  }

  const outerW = window.outerWidth;
  const innerW = window.innerWidth;
  const outerH = window.outerHeight;
  const innerH = window.innerHeight;

  // Sanity check for valid window measurements
  if (!outerW || !outerH || !innerW || !innerH) {
    return false;
  }

  // Safe iframe check: inside an iframe, innerWidth reflects the container, not browser window
  let isEmbedded = false;
  try {
    isEmbedded = window.self !== window.top;
  } catch {
    isEmbedded = true;
  }

  if (isEmbedded) {
    return false;
  }

  // Check browser zoom level: if zoom/scale is active (>1.05 or <0.95), adjust threshold
  const zoomFactor = window.visualViewport?.scale || 1.0;
  if (zoomFactor > 1.15) {
    // Highly zoomed viewport; increase tolerance to avoid false positives on zoom
    threshold = Math.max(threshold, threshold * zoomFactor);
  }

  const widthDiff = outerW - innerW;
  const heightDiff = outerH - innerH;

  return widthDiff > threshold || heightDiff > threshold;
}

/**
 * Checks for execution timing anomalies indicative of active debugger pauses.
 * Safe, lightweight, and non-blocking: executes a single non-loop probe.
 * Does NOT cause high CPU usage or freeze legitimate users.
 */
export function detectDebuggerTimingAnomaly(): boolean {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return false;
  }
  try {
    const start = performance.now();
    // Non-disruptive single evaluation - no while loop, no infinite recursion
    // When DevTools is not attached or debugger is inactive, execution takes < 0.1ms
    // If DevTools breakpoint or active inspection pauses execution, delta will exceed 100ms
    /* eslint-disable no-new-func */
    const probe = new Function('debugger;');
    probe();
    const duration = performance.now() - start;
    return duration > 100;
  } catch {
    return false;
  }
}

/**
 * Evaluates composite defensive signals for developer tools presence.
 */
export function isDevToolsActive(threshold = DEVTOOLS_DIMENSION_THRESHOLD): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Dimension disparity check
  if (isDevToolsDimensionExceeded(threshold)) {
    return true;
  }

  // 2. Debugger timing anomaly check
  if (detectDebuggerTimingAnomaly()) {
    return true;
  }

  return false;
}

/**
 * React hook that manages application security locking under developer tools presence.
 *
 * Requirements enforced:
 * - Persistent detection: Requires consecutive positive detections before entering SECURITY_LOCKED
 *   to eliminate false-positive spikes from window resizing, responsive breakpoints, or device rotation.
 * - Stable recovery: Requires consecutive clear readings before unlocking.
 * - Non-dismissible: Does NOT provide any dismiss bypass while detection condition persists.
 * - Session timeout: Informs the caller when the lock persists beyond the allowed security duration.
 *
 * @param enabled Whether deterrence features are actively enabled.
 * @param options Timing and threshold configuration.
 */
export function useDevToolsDeterrence(
  enabled: boolean = true,
  options?: DevToolsDeterrenceOptions
) {
  const consecutiveSamples = options?.consecutiveSamplesRequired ?? 3;
  const consecutiveClear = options?.consecutiveClearRequired ?? 3;
  const sampleInterval = options?.sampleIntervalMs ?? 450;
  const sessionTimeoutMs = options?.sessionTimeoutMs ?? 60000;
  const onSessionTimeout = options?.onSessionTimeout;

  const [lockState, setLockState] = useState<SecurityLockState>('NORMAL');

  // Track sample streaks across evaluations
  const positiveStreakRef = React.useRef(0);
  const negativeStreakRef = React.useRef(0);
  const lockStartTimeRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLockState('NORMAL');
      positiveStreakRef.current = 0;
      negativeStreakRef.current = 0;
      lockStartTimeRef.current = null;
      return;
    }

    // 1. Right-click contextmenu deterrence
    const cleanupContextMenu = attachContextMenuDeterrence();

    // 2. Keyboard shortcut deterrence (records suspicious shortcut events)
    const cleanupKeyboard = attachKeyboardDeterrence(() => {
      positiveStreakRef.current += 1;
      if (positiveStreakRef.current >= consecutiveSamples) {
        setLockState('SECURITY_LOCKED');
      } else {
        setLockState('SUSPICIOUS');
      }
    });

    // 3. Periodic continuous detection with persistence filter
    const checkHeuristic = () => {
      const isPositive = isDevToolsActive(DEVTOOLS_DIMENSION_THRESHOLD);

      if (isPositive) {
        positiveStreakRef.current += 1;
        negativeStreakRef.current = 0;

        if (positiveStreakRef.current >= consecutiveSamples) {
          setLockState((prev) => {
            if (prev !== 'SECURITY_LOCKED') {
              lockStartTimeRef.current = Date.now();
            }
            return 'SECURITY_LOCKED';
          });
        } else {
          setLockState((prev) => (prev === 'SECURITY_LOCKED' ? 'SECURITY_LOCKED' : 'SUSPICIOUS'));
        }
      } else {
        negativeStreakRef.current += 1;
        positiveStreakRef.current = 0;

        if (negativeStreakRef.current >= consecutiveClear) {
          setLockState('NORMAL');
          lockStartTimeRef.current = null;
        }
      }

      // Check session lock timeout: if locked continuously > sessionTimeoutMs, trigger session termination
      if (
        lockStartTimeRef.current &&
        Date.now() - lockStartTimeRef.current >= sessionTimeoutMs
      ) {
        if (onSessionTimeout) {
          onSessionTimeout();
        }
      }
    };

    // Initial check
    checkHeuristic();

    const intervalId = window.setInterval(checkHeuristic, sampleInterval);
    window.addEventListener('resize', checkHeuristic);

    return () => {
      cleanupContextMenu();
      cleanupKeyboard();
      window.clearInterval(intervalId);
      window.removeEventListener('resize', checkHeuristic);
    };
  }, [enabled, consecutiveSamples, consecutiveClear, sampleInterval, sessionTimeoutMs, onSessionTimeout]);

  const isLocked = enabled && lockState === 'SECURITY_LOCKED';

  return {
    isSecurityLocked: isLocked,
    isDevToolsOpen: isLocked, // Backwards-compatible alias for existing callers
    lockState
  };
}
