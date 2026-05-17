import React, { useState, useEffect, useCallback } from 'react';
import { getInternships, updateInternship, deleteInternship } from '../api/axios';

const MentorEdit = () => {
  const [internships, setInternships] = useState([]);
  const [filteredInternships, setFilteredInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [editData, setEditData] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInternships = useCallback(async () => {
    try {
      const res = await getInternships();
      if (res.data.success) {
        setInternships(res.data.data);
        setFilteredInternships(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching internships:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInternships(); }, [fetchInternships]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    if (value.trim() === '') {
      setFilteredInternships(internships);
    } else {
      const q = value.toLowerCase();
      setFilteredInternships(internships.filter(item =>
        item.name?.toLowerCase().includes(q) ||
        item.uid?.toLowerCase().includes(q) ||
        item.externalMentorName?.toLowerCase().includes(q)
      ));
    }
  };

  const handleSelectInternship = (internship) => {
    setSelectedInternship(internship);
    setEditData({ ...internship });
    setSuccessMessage('');
  };

  const handleInputChange = (field, value) => setEditData({ ...editData, [field]: value });

  const formatDateInput = (value) => (value ? new Date(value).toISOString().split('T')[0] : '');
  const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '');

  const handleSave = async () => {
    try {
      const res = await updateInternship(selectedInternship._id, editData);
      if (res.data.success) {
        setSuccessMessage('Internship updated successfully.');
        fetchInternships();
        setTimeout(() => { setSelectedInternship(null); setSuccessMessage(''); }, 2000);
      }
    } catch (error) {
      console.error('Error updating internship:', error);
      alert('Error updating internship');
    }
  };

  const handleRemoveStudent = async () => {
    if (!selectedInternship) return;
    const confirmed = window.confirm(
      `WARNING: Permanently remove student?\n\nName: ${selectedInternship.name}\nUID: ${selectedInternship.uid}\nCompany: ${selectedInternship.companyName}\n\nThis will delete the student and all associated data. This CANNOT be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await deleteInternship(selectedInternship._id);
      if (res.data.success) {
        setSuccessMessage(`Student "${selectedInternship.name}" removed.`);
        fetchInternships();
        setTimeout(() => { setSelectedInternship(null); setSuccessMessage(''); }, 2000);
      }
    } catch (error) {
      alert('Error removing student: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner mr-3"></div>
          <span className="text-sm text-gray-500">Loading internship records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Record Management</h1>
          <p className="page-subtitle">Search and manage individual internship records</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel â€” Student List */}
        <div className="lg:col-span-1">
          <div className="section-card h-full">
            <div className="section-card-header">
              <h2 className="section-title">Student Records ({filteredInternships.length})</h2>
            </div>
            <div className="section-card-body border-b border-gray-100 pb-4">
              <label className="form-label">Search</label>
              <input
                type="text"
                placeholder="Name, UID, or evaluator..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="form-input"
              />
            </div>
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {filteredInternships.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No records found.</div>
              ) : (
                filteredInternships.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => handleSelectInternship(item)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedInternship?._id === item._id ? 'bg-accent-50 border-l-2 border-l-accent-600' : ''
                      }`}
                  >
                    <p className="font-medium text-sm text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.companyName}</p>
                    {item.externalMentorName && <p className="text-xs text-gray-400">{item.externalMentorName}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel â€” Edit Form */}
        <div className="lg:col-span-2">
          {selectedInternship ? (
            <div className="section-card">
              <div className="section-card-header flex items-center justify-between">
                <div>
                  <h2 className="section-title">Student Record: {selectedInternship.name}</h2>
                  <p className="text-xs text-gray-500">{selectedInternship.uid} â€” {selectedInternship.companyName}</p>
                </div>
                <button onClick={() => { setSelectedInternship(null); setSuccessMessage(''); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>

              <div className="section-card-body space-y-6">
                {successMessage && <div className="alert-success">{successMessage}</div>}

                {/* Personal Information */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Student Information</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Student Name</label>
                      <input type="text" value={editData.name || ''} readOnly className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">UID</label>
                      <input type="text" value={editData.uid || ''} readOnly className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input type="email" value={editData.email || ''} readOnly className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Phone</label>
                      <input type="tel" value={editData.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Branch</label>
                      <select value={editData.branch || ''} disabled className="form-select">
                        <option value="">Select Branch</option>
                        {['COMPS', 'EXTC', 'CSE', 'MCA', 'CSE - AIML', 'CSE - DS', 'IT', 'MECH', 'ETRX'].map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Gender</label>
                      <select value={editData.gender || ''} onChange={(e) => handleInputChange('gender', e.target.value)} className="form-select">
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Profile</label>
                      <select value={editData.profile || ''} onChange={(e) => handleInputChange('profile', e.target.value)} className="form-select">
                        <option value="">Select</option>
                        <option value="Tech">Tech</option>
                        <option value="Non Tech">Non Tech</option>
                        <option value="tech">tech</option>
                        <option value="non tech">non tech</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Company Information */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Company Information</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Company Name</label>
                      <input type="text" value={editData.companyName || ''} onChange={(e) => handleInputChange('companyName', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Company Location</label>
                      <input type="text" value={editData.companyLocation || ''} onChange={(e) => handleInputChange('companyLocation', e.target.value)} className="form-input" />
                    </div>
                  </div>
                </fieldset>

                {/* Internship Details */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Internship Details</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Internship Type</label>
                      <select value={editData.internshipType || ''} onChange={(e) => handleInputChange('internshipType', e.target.value)} className="form-select">
                        <option value="">Select Type</option>
                        {['Off-Campus', 'On-Campus', 'College-Arranged', 'Self-Arranged', '8th Sem'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Internship Title / Role</label>
                      <input type="text" value={editData.internshipTitle || ''} onChange={(e) => handleInputChange('internshipTitle', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">External Evaluator Name</label>
                      <input type="text" value={editData.externalMentorName || ''} onChange={(e) => handleInputChange('externalMentorName', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Duration (months)</label>
                      <input type="number" min="0" value={editData.duration || ''} onChange={(e) => handleInputChange('duration', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Start Date</label>
                      <input type="date" value={formatDateInput(editData.startDate)} onChange={(e) => handleInputChange('startDate', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">End Date</label>
                      <input type="date" value={formatDateInput(editData.endDate)} onChange={(e) => handleInputChange('endDate', e.target.value)} className="form-input" />
                    </div>
                  </div>
                </fieldset>


                {/* Documentation */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Documentation</legend>
                  <div>
                    <label className="form-label">Document Link</label>
                    <input type="url" value={editData.documentLink || ''} onChange={(e) => handleInputChange('documentLink', e.target.value)} placeholder="Google Drive or document link" className="form-input" />
                  </div>
                  <div className="mt-4">
                    <label className="form-label">Remarks</label>
                    <textarea value={editData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} rows="3" placeholder="Additional notes" className="form-input" />
                  </div>
                </fieldset>

                {/* Group Assignment */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Group Assignment</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Assigned Group (ID)</label>
                      <input type="text" value={editData.assignedGroup || ''} readOnly className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Assigned Group Name</label>
                      <input type="text" value={editData.assignedGroupName || ''} readOnly className="form-input" />
                    </div>
                  </div>
                </fieldset>

                {/* Evaluation Matrix */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Evaluation Matrix</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Meeting Attended</label>
                      <input type="number" min="0" value={editData.meeting_attended ?? ''} onChange={(e) => handleInputChange('meeting_attended', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Weekly Reports Completed</label>
                      <input type="number" min="0" value={editData.weekly_reports_completed ?? ''} onChange={(e) => handleInputChange('weekly_reports_completed', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Final Report Submitted</label>
                      <input type="number" min="0" value={editData.final_report_submitted ?? ''} onChange={(e) => handleInputChange('final_report_submitted', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">External Marks</label>
                      <input type="number" min="0" value={editData.external_marks ?? ''} onChange={(e) => handleInputChange('external_marks', e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Viva Marks</label>
                      <input type="number" min="0" value={editData.viva_marks ?? ''} onChange={(e) => handleInputChange('viva_marks', e.target.value)} className="form-input" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">Weekly Report Data (read-only)</label>
                      <textarea
                        value={editData.weekly_report_data ? JSON.stringify(editData.weekly_report_data, null, 2) : ''}
                        readOnly
                        rows="4"
                        className="form-input font-mono text-xs"
                      />
                    </div>
                  </div>
                </fieldset>


                {/* Attendance (read-only) */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Attendance</legend>
                  {Array.isArray(editData.attendance) && editData.attendance.length > 0 ? (
                    <div className="space-y-2">
                      {editData.attendance.map((entry, idx) => (
                        <div key={`${entry.date || idx}`} className="text-sm text-gray-700">
                          {formatDateTime(entry.date)} â€” {entry.status}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No attendance records.</p>
                  )}
                </fieldset>

                {/* System Metadata (read-only) */}
                <fieldset>
                  <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">System Metadata</legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Submitted At</label>
                      <input type="text" value={formatDateTime(editData.submittedAt)} readOnly className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Created At</label>
                      <input type="text" value={formatDateTime(editData.createdAt)} readOnly className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Updated At</label>
                      <input type="text" value={formatDateTime(editData.updatedAt)} readOnly className="form-input" />
                    </div>
                  </div>
                </fieldset>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                  <button onClick={handleSave} className="btn-primary">Save Changes</button>
                  <button onClick={() => { setSelectedInternship(null); setSuccessMessage(''); }} className="btn-secondary">Cancel</button>
                  <button onClick={handleRemoveStudent} className="btn-danger ml-auto">Remove Student Record</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="section-card">
              <div className="section-card-body text-center py-20">
                <p className="text-gray-400 text-sm">Select a student from the list to view and edit their internship record.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MentorEdit;