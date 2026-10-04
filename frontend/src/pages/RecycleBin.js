import React, { useCallback, useEffect, useState } from 'react';
import { getRecycleBin, restoreStudent, deleteStudentPermanently } from '../api/axios';

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : '-');

/**
 * Admin-only list of deleted students.
 *
 * Deleting a student only hides them. From here an administrator can restore them
 * exactly as they were (marks and group included), or erase them for good.
 */
const RecycleBin = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRecycleBin();
      setStudents(response.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not load the Recycle Bin.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (student) => {
    setBusyId(student._id);
    try {
      const response = await restoreStudent(student._id);
      setMessage({ type: 'success', text: response.data.message });
      setStudents((prev) => prev.filter((s) => s._id !== student._id));
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Restore failed. Nothing was changed.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteForever = async (student) => {
    const typed = window.prompt(
      `This permanently erases ${student.name || student.uid} (UID ${student.uid}), including their marks. It cannot be undone.\n\nType the UID to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== student.uid) {
      setMessage({ type: 'error', text: 'The UID did not match. Nothing was deleted.' });
      return;
    }

    setBusyId(student._id);
    try {
      const response = await deleteStudentPermanently(student._id);
      setMessage({ type: 'success', text: response.data.message });
      setStudents((prev) => prev.filter((s) => s._id !== student._id));
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Delete failed. Nothing was changed.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recycle Bin</h1>
          <p className="page-subtitle">
            Deleted students are kept here with their marks and group. Restore puts them back exactly as they were.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : 'error'}`} role="status">
          {message.text}
        </div>
      )}

      <div className="section-card">
        <div className="section-card-body">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="loading-spinner" style={{ width: '18px', height: '18px' }} />
              Loading deleted students...
            </div>
          )}

          {!loading && students.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">The Recycle Bin is empty.</p>
          )}

          {!loading && students.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>UID</th>
                    <th>Name</th>
                    <th>Branch</th>
                    <th>Group</th>
                    <th>Deleted</th>
                    <th>By</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student._id}>
                      <td>{student.uid}</td>
                      <td>{student.name || '-'}</td>
                      <td>{student.branch || '-'}</td>
                      <td>{student.assignedGroupName || '-'}</td>
                      <td>{formatWhen(student.deletedAt)}</td>
                      <td>{student.deletedBy || '-'}</td>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleRestore(student)}
                          disabled={busyId === student._id}
                        >
                          Restore
                        </button>{' '}
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => handleDeleteForever(student)}
                          disabled={busyId === student._id}
                        >
                          Delete forever
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecycleBin;
