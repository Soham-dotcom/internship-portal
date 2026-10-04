import React, { useEffect, useRef, useState } from 'react';
import {
  subscribe, closeDialog, dismissToast, isPromptAnswerValid,
} from '../ui/feedback';

const TOAST_STYLES = {
  success: 'alert-success',
  info: 'alert-info',
  warning: 'alert-warning',
  error: 'alert-error',
};

/**
 * Renders the open dialog (confirm / prompt) and the toast stack.
 * Accessible: role="dialog", focus moves into the dialog and is kept there,
 * Escape cancels, Enter confirms, and focus returns to where it was afterwards.
 */
const FeedbackHost = () => {
  const [{ dialog, toasts }, setState] = useState({ dialog: null, toasts: [] });
  const [answer, setAnswer] = useState('');
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => subscribe(setState), []);

  useEffect(() => {
    if (!dialog) return undefined;
    returnFocusRef.current = document.activeElement;
    setAnswer('');
    // Destructive dialogs start on Cancel, so a stray Enter never deletes anything.
    const target = inputRef.current || (dialog.danger ? cancelRef.current : confirmRef.current);
    const timer = setTimeout(() => target?.focus(), 0);
    return () => {
      clearTimeout(timer);
      returnFocusRef.current?.focus?.();
    };
  }, [dialog]);

  if (!dialog && toasts.length === 0) return null;

  const valid = dialog?.kind !== 'prompt' || isPromptAnswerValid(dialog, answer);
  const cancel = () => closeDialog(dialog.kind === 'prompt' ? null : false);
  const confirm = () => {
    if (!valid) return;
    closeDialog(dialog.kind === 'prompt' ? answer.trim() : true);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Tab' && panelRef.current) {
      // Keep keyboard focus inside the dialog.
      const focusable = panelRef.current.querySelectorAll('button:not([disabled]), input');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <>
      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            aria-describedby={dialog.message ? 'feedback-message' : undefined}
            className="w-full max-w-md rounded-lg bg-white shadow-xl"
            onKeyDown={onKeyDown}
          >
            <div className="px-5 pt-5">
              <h2 id="feedback-title" className="text-base font-semibold text-gray-900">{dialog.title}</h2>
              {dialog.message && (
                <p id="feedback-message" className="mt-2 text-sm text-gray-600 whitespace-pre-line">{dialog.message}</p>
              )}
              {dialog.kind === 'prompt' && (
                <div className="mt-3">
                  {dialog.label && <label htmlFor="feedback-input" className="form-label">{dialog.label}</label>}
                  <input
                    id="feedback-input"
                    ref={inputRef}
                    className="form-input"
                    value={answer}
                    placeholder={dialog.placeholder}
                    onChange={(e) => setAnswer(e.target.value)}
                    autoComplete="off"
                  />
                  {dialog.minLength > 0 && !valid && (
                    <p className="mt-1 text-xs text-gray-500">At least {dialog.minLength} characters.</p>
                  )}
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button type="button" ref={cancelRef} className="btn-secondary" onClick={cancel}>{dialog.cancelLabel}</button>
              <button
                type="button"
                ref={confirmRef}
                className={dialog.danger ? 'btn-danger' : 'btn-primary'}
                onClick={confirm}
                disabled={!valid}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`${TOAST_STYLES[t.type]} shadow-lg flex items-start justify-between gap-3`}>
            <span className="text-sm whitespace-pre-line">{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="text-sm font-semibold underline whitespace-nowrap"
                onClick={() => { dismissToast(t.id); t.action.onClick(); }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default FeedbackHost;
