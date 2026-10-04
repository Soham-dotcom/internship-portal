import React, { useEffect, useState } from 'react';
import { getStudentHistory } from '../api/axios';
import ChangeList from './ChangeList';

/**
 * Modal showing one student's change history: who changed what, when,
 * and from what to what.
 */
const StudentHistory = ({ studentId, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getStudentHistory(studentId)
      .then((response) => { if (active) setData(response.data.data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load the history.'); });
    return () => { active = false; };
  }, [studentId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 id="history-title" className="text-base font-semibold text-gray-900">
            History{data ? `: ${data.name || ''} (${data.uid})` : ''}
          </h2>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {error && <div className="alert-error">{error}</div>}
          {!data && !error && <p className="text-sm text-gray-500">Loading...</p>}
          {data && data.history.length === 0 && (
            <p className="text-sm text-gray-500">No recorded changes yet. The trail starts from the day auditing was switched on.</p>
          )}
          {data && data.history.length > 0 && (
            <ol className="space-y-3">
              {data.history.map((item, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={i} className="border-l-2 border-gray-200 pl-3">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">{item.action}</span>
                    <span className="text-gray-500"> · {item.by} · {new Date(item.at).toLocaleString()}</span>
                  </div>
                  {item.reason && <div className="text-xs text-amber-700">Reason: {item.reason}</div>}
                  <ChangeList changes={item.changes} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHistory;
