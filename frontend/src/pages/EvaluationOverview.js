import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getEvaluationOverview, getEvaluationSettings, updateEvaluationSettings, updateInternship } from '../api/axios';

const EvaluationOverview = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [totalWeeks, setTotalWeeks] = useState(8);
  const [weights, setWeights] = useState({
    meeting: 10,
    weekly: 30,
    final: 10,
    external: 25,
    external_viva: 12.5,
    internal_viva: 12.5,
  });
  const [filters, setFilters] = useState({
    uid: '',
    name: '',
    internalMentor: '',
    externalMentor: ''
  });
  const [editRowId, setEditRowId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingId, setSavingId] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await getEvaluationOverview();
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
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getEvaluationSettings();
        if (response.data.success && response.data.data) {
          if (response.data.data.totalWeeks) setTotalWeeks(response.data.data.totalWeeks);
          if (response.data.data.weights) {
            const incoming = response.data.data.weights;
            const legacyViva = incoming.viva;
            setWeights((prev) => ({
              ...prev,
              ...incoming,
              external_viva: incoming.external_viva ?? (legacyViva ? legacyViva / 2 : prev.external_viva),
              internal_viva: incoming.internal_viva ?? (legacyViva ? legacyViva / 2 : prev.internal_viva),
            }));
          }
        }
      } catch (error) {
        console.warn('Failed to load evaluation settings', error);
      }
    };

    loadSettings();
    fetchRows();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateEvaluationSettings({ totalWeeks, weights }).catch((error) => {
        console.warn('Failed to save evaluation settings', error);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [totalWeeks, weights]);

  const displayMetric = (value) => {
    if (value === null || value === undefined || value === 0) return '-';
    return value;
  };

  const displayWeeklyCount = (count, data) => {
    const hasData = data && Object.values(data).some((val) => String(val || '').trim());
    if (!hasData) return '-';
    return count ?? 0;
  };

  const calcBinaryScore = (value) => {
    if (value === null || value === undefined) return '-';
    return Number(value) === 1 ? 100 : 0;
  };

  const calcWeeklyScore = (count) => {
    const safeWeeks = Number(totalWeeks) || 0;
    if (!safeWeeks) return '-';
    const safeCount = Number(count) || 0;
    const score = (safeCount / safeWeeks) * 100;
    return Number.isNaN(score) ? '-' : score.toFixed(0);
  };

  const calcVivaFromRaw = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    const score = (num / 40) * 100;
    return Number.isNaN(score) ? '-' : score.toFixed(0);
  };


  const calcWeightedFinal = (row) => {
    const meeting = calcBinaryScore(row.meeting_attended);
    const weekly = calcWeeklyScore(row.weekly_reports_completed);
    const final = calcBinaryScore(row.final_report_submitted);
    const external = displayMetric(row.external_marks);
    const externalViva = calcVivaFromRaw(row.external_viva_marks);
    const internalViva = calcVivaFromRaw(row.internal_viva_marks);

    const numeric = [meeting, weekly, final, external, externalViva, internalViva].every(v => v !== '-');
    if (!numeric) return '-';

    const total = (Number(meeting) * weights.meeting
      + Number(weekly) * weights.weekly
      + Number(final) * weights.final
      + Number(external) * weights.external
      + Number(externalViva) * weights.external_viva
      + Number(internalViva) * weights.internal_viva) / 100;

    return Number.isNaN(total) ? '-' : total.toFixed(1);
  };

  const weightSum = Object.values(weights).reduce((acc, val) => acc + Number(val || 0), 0);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const uidMatch = !filters.uid.trim() || (row.uid || '').toLowerCase().includes(filters.uid.toLowerCase());
    const nameMatch = !filters.name.trim() || (row.name || '').toLowerCase().includes(filters.name.toLowerCase());
    const internalMatch = !filters.internalMentor.trim()
      || (row.internalMentorName || '').toLowerCase().includes(filters.internalMentor.toLowerCase());
    const externalMatch = !filters.externalMentor.trim()
      || (row.externalMentorName || '').toLowerCase().includes(filters.externalMentor.toLowerCase());
    return uidMatch && nameMatch && internalMatch && externalMatch;
  }), [rows, filters]);

  const startEdit = (row) => {
    setEditRowId(row._id);
    setEditData({
      name: row.name || '',
      uid: row.uid || '',
      externalMentorName: row.externalMentorName || '',
      meeting_attended: row.meeting_attended ?? '',
      weekly_reports_completed: row.weekly_reports_completed ?? '',
      final_report_submitted: row.final_report_submitted ?? '',
      external_marks: row.external_marks ?? '',
      external_viva_marks: row.external_viva_marks ?? '',
      internal_viva_marks: row.internal_viva_marks ?? ''
    });
  };

  const cancelEdit = () => {
    setEditRowId(null);
    setEditData({});
  };

  const saveEdit = async (row) => {
    setSavingId(row._id);
    try {
      const payload = {
        name: editData.name,
        uid: editData.uid,
        externalMentorName: editData.externalMentorName,
        meeting_attended: editData.meeting_attended,
        weekly_reports_completed: editData.weekly_reports_completed,
        final_report_submitted: editData.final_report_submitted,
        external_marks: editData.external_marks,
        external_viva_marks: editData.external_viva_marks,
        internal_viva_marks: editData.internal_viva_marks
      };
      const response = await updateInternship(row._id, payload);
      if (response.data.success) {
        setRows((prev) => prev.map((item) => (item._id === row._id ? { ...item, ...payload } : item)));
        cancelEdit();
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Failed to update student' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = () => {
    const data = filteredRows.map((row) => ({
      UID: row.uid || '',
      Name: row.name || '',
      'Final Score': calcWeightedFinal(row) === '-' ? '' : calcWeightedFinal(row)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluation');
    XLSX.writeFile(wb, 'evaluation_data.xlsx');
  };

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <h1 className="page-title">Marks & Evaluation Dashboard</h1>
        <p className="page-subtitle">Evaluation metrics and viva components by student (UID-based).</p>
      </div>

      <div className="section-card">
        <div className="section-card-body space-y-4">
          {message.text && (
            <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : 'error'}`}>
              <div className="whitespace-pre-wrap">{message.text}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">UID</label>
              <input
                type="text"
                placeholder="Filter UID"
                value={filters.uid}
                onChange={(e) => setFilters({ ...filters, uid: e.target.value })}
                className="input w-40"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Name</label>
              <input
                type="text"
                placeholder="Filter name"
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                className="input w-48"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Internal Examiner</label>
              <input
                type="text"
                placeholder="Filter internal"
                value={filters.internalMentor}
                onChange={(e) => setFilters({ ...filters, internalMentor: e.target.value })}
                className="input w-52"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">External Evaluator</label>
              <input
                type="text"
                placeholder="Filter external"
                value={filters.externalMentor}
                onChange={(e) => setFilters({ ...filters, externalMentor: e.target.value })}
                className="input w-52"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Total weeks</label>
              <input
                type="number"
                min={1}
                max={52}
                value={totalWeeks}
                onChange={(e) => setTotalWeeks(Number(e.target.value) || 1)}
                className="input w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Meeting %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.meeting}
                onChange={(e) => setWeights({ ...weights, meeting: Number(e.target.value) || 0 })}
                className="input w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Weekly %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.weekly}
                onChange={(e) => setWeights({ ...weights, weekly: Number(e.target.value) || 0 })}
                className="input w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Final %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.final}
                onChange={(e) => setWeights({ ...weights, final: Number(e.target.value) || 0 })}
                className="input w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Industry Evaluator %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.external}
                onChange={(e) => setWeights({ ...weights, external: Number(e.target.value) || 0 })}
                className="input w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">External Viva %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.external_viva}
                onChange={(e) => setWeights({ ...weights, external_viva: Number(e.target.value) || 0 })}
                className="input w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Internal Viva %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights.internal_viva}
                onChange={(e) => setWeights({ ...weights, internal_viva: Number(e.target.value) || 0 })}
                className="input w-20"
              />
            </div>
            <div className={`text-sm ${weightSum === 100 ? 'text-green-600' : 'text-amber-600'}`}>
              Weight sum: {weightSum}%
            </div>
            <button className="btn-secondary" onClick={handleExport} disabled={filteredRows.length === 0}>
              Export to Excel
            </button>
            <button className="btn-primary" onClick={fetchRows} disabled={loading}>
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
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Internal Examiner</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">External Evaluator</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Meeting Attended (Raw / Score)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Weekly Reports (Raw / Score)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Final Report (Raw / Score)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Industry Evaluator Marks (Raw / Score)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">External Evaluator Viva (Raw / Score)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Internal Examiner Viva (Raw / Score)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Final Weighted Score</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Weekly Summary</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="input w-48"
                      />
                    ) : (
                      row.name || '-'
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="text"
                        value={editData.uid}
                        onChange={(e) => setEditData({ ...editData, uid: e.target.value })}
                        className="input w-36"
                      />
                    ) : (
                      row.uid
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.internalMentorName || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="text"
                        value={editData.externalMentorName}
                        onChange={(e) => setEditData({ ...editData, externalMentorName: e.target.value })}
                        className="input w-48"
                      />
                    ) : (
                      row.externalMentorName || '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="number"
                        min="0"
                        value={editData.meeting_attended}
                        onChange={(e) => setEditData({ ...editData, meeting_attended: e.target.value })}
                        className="input w-24"
                      />
                    ) : (
                      `${displayMetric(row.meeting_attended)} / ${calcBinaryScore(row.meeting_attended)}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="number"
                        min="0"
                        value={editData.weekly_reports_completed}
                        onChange={(e) => setEditData({ ...editData, weekly_reports_completed: e.target.value })}
                        className="input w-24"
                      />
                    ) : (
                      `${displayWeeklyCount(row.weekly_reports_completed, row.weekly_report_data)} / ${calcWeeklyScore(row.weekly_reports_completed)}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="number"
                        min="0"
                        value={editData.final_report_submitted}
                        onChange={(e) => setEditData({ ...editData, final_report_submitted: e.target.value })}
                        className="input w-24"
                      />
                    ) : (
                      `${displayMetric(row.final_report_submitted)} / ${calcBinaryScore(row.final_report_submitted)}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="number"
                        min="0"
                        value={editData.external_marks}
                        onChange={(e) => setEditData({ ...editData, external_marks: e.target.value })}
                        className="input w-24"
                      />
                    ) : (
                      `${displayMetric(row.external_marks)} / ${displayMetric(row.external_marks)}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={editData.external_viva_marks}
                        onChange={(e) => setEditData({ ...editData, external_viva_marks: e.target.value })}
                        className="input w-24"
                      />
                    ) : (
                      `${displayMetric(row.external_viva_marks)} / ${calcVivaFromRaw(row.external_viva_marks)}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {editRowId === row._id ? (
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={editData.internal_viva_marks}
                        onChange={(e) => setEditData({ ...editData, internal_viva_marks: e.target.value })}
                        className="input w-24"
                      />
                    ) : (
                      `${displayMetric(row.internal_viva_marks)} / ${calcVivaFromRaw(row.internal_viva_marks)}`
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{calcWeightedFinal(row)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {row.weekly_report_data && Object.keys(row.weekly_report_data).length > 0
                      ? Object.entries(row.weekly_report_data)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' | ')
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {editRowId === row._id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="btn-primary"
                          onClick={() => saveEdit(row)}
                          disabled={savingId === row._id}
                        >
                          {savingId === row._id ? 'Saving...' : 'Save'}
                        </button>
                        <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn-secondary" onClick={() => startEdit(row)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-gray-500">
                    No evaluation data found.
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

export default EvaluationOverview;
