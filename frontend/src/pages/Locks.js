import React, { useCallback, useEffect, useState } from 'react';
import { getYearSettings, lockYear, unlockYear, setMarksLock } from '../api/axios';
import { getAuthYear } from '../auth/session';

const MARK_COMPONENTS = [
  { field: 'meeting_attended', label: 'Meeting attendance' },
  { field: 'weekly_reports_completed', label: 'Weekly reports' },
  { field: 'final_report_submitted', label: 'Final report' },
  { field: 'external_marks', label: 'Industry evaluator marks' },
  { field: 'external_viva_marks', label: 'External viva' },
  { field: 'internal_viva_marks', label: 'Internal viva' },
];

const when = (value) => (value ? new Date(value).toLocaleString() : '');

/**
 * Admin-only: finalise an academic year or individual marks components.
 *
 * Once locked, staff can no longer change that data. An administrator still can,
 * but is asked for a reason each time, and the reason is kept in the audit log.
 */
const Locks = () => {
  const year = getAuthYear();
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const response = await getYearSettings();
      setSettings(response.data.data);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not load the lock settings.' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action) => {
    setBusy(true);
    try {
      const response = await action();
      setSettings(response.data.data);
      setMessage({ type: 'success', text: response.data.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Nothing was changed.' });
    } finally {
      setBusy(false);
    }
  };

  const askReason = (question) => {
    const reason = window.prompt(question);
    if (reason === null) return null;
    if (reason.trim().length < 5) {
      setMessage({ type: 'error', text: 'A reason of at least 5 characters is required. Nothing was changed.' });
      return null;
    }
    return reason.trim();
  };

  const handleLockYear = () => {
    const reason = window.prompt(
      `Lock academic year ${year}? Staff will no longer be able to change anything in this year. `
      + 'Administrators can still make corrections, but must give a reason each time.\n\nReason (optional):'
    );
    if (reason === null) return;
    run(() => lockYear(reason.trim()));
  };

  const handleUnlockYear = () => {
    const reason = askReason(`Unlock academic year ${year}? Everyone will be able to change its data again.\n\nReason (required):`);
    if (reason) run(() => unlockYear(reason));
  };

  const handleToggleMarks = (component, isLocked) => {
    if (isLocked) {
      const reason = askReason(`Unlock "${component.label}"? Staff will be able to change these marks again.\n\nReason (required):`);
      if (reason) run(() => setMarksLock(component.field, false, reason));
    } else if (window.confirm(`Lock "${component.label}"? Staff will no longer be able to change these marks.`)) {
      run(() => setMarksLock(component.field, true));
    }
  };

  const lockFor = (field) => settings?.marksLocks?.find((l) => l.field === field);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Locks &amp; Finalisation</h1>
          <p className="page-subtitle">
            Protect finished work for academic year {year}. Locked data can only be changed by an administrator, with a recorded reason.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : 'error'}`} role="status">{message.text}</div>
      )}

      {!settings ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="loading-spinner" style={{ width: '18px', height: '18px' }} /> Loading...
        </div>
      ) : (
        <>
          <div className="section-card mb-6">
            <div className="section-card-header">
              <h2 className="section-title">Academic year {year}</h2>
            </div>
            <div className="section-card-body flex flex-wrap items-center justify-between gap-4">
              {settings.locked ? (
                <p className="text-sm text-gray-700">
                  <span className="badge-red">Locked</span>{' '}
                  since {when(settings.lockedAt)} by {settings.lockedBy}
                  {settings.lockReason ? ` (${settings.lockReason})` : ''}. The whole year is read-only for staff.
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  <span className="badge-green">Open</span>{' '}
                  Lock the year once results are published, so nothing changes by accident.
                </p>
              )}
              <button
                type="button"
                className={settings.locked ? 'btn-secondary' : 'btn-danger'}
                onClick={settings.locked ? handleUnlockYear : handleLockYear}
                disabled={busy}
              >
                {settings.locked ? 'Unlock year' : 'Lock year'}
              </button>
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-title">Marks</h2>
              <p className="text-sm text-gray-500">Lock each component once its marks are verified. Other components stay editable.</p>
            </div>
            <div className="section-card-body">
              <table className="data-table">
                <thead>
                  <tr><th>Component</th><th>Status</th><th aria-label="Action" /></tr>
                </thead>
                <tbody>
                  {MARK_COMPONENTS.map((component) => {
                    const lock = lockFor(component.field);
                    return (
                      <tr key={component.field}>
                        <td>{component.label}</td>
                        <td>
                          {lock
                            ? <span><span className="badge-red">Locked</span> {when(lock.lockedAt)} by {lock.lockedBy}</span>
                            : <span className="badge-green">Open</span>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleToggleMarks(component, Boolean(lock))}
                            disabled={busy}
                          >
                            {lock ? 'Unlock' : 'Lock'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Locks;
