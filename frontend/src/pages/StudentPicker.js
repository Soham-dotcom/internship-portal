import React, { useState } from 'react';
import { randomPick, exportRandom } from '../api/groups';

const branches = ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX'];
const statuses = ['pending', 'approved', 'in-progress', 'completed', 'cancelled'];

const StudentPicker = () => {
  const [filters, setFilters] = useState({ branch: '', company: '', status: '', year: '' });
  const [count, setCount] = useState(1);
  const [pickedStudents, setPickedStudents] = useState([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const handlePickStudents = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        filters: {
          ...(filters.branch && { branch: filters.branch }),
          ...(filters.company && { company: filters.company }),
          ...(filters.status && { status: filters.status }),
          ...(filters.year && { year: filters.year }),
        },
        count: parseInt(count) || 1,
      };
      const response = await randomPick(payload);
      if (response.data.success) {
        setPickedStudents(response.data.data);
        setTotalAvailable(response.data.totalAvailable);
        setMessage({ type: 'success', text: `Selected ${response.data.picked} student(s) from ${response.data.totalAvailable} unassigned students.` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error picking students. Only unassigned students can be picked.' });
      setPickedStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await exportRandom(pickedStudents);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `random_students_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage({ type: 'success', text: 'Students exported successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exporting students.' });
    }
  };

  const resetFilters = () => {
    setFilters({ branch: '', company: '', status: '', year: '' });
    setPickedStudents([]);
    setMessage({ type: '', text: '' });
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Selection Utility</h1>
          <p className="page-subtitle">Randomly select unassigned students based on academic filters</p>
        </div>
        {pickedStudents.length > 0 && (
          <button onClick={handleExport} className="btn-secondary">Export to Excel</button>
        )}
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* Filters Section */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-title">Selection Criteria</h2>
        </div>
        <div className="section-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Branch</label>
              <select name="branch" value={filters.branch} onChange={handleFilterChange} className="form-select">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select name="status" value={filters.status} onChange={handleFilterChange} className="form-select">
                <option value="">All Statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Company</label>
              <input type="text" name="company" value={filters.company} onChange={handleFilterChange} placeholder="Filter by company" className="form-input" />
            </div>
            <div>
              <label className="form-label">Year</label>
              <input type="text" name="year" value={filters.year} onChange={handleFilterChange} placeholder="e.g. 2024" className="form-input" />
            </div>
            <div>
              <label className="form-label">Number to Select</label>
              <input type="number" value={count} onChange={(e) => setCount(e.target.value)} min="1" placeholder="e.g. 5" className="form-input" />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handlePickStudents} disabled={loading} className="btn-primary">
              {loading ? 'Selecting...' : 'Select Students'}
            </button>
            <button onClick={resetFilters} className="btn-secondary">Reset</button>
          </div>

          <div className="alert-info mt-4">
            Only students not already assigned to a group are eligible. Students in existing groups are excluded automatically.
          </div>
        </div>
      </div>

      {/* Results Table */}
      {pickedStudents.length > 0 && (
        <div className="section-card mt-6">
          <div className="section-card-header">
            <h2 className="section-title">Selected Students</h2>
            <p className="text-sm text-gray-500">{pickedStudents.length} selected from {totalAvailable} available</p>
          </div>
          <div className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>UID</th>
                  <th>Branch</th>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Mentor</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {pickedStudents.map((student, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td className="font-medium">{student.name}</td>
                    <td>{student.uid}</td>
                    <td><span className="badge badge-blue">{student.branch}</span></td>
                    <td>{student.company}</td>
                    <td>{student.internshipType}</td>
                    <td>
                      <span className="badge badge-green">{student.status}</span>
                    </td>
                    <td>{student.mentor || 'â€”'}</td>
                    <td className="text-xs">{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="section-card mt-6">
        <div className="section-card-header">
          <h2 className="section-title">Instructions</h2>
        </div>
        <div className="section-card-body">
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>Set filters to narrow the pool of eligible students.</li>
            <li>Specify how many students to randomly select.</li>
            <li>Click "Select Students" to generate the selection.</li>
            <li>Export the results to Excel for further processing.</li>
            <li>Use for fair random selection for events, presentations, or activities.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StudentPicker;