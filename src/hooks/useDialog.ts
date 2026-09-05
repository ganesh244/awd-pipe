import { useEffect, useRef } from 'react';

/**
 * Accessibility behaviour for the app's hand-rolled modals.
 *
 * The modals are plain `fixed inset-0` overlays, which look right but behave
 * badly for anyone not using a mouse: focus stays on the page underneath, Tab
 * walks out of the dialog into content the user cannot see, Escape does
 * nothing, and screen readers get no signal that a dialog opened at all.
 *
 * This hook adds the missing behaviour without touching markup or styling, so
 * adopting it cannot change how a screen looks:
 *
 *   - Escape closes the dialog (topmost only)
 *   - Tab / Shift+Tab cycle within the dialog instead of escaping it
 *   - focus moves into the dialog on open and returns to the trigger on close
 *   - the page behind is scroll-locked
 *   - `role="dialog"` + `aria-modal` + an accessible name are exposed
 *
 * Nesting is handled with a shared stack and a scroll-lock refcount: only the
 * topmost dialog reacts to Escape and Tab, and closing an inner dialog does not
 * unlock scrolling while an outer one is still open.
 */

/** Open dialogs, oldest first. The last entry is the topmost. */
const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = '';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const focusableWithin = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    // offsetParent is null for display:none subtrees; the rect check also
    // catches visibility:hidden and zero-size elements.
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });

export interface UseDialogOptions {
  /**
   * Whether the dialog is currently rendered. Most of these modals are
   * conditionally rendered (`{isOpen && <div .../>}`), so the hook has to be
   * called unconditionally to satisfy the rules of hooks while staying inert —
   * no scroll lock, no stack entry — until the dialog is actually on screen.
   */
  open?: boolean;
  /** Called for Escape and used as the close affordance. Omit to disable Escape. */
  onClose?: () => void;
  /** Accessible name, when the dialog has no visible heading to point at. */
  label?: string;
  /** id of the visible heading that names this dialog. Preferred over `label`. */
  labelledBy?: string;
  /** Set false for a dialog that must not be dismissed by Escape (e.g. mid-upload). */
  closeOnEscape?: boolean;
}

export function useDialog<T extends HTMLElement = HTMLDivElement>(options: UseDialogOptions = {}) {
  const { open = true, onClose, label, labelledBy, closeOnEscape = true } = options;
  const ref = useRef<T | null>(null);
  // Keep the latest onClose without re-running the effect (and so without
  // re-entering the dialog stack) every time the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const id = Symbol('dialog');
    stack.push(id);
    const isTopmost = () => stack[stack.length - 1] === id;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (scrollLocks === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks++;

    // Move focus inside: the first focusable control, else the dialog itself.
    const node = ref.current;
    if (node) {
      const first = focusableWithin(node)[0];
      (first ?? node).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost() || !ref.current) return;

      if (e.key === 'Escape' && closeOnEscape && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = focusableWithin(ref.current);
      if (items.length === 0) {
        // Nothing to focus inside — keep focus on the dialog rather than
        // letting it escape to the page behind.
        e.preventDefault();
        ref.current.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!ref.current.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);

      const i = stack.indexOf(id);
      if (i !== -1) stack.splice(i, 1);

      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = savedOverflow;

      // Return focus to whatever opened the dialog, if it is still around.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, closeOnEscape]);

  return {
    ref,
    dialogProps: {
      ref,
      role: 'dialog' as const,
      'aria-modal': true as const,
      ...(labelledBy ? { 'aria-labelledby': labelledBy } : label ? { 'aria-label': label } : {}),
      tabIndex: -1,
    },
  };
}

/** Exposed for tests: current dialog nesting depth and scroll-lock count. */
export const __dialogState = () => ({ depth: stack.length, scrollLocks });
