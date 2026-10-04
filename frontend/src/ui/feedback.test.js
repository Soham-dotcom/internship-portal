import {
  subscribe, confirmDialog, promptDialog, closeDialog, isPromptAnswerValid, toast, dismissToast,
} from './feedback';

describe('feedback store', () => {
  let latest;
  let unsubscribe;
  beforeEach(() => {
    unsubscribe = subscribe((s) => { latest = s; });
  });
  afterEach(() => unsubscribe());

  it('confirmDialog resolves true or false from the user\'s answer', async () => {
    const yes = confirmDialog({ message: 'Delete?' });
    expect(latest.dialog.kind).toBe('confirm');
    closeDialog(true);
    await expect(yes).resolves.toBe(true);

    const no = confirmDialog({ message: 'Delete?' });
    closeDialog(false);
    await expect(no).resolves.toBe(false);
  });

  it('queues dialogs and shows them one at a time, in order', async () => {
    const first = promptDialog({ title: 'First' });
    const second = confirmDialog({ title: 'Second' });
    expect(latest.dialog.title).toBe('First');
    closeDialog('answer');
    expect(latest.dialog.title).toBe('Second');
    closeDialog(true);
    await expect(first).resolves.toBe('answer');
    await expect(second).resolves.toBe(true);
    expect(latest.dialog).toBeNull();
  });

  it('adds and removes toasts', () => {
    const id = toast.success('Saved', 0);
    expect(latest.toasts.map((t) => t.text)).toContain('Saved');
    dismissToast(id);
    expect(latest.toasts.find((t) => t.id === id)).toBeUndefined();
  });
});

describe('without the host mounted', () => {
  it('falls back to the browser dialog instead of silently skipping', async () => {
    const spy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    await expect(confirmDialog({ title: 'Delete?' })).resolves.toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('isPromptAnswerValid', () => {
  it('enforces a minimum length', () => {
    expect(isPromptAnswerValid({ minLength: 5 }, 'abc')).toBe(false);
    expect(isPromptAnswerValid({ minLength: 5 }, '  typo fix ')).toBe(true);
  });

  it('enforces an exact match for type-to-confirm', () => {
    expect(isPromptAnswerValid({ mustEqual: '2022300002' }, '2022300003')).toBe(false);
    expect(isPromptAnswerValid({ mustEqual: '2022300002' }, ' 2022300002 ')).toBe(true);
  });
});
