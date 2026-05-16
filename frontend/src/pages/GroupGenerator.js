import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { exportGroups as exportGroupsOld } from '../api/axios';
import { generateGroups, listGroups, unassignStudents } from '../api/groups';

const branches = ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX'];

const GroupGenerator = () => {
  const [filters, setFilters] = useState({ branch: '', company: '', year: '' });
  const [groupSettings, setGroupSettings] = useState({
    groupSize: 5,
    numGroups: '',
    randomize: true,
    assignToGroups: false,
  });
  const [groups, setGroups] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [existingGroups, setExistingGroups] = useState([]);

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const handleSettingChange = (e) => {
    const { name, type, checked, value } = e.target;
    setGroupSettings({ ...groupSettings, [name]: type === 'checkbox' ? checked : value });
  };

  const handleGenerateGroups = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        filters: {
          ...(filters.branch && { branch: filters.branch }),
          ...(filters.company && { company: filters.company }),
          ...(filters.year && { year: filters.year }),
        },
        groupSize: parseInt(groupSettings.groupSize) || 5,
        numGroups: groupSettings.numGroups ? parseInt(groupSettings.numGroups) : null,
        randomize: groupSettings.randomize,
        assignToGroups: groupSettings.assignToGroups,
      };
      const response = await generateGroups(payload);
      if (response.data.success) {
        setGroups(response.data.data.groups);
        setTotalStudents(response.data.data.totalStudents);
        const saved = response.data.data.assigned;
        setMessage({
          type: 'success',
          text: `Generated ${response.data.data.totalGroups} groups with ${response.data.data.totalStudents} students. ${saved ? 'Groups saved to database.' : 'Preview only — not saved.'}`,
        });
        if (saved) fetchExistingGroups();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error generating groups. Only unassigned students can be added.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingGroups = async () => {
    try {
      const response = await listGroups();
      if (response.data.success) setExistingGroups(response.data.data);
    } catch (error) {
      console.error('Error fetching existing groups:', error);
    }
  };

  const handleUnassignGroup = async (groupId) => {
    const group = existingGroups.find(g => g._id === groupId);
    if (!group) return;
    if (!window.confirm(`Unassign all ${group.studentCount} students from ${group.groupName}?`)) return;
    try {
      const uids = group.students.map(s => s.uid);
      const response = await unassignStudents(uids);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchExistingGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error unassigning students' });
    }
  };

  React.useEffect(() => { fetchExistingGroups(); }, []);

  const handleExportGroups = async () => {
    try {
      if (!groups || groups.length === 0) { setMessage({ type: 'error', text: 'No groups to export. Please generate groups first.' }); return; }
      const wb = XLSX.utils.book_new();
      groups.forEach((group) => {
        const exportData = group.students.map((student, idx) => ({
          'S.No': idx + 1, 'Student Name': student.name, 'UID': student.uid,
          'Email': student.email, 'Branch': student.branch, 'Company': student.company,
          'External Evaluator': student.externalMentorName || '', 'Placement Type': student.internshipType,
          'Start Date': student.startDate ? new Date(student.startDate).toISOString().split('T')[0] : '',
          'End Date': student.endDate ? new Date(student.endDate).toISOString().split('T')[0] : ''
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, (group.groupName || `Group ${groups.indexOf(group) + 1}`).substring(0, 31));
      });
      XLSX.writeFile(wb, `student_groups_${new Date().toISOString().split('T')[0]}.xlsx`);
      setMessage({ type: 'success', text: `Exported ${groups.length} group(s) successfully.` });
    } catch (error) {
      setMessage({ type: 'error', text: `Export failed: ${error.message}` });
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Group Formation System</h1>
          <p className="page-subtitle">Create evaluation groups using filters and group size rules</p>
        </div>
        {groups.length > 0 && (
          <button onClick={handleExportGroups} className="btn-secondary">Export Groups to Excel</button>
        )}
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : 'error'}`}>
          <div className="whitespace-pre-wrap">{message.text}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Filters */}
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Student Filters</h2>
          </div>
          <div className="section-card-body space-y-4">
            <div>
              <label className="form-label">Branch</label>
              <select name="branch" value={filters.branch} onChange={handleFilterChange} className="form-select">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Company</label>
              <input type="text" name="company" value={filters.company} onChange={handleFilterChange} placeholder="Filter by company name" className="form-input" />
            </div>
            <div>
              <label className="form-label">Year</label>
              <input type="text" name="year" value={filters.year} onChange={handleFilterChange} placeholder="e.g. 2024" className="form-input" />
            </div>
          </div>
        </div>

        {/* Group Settings */}
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Group Settings</h2>
          </div>
          <div className="section-card-body space-y-4">
            <div>
              <label className="form-label">Group Size</label>
              <input type="number" name="groupSize" value={groupSettings.groupSize} onChange={handleSettingChange} min="1" placeholder="e.g. 5" className="form-input" />
              <p className="mt-1 text-xs text-gray-500">Number of students per group</p>
            </div>
            <div>
              <label className="form-label">Number of Groups <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="number" name="numGroups" value={groupSettings.numGroups} onChange={handleSettingChange} min="1" placeholder="Leave blank to use group size" className="form-input" />
              <p className="mt-1 text-xs text-gray-500">Overrides group size if specified</p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="randomize" checked={groupSettings.randomize} onChange={handleSettingChange} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-gray-700">Randomize student assignment</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="assignToGroups" checked={groupSettings.assignToGroups} onChange={handleSettingChange} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-gray-700">Save groups to database</span>
              </label>
              <p className="text-xs text-gray-500">If unchecked, result is preview only and not stored.</p>
            </div>
            <div className="pt-2">
              <button onClick={handleGenerateGroups} disabled={loading} className="btn-primary w-full">
                {loading ? 'Generating...' : 'Generate Evaluation Groups'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="alert-info mt-2">
        Only students not already assigned to a group will be included. Students in existing groups are excluded automatically.
      </div>

      {/* Existing Groups */}
      {existingGroups.length > 0 && (
        <div className="section-card mt-6">
          <div className="section-card-header">
            <h2 className="section-title">Existing Evaluation Groups ({existingGroups.length})</h2>
          </div>
          <div className="section-card-body p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group Name</th>
                  <th>Student Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {existingGroups.map((group) => (
                  <tr key={group._id}>
                    <td className="font-medium">{group.groupName}</td>
                    <td>{group.studentCount} student{group.studentCount !== 1 ? 's' : ''}</td>
                    <td>
                      <button onClick={() => handleUnassignGroup(group._id)} className="btn-danger" style={{fontSize:'12px',padding:'4px 10px'}}>
                        Unassign All
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generated Groups Preview */}
      {groups.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-title">Generated Evaluation Groups</h2>
              <p className="text-sm text-gray-500">{groups.length} groups — {totalStudents} total students</p>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.groupNumber} className="section-card">
              <div className="section-card-header">
                <h3 className="section-title">Group {group.groupNumber} <span className="text-gray-400 font-normal">({group.students.length} students)</span></h3>
              </div>
              <div className="p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>UID</th>
                      <th>Branch</th>
                      <th>Company</th>
                      <th>Placement Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.students.map((student, idx) => (
                      <tr key={idx}>
                        <td>{student.name}</td>
                        <td>{student.uid}</td>
                        <td><span className="badge badge-blue">{student.branch}</span></td>
                        <td>{student.company}</td>
                        <td>{student.internshipType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupGenerator;
