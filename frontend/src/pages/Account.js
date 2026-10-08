import React, { useState } from 'react';
import { changePassword } from '../api/axios';
import { clearAuthSession, getAuthRole, getAuthUser, loginUrl } from '../auth/session';

const MIN_LENGTH = 12;

/** My Account: who you are, and changing your own password. */
const Account = () => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Quick checks for instant feedback; the server enforces the real rules.
  const clientProblem = (() => {
    if (form.next && form.next.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters (a short phrase works well).`;
    if (form.confirm && form.next !== form.confirm) return 'The two new passwords do not match.';
    return '';
  })();
  const canSubmit = form.current && form.next && form.confirm && !clientProblem && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await changePassword(form.current, form.next);
      // Every session (including this one) has been signed out on the server.
      clearAuthSession();
      window.location.href = loginUrl('password-changed');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password. Nothing was changed.');
      setSaving(false);
    }
  };

  const field = (id, label, key, autoComplete, hint) => (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        type="password"
        className="form-input"
        value={form[key]}
        onChange={update(key)}
        autoComplete={autoComplete}
        aria-describedby={hint ? `${id}-hint` : undefined}
        required
      />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">
            Signed in as <strong>{getAuthUser()}</strong> ({getAuthRole() === 'admin' ? 'Administrator' : 'Staff'}).
          </p>
        </div>
      </div>

      <form className="section-card max-w-lg" onSubmit={submit} noValidate>
        <div className="section-card-header">
          <h2 className="section-title">Change password</h2>
          <p className="text-sm text-gray-500">You will be signed out everywhere and asked to sign in with the new password.</p>
        </div>
        <div className="section-card-body space-y-4">
          {error && <div className="alert-error" role="alert">{error}</div>}
          {field('current-password', 'Current password', 'current', 'current-password')}
          {field('new-password', 'New password', 'next', 'new-password', `At least ${MIN_LENGTH} characters, and not containing your username.`)}
          {field('confirm-password', 'Confirm new password', 'confirm', 'new-password')}
          {clientProblem && <p className="text-sm text-amber-700" role="status">{clientProblem}</p>}
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {saving ? 'Changing...' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Account;
