/**
 * In-app confirmations, text prompts and toast messages.
 *
 * Replaces window.confirm / prompt / alert, which cannot explain consequences,
 * look different in every browser, and block the page. Plain functions rather than
 * a React hook, so code outside components (the axios interceptor) can use them too.
 * <FeedbackHost /> renders whatever is open; it is mounted once in index.js.
 *
 *   if (!(await confirmDialog({ message: 'Delete 47 records?', danger: true }))) return;
 *   const reason = await promptDialog({ title: 'Reason', minLength: 5 }); // null = cancelled
 *   toast.success('Saved');
 */

let listener = null;
let state = { dialog: null, toasts: [] };
const queue = [];
let nextToastId = 1;

const emit = () => {
  if (listener) listener(state);
};

/** Used by FeedbackHost. Returns an unsubscribe function. */
export const subscribe = (fn) => {
  listener = fn;
  fn(state);
  return () => {
    if (listener === fn) listener = null;
  };
};

const showNextDialog = () => {
  state = { ...state, dialog: queue.shift() || null };
  emit();
};

const openDialog = (dialog) => new Promise((resolve) => {
  queue.push({ ...dialog, resolve });
  if (!state.dialog) showNextDialog();
});

/** Called by FeedbackHost when the user answers. */
export const closeDialog = (value) => {
  const { dialog } = state;
  if (!dialog) return;
  dialog.resolve(value);
  showNextDialog();
};

/** Resolves true (confirmed) or false (cancelled). */
export const confirmDialog = ({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) => {
  // Never skip a confirmation just because the host isn't mounted.
  if (!listener) return Promise.resolve(window.confirm([title, message].filter(Boolean).join('\n\n')));
  return openDialog({ kind: 'confirm', title, message, confirmLabel, cancelLabel, danger });
};

/**
 * Resolves the trimmed text, or null if cancelled.
 *   minLength    confirm stays disabled until the answer is at least this long
 *   mustEqual    confirm stays disabled until the answer matches exactly (type-to-confirm)
 */
export const promptDialog = ({
  title = 'Please confirm',
  message = '',
  label = '',
  placeholder = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  minLength = 0,
  mustEqual = null,
} = {}) => {
  if (!listener) {
    const answer = window.prompt([title, message].filter(Boolean).join('\n\n'));
    return Promise.resolve(answer === null ? null : answer.trim());
  }
  return openDialog({
    kind: 'prompt', title, message, label, placeholder, confirmLabel, cancelLabel, danger, minLength, mustEqual,
  });
};

/** True when the answer satisfies the prompt's rules (shared with FeedbackHost). */
export const isPromptAnswerValid = (dialog, value) => {
  const text = String(value ?? '').trim();
  if (dialog.mustEqual !== null && dialog.mustEqual !== undefined) return text === String(dialog.mustEqual);
  return text.length >= (dialog.minLength || 0);
};

export const dismissToast = (id) => {
  state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
  emit();
};

/**
 * action (optional): { label, onClick } shows a button in the toast, e.g. "Undo".
 * Clicking it runs onClick and dismisses the toast.
 */
const pushToast = (type, text, durationMs, action = null) => {
  const id = nextToastId;
  nextToastId += 1;
  state = { ...state, toasts: [...state.toasts, { id, type, text, action }] };
  emit();
  if (durationMs > 0) setTimeout(() => dismissToast(id), durationMs);
  return id;
};

export const toast = {
  success: (text, durationMs = 4000, action) => pushToast('success', text, durationMs, action),
  info: (text, durationMs = 6000, action) => pushToast('info', text, durationMs, action),
  warning: (text, durationMs = 8000, action) => pushToast('warning', text, durationMs, action),
  error: (text, durationMs = 8000, action) => pushToast('error', text, durationMs, action),
};
