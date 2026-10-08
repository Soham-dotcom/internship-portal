import React, { useCallback, useEffect, useState } from 'react';
import {
  getAuthConfig, listUsers, createUser, updateUser, resetUserPassword,
} from '../api/axios';
import { getAuthUser } from '../auth/session';
import { confirmDialog, promptDialog, toast } from '../ui/feedback';
import { TableSkeleton } from '../components/States';

const EMPTY_FORM = { username: '', password: '', role: 'staff', allowedYears: [] };
const errorText = (err, fallback) => err.response?.data?.message || fallback;
const yearsLabel = (years) => (years && years.length ? years.join(', ') : 'All years');

/** Admin form for adding an account. */
const CreateUserForm = ({ years, onCreated }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const toggleYear = (year) => setForm({
    ...form,
    allowedYears: form.allowedYears.includes(year)
      ? form.allowedYears.filter((y) => y !== year)
      : [...form.allowedYears, year],
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await createUser(form);
      toast.success(response.data.message);
      setForm(EMPTY_FORM);
      onCreated();
    } catch (err) {
      toast.error(errorText(err, 'Could not create the account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="section-card mb-6" onSubmit={submit}>
      <div className="section-card-header">
        <h2 className="section-title">Add an account</h2>
        <p className="text-sm text-gray-500">Give each person their own login, so the audit log can tell who did what.</p>
      </div>
      <div className="section-card-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div>
          <label htmlFor="new-username" className="form-label">Username</label>
          <input id="new-username" className="form-input" value={form.username} autoComplete="off" required
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <label htmlFor="new-user-password" className="form-label">Initial password</label>
          <input id="new-user-password" type="password" className="form-input" value={form.password} autoComplete="new-password" required
            aria-describedby="new-user-password-hint"
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p id="new-user-password-hint" className="mt-1 text-xs text-gray-500">At least 12 characters. Ask them to change it after signing in.</p>
        </div>
        <div>
          <label htmlFor="new-user-role" className="form-label">Role</label>
          <select id="new-user-role" className="form-select" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <fieldset>
          <legend className="form-label">Academic years</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {years.map((year) => (
              <label key={year} className="flex items-center gap-1">
                <input type="checkbox" checked={form.allowedYears.includes(year)} onChange={() => toggleYear(year)} />
                {year}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">None ticked = all years.</p>
        </fieldset>
        <div>
          <button type="submit" className="btn-primary" disabled={saving || !form.username || !form.password}>
            {saving ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </div>
    </form>
  );
};

/** Admin-only: everyone who can sign in, and what they can do. */
const Users = () => {
  const me = getAuthUser();
  const [users, setUsers] = useState(null);
  const [years, setYears] = useState([]);
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await listUsers();
      setUsers(response.data.data);
    } catch (err) {
      setError(errorText(err, 'Could not load the accounts.'));
      // Retrying cannot fix a permission problem.
      setCanRetry(err.response?.status !== 403);
    }
  }, []);

  useEffect(() => {
    load();
    getAuthConfig().then((r) => setYears(r.data?.data?.years || [])).catch(() => setYears([]));
  }, [load]);

  const run = async (user, action) => {
    setBusyId(user._id);
    try {
      const response = await action();
      toast.success(response.data.message);
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Nothing was changed.'));
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (user, role) => {
    const ok = await confirmDialog({
      title: `Make ${user.username} ${role === 'admin' ? 'an administrator' : 'staff'}?`,
      message: role === 'admin'
        ? 'Administrators can bulk-delete, change evaluation weights, lock years and manage accounts.'
        : 'They will lose administrator powers immediately.',
      confirmLabel: 'Change role',
    });
    if (ok) run(user, () => updateUser(user._id, { role }));
  };

  const toggleStatus = async (user) => {
    const disabling = user.status === 'active';
    const ok = await confirmDialog({
      title: `${disabling ? 'Disable' : 'Re-enable'} ${user.username}?`,
      message: disabling ? 'They are signed out immediately and cannot sign in until re-enabled.' : 'They will be able to sign in again.',
      confirmLabel: disabling ? 'Disable account' : 'Re-enable',
      danger: disabling,
    });
    if (ok) run(user, () => updateUser(user._id, { status: disabling ? 'disabled' : 'active' }));
  };

  const resetPassword = async (user) => {
    const password = await promptDialog({
      title: `Reset ${user.username}'s password?`,
      message: 'They will be signed out everywhere. Tell them the new password privately and ask them to change it.',
      label: 'New password (at least 12 characters)',
      minLength: 12,
      confirmLabel: 'Reset password',
    });
    if (password) run(user, () => resetUserPassword(user._id, password));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Who can sign in to the portal, their role, and which academic years they can open.</p>
        </div>
      </div>

      <CreateUserForm years={years} onCreated={load} />

      {error && (
        <div className="alert-error flex items-center justify-between gap-3 mb-4" role="alert">
          <span>{error}</span>
          {canRetry && <button type="button" className="btn-secondary" onClick={load}>Try again</button>}
        </div>
      )}

      <div className="section-card">
        <div className="section-card-body overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Username</th><th>Role</th><th>Status</th><th>Years</th><th>Last sign-in</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {!users && !error && <TableSkeleton rows={3} columns={6} />}
              {users && users.map((user) => {
                const isMe = user.username === me;
                return (
                  <tr key={user._id}>
                    <td>{user.username}{isMe && <span className="text-xs text-gray-500"> (you)</span>}</td>
                    <td>
                      <label className="sr-only" htmlFor={`role-${user._id}`}>Role for {user.username}</label>
                      <select id={`role-${user._id}`} className="form-select" value={user.role}
                        disabled={isMe || busyId === user._id}
                        onChange={(e) => changeRole(user, e.target.value)}>
                        <option value="staff">Staff</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td>
                      <span className={user.status === 'active' ? 'badge-green' : 'badge-red'}>
                        {user.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                      {user.locked && <span className="badge-red ml-1">Locked out</span>}
                    </td>
                    <td>{yearsLabel(user.allowedYears)}</td>
                    <td className="whitespace-nowrap">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                    <td className="whitespace-nowrap">
                      <button type="button" className="btn-secondary" disabled={busyId === user._id} onClick={() => resetPassword(user)}>
                        Reset password
                      </button>{' '}
                      {!isMe && (
                        <button type="button" className={user.status === 'active' ? 'btn-danger' : 'btn-secondary'}
                          disabled={busyId === user._id} onClick={() => toggleStatus(user)}>
                          {user.status === 'active' ? 'Disable' : 'Re-enable'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
