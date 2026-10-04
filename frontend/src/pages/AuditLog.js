import React, { useCallback, useEffect, useState } from 'react';
import { getAuditLogs, getAuditActions } from '../api/axios';
import ChangeList from '../components/ChangeList';

const EMPTY_FILTERS = { action: '', actor: '', uid: '', from: '', to: '' };

// One-line summary of an entry's details, without dumping raw JSON.
const summarize = (details = {}) => {
  const parts = [];
  if (details.uid) parts.push(`UID ${details.uid}`);
  if (details.username) parts.push(details.username);
  if (details.outcome) parts.push(details.outcome);
  if (details.field) parts.push(details.field);
  if (details.email) parts.push(details.email);
  if (details.name) parts.push(details.name);
  if (details.reason) parts.push(`reason: ${details.reason}`);
  ['changed', 'inserted', 'updated', 'removed', 'reverted', 'recordCount', 'rows', 'groupCount', 'uidCount']
    .forEach((key) => { if (details[key] !== undefined) parts.push(`${key}: ${details[key]}`); });
  return parts.join(' · ');
};

/**
 * Admin-only search over the audit trail: who did what, when, and with which values.
 */
const AuditLog = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, pages: 1 });
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
      const response = await getAuditLogs({ ...params, page, limit: 50 });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAuditActions().then((r) => setActions(r.data.data || [])).catch(() => setActions([]));
  }, []);

  const search = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const field = (key, label, props = {}) => (
    <div>
      <label htmlFor={`audit-${key}`} className="form-label">{label}</label>
      <input
        id={`audit-${key}`}
        className="form-input"
        value={filters[key]}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Every change to this year&apos;s data: who, when, and the old and new values.</p>
        </div>
      </div>

      <form className="section-card mb-6" onSubmit={search}>
        <div className="section-card-body grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <div>
            <label htmlFor="audit-action" className="form-label">Action</label>
            <select
              id="audit-action"
              className="form-select"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {field('actor', 'User', { placeholder: 'username' })}
          {field('uid', 'Student UID', { placeholder: 'e.g. 2022300002' })}
          {field('from', 'From', { type: 'date' })}
          {field('to', 'To', { type: 'date' })}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Search</button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }}
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert-error mb-4">{error}</div>}

      <div className="section-card">
        <div className="section-card-body">
          <p className="text-sm text-gray-500 mb-3">
            {loading ? 'Loading...' : `${result.total} entr${result.total === 1 ? 'y' : 'ies'}`}
          </p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>User</th><th>Action</th><th>Result</th><th>Details</th></tr>
              </thead>
              <tbody>
                {result.data.map((entry) => (
                  <tr key={entry._id}>
                    <td className="whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="whitespace-nowrap">
                      {entry.actorUsername}
                      <span className="text-xs text-gray-400"> ({entry.actorRole})</span>
                    </td>
                    <td className="whitespace-nowrap">{entry.action}</td>
                    <td>
                      <span className={entry.success ? 'badge-green' : 'badge-red'}>
                        {entry.success ? 'OK' : `Failed ${entry.statusCode}`}
                      </span>
                    </td>
                    <td className="min-w-[16rem]">
                      <div className="text-xs text-gray-700">{summarize(entry.details)}</div>
                      {entry.details?.lockOverride && (
                        <div className="text-xs text-amber-700">Locked data changed. Reason: {entry.details.lockOverride.reason}</div>
                      )}
                      <ChangeList changes={entry.details?.changes} showUid limit={5} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {result.pages}</span>
              <button type="button" className="btn-secondary" disabled={page >= result.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
