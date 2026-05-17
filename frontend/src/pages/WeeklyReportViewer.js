import React, { useEffect, useState, useCallback } from 'react';
import { getWeeklyReports } from '../api/axios';

const WeeklyReportViewer = () => {
  const [weeks, setWeeks] = useState(8);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async (weekCount = weeks) => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await getWeeklyReports(weekCount);
      if (response.data.success) {
        setRows(response.data.data || []);
        setMessage({ type: 'success', text: `Loaded ${response.data.data.length} students.` });
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Failed to load data' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.message });
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => { fetchData(weeks); }, [fetchData, weeks]);

  const weekColumns = Array.from({ length: weeks }, (_, i) => `week${i + 1}`);

  const filteredRows = rows.filter((row) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (row.name || '').toLowerCase().includes(q) || (row.uid || '').toLowerCase().includes(q);
  });

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <h1 className="page-title">Weekly Report Viewer</h1>
        <p className="page-subtitle">View weekly report summaries by UID and week.</p>
      </div>

      <div className="section-card">
        <div className="section-card-body space-y-4">
          {message.text && (
            <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : 'error'}`}>
              <div className="whitespace-pre-wrap">{message.text}</div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Search</label>
            <input
              type="text"
              placeholder="Name or UID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-56"
            />
            <label className="text-sm text-gray-600">Number of weeks</label>
            <input
              type="number"
              min={1}
              max={52}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value) || 1)}
              className="input w-24"
            />
            <button className="btn-primary" onClick={() => fetchData(weeks)} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-body overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">UID</th>
                {weekColumns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold text-gray-600">
                    {col.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.name || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.uid}</td>
                  {weekColumns.map((col) => (
                    <td key={col} className="px-3 py-2 text-gray-700">
                      {row.weekly_report_data?.[col] || ''}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={weekColumns.length + 2} className="px-3 py-6 text-center text-gray-500">
                    No weekly report data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WeeklyReportViewer;
