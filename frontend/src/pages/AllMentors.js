import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { axiosInstance, listMentorDirectory, createMentor, updateMentor } from '../api/axios';

const AllMentors = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('external');

  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [mentorModalMode, setMentorModalMode] = useState('add'); // 'add' | 'edit'
  const [mentorEditingId, setMentorEditingId] = useState(null);
  const [mentorForm, setMentorForm] = useState({ name: '', email: '', phone: '' });
  const [mentorSaving, setMentorSaving] = useState(false);
  const [mentorFormError, setMentorFormError] = useState('');

  const [externalMentors, setExternalMentors] = useState([]);
  const [filteredExternalMentors, setFilteredExternalMentors] = useState([]);
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalLoading, setExternalLoading] = useState(true);
  const [externalCurrentPage, setExternalCurrentPage] = useState(1);

  const [internalMentors, setInternalMentors] = useState([]);
  const [filteredInternalMentors, setFilteredInternalMentors] = useState([]);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  const [message, setMessage] = useState({ type: '', text: '' });
  const mentorsPerPage = 10;

  const fetchExternalMentors = useCallback(async () => {
    try {
      setExternalLoading(true);
      const response = await listMentorDirectory('external');
      if (response.data.success) {
        setExternalMentors(response.data.data);
        setFilteredExternalMentors(response.data.data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error loading external evaluators' });
    } finally {
      setExternalLoading(false);
    }
  }, []);

  const fetchInternalMentors = useCallback(async () => {
    try {
      setInternalLoading(true);
      const response = await listMentorDirectory('internal');
      if (response.data.success) {
        setInternalMentors(response.data.data);
        setFilteredInternalMentors(response.data.data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error loading internal examiners' });
    } finally {
      setInternalLoading(false);
    }
  }, []);

  useEffect(() => { fetchExternalMentors(); fetchInternalMentors(); }, [fetchExternalMentors, fetchInternalMentors]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    if (type === 'internal' || type === 'external') {
      setActiveTab(type);
    }
  }, [location.search]);

  useEffect(() => {
    if (externalSearchQuery.trim() === '') {
      setFilteredExternalMentors(externalMentors);
    } else {
      const q = externalSearchQuery.toLowerCase();
      setFilteredExternalMentors(externalMentors.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || String(m.phone || '').toLowerCase().includes(q)));
      setExternalCurrentPage(1);
    }
  }, [externalSearchQuery, externalMentors]);

  useEffect(() => {
    if (internalSearchQuery.trim() === '') {
      setFilteredInternalMentors(internalMentors);
    } else {
      const q = internalSearchQuery.toLowerCase();
      setFilteredInternalMentors(internalMentors.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || String(m.phone || '').toLowerCase().includes(q)));
      setInternalCurrentPage(1);
    }
  }, [internalSearchQuery, internalMentors]);


  const handleDeleteExternalMentor = async (mentorId, mentorName) => {
    if (!window.confirm(`Delete External Evaluator: ${mentorName}? This action cannot be undone.`)) return;
    try {
      const response = await axiosInstance.delete(`/upload/mentors/${mentorId}`);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchExternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting external evaluator' });
    }
  };

  const handleDeleteInternalMentor = async (mentorId, mentorName) => {
    if (!window.confirm(`Delete Internal Examiner: ${mentorName}? This action cannot be undone.`)) return;
    try {
      const response = await axiosInstance.delete(`/upload/internal-mentors/${mentorId}`);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchInternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting internal examiner' });
    }
  };

  const handleDeleteAllExternalMentors = async () => {
    if (!window.confirm(`WARNING: Delete ALL ${externalMentors.length} External Evaluators? This cannot be undone.`)) return;
    if (!window.confirm(`Final confirmation: Delete ${externalMentors.length} external evaluators?`)) return;
    try {
      setExternalLoading(true);
      const response = await axiosInstance.delete('/upload/mentors');
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchExternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting external evaluators' });
    } finally { setExternalLoading(false); }
  };

  const handleDeleteAllInternalMentors = async () => {
    if (!window.confirm(`WARNING: Delete ALL ${internalMentors.length} Internal Examiners? This cannot be undone.`)) return;
    if (!window.confirm(`Final confirmation: Delete ${internalMentors.length} internal examiners?`)) return;
    try {
      setInternalLoading(true);
      const response = await axiosInstance.delete('/upload/internal-mentors');
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchInternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting internal examiners' });
    } finally { setInternalLoading(false); }
  };

  const openAddMentorModal = () => {
    setMentorModalMode('add');
    setMentorEditingId(null);
    setMentorForm({ name: '', email: '', phone: '' });
    setMentorFormError('');
    setMentorModalOpen(true);
  };

  const openEditMentorModal = (mentor) => {
    setMentorModalMode('edit');
    setMentorEditingId(mentor._id);
    setMentorForm({ name: mentor.name || '', email: mentor.email || '', phone: mentor.phone || '' });
    setMentorFormError('');
    setMentorModalOpen(true);
  };

  const closeMentorModal = () => {
    if (mentorSaving) return;
    setMentorModalOpen(false);
  };

  const validateMentorForm = () => {
    const name = mentorForm.name.trim();
    const email = mentorForm.email.trim();
    if (!name) return 'Name is required';
    if (!email) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const handleSaveMentor = async (e) => {
    e.preventDefault();
    setMentorFormError('');

    const errorText = validateMentorForm();
    if (errorText) {
      setMentorFormError(errorText);
      return;
    }

    const confirmText = mentorModalMode === 'add'
      ? 'Are you sure you want to add this evaluator?'
      : 'Are you sure you want to save changes to this evaluator?';
    if (!window.confirm(confirmText)) return;

    const type = activeTab === 'internal' ? 'internal' : 'external';

    try {
      setMentorSaving(true);
      if (mentorModalMode === 'add') {
        const response = await createMentor(type, {
          name: mentorForm.name.trim(),
          email: mentorForm.email.trim(),
          phone: mentorForm.phone,
        });
        if (response.data.success) {
          setMessage({ type: 'success', text: response.data.message || 'Evaluator added successfully' });
        }
      } else {
        const response = await updateMentor(type, mentorEditingId, {
          name: mentorForm.name.trim(),
          email: mentorForm.email.trim(),
          phone: mentorForm.phone,
        });
        if (response.data.success) {
          setMessage({ type: 'success', text: response.data.message || 'Evaluator updated successfully' });
        }
      }

      if (type === 'internal') {
        await fetchInternalMentors();
      } else {
        await fetchExternalMentors();
      }

      setMentorModalOpen(false);
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to save evaluator';
      setMentorFormError(msg);
      setMessage({ type: 'error', text: msg });
    } finally {
      setMentorSaving(false);
    }
  };

  const currentMentors = activeTab === 'external' ? externalMentors : internalMentors;
  const filteredMentors = activeTab === 'external' ? filteredExternalMentors : filteredInternalMentors;
  const searchQuery = activeTab === 'external' ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = activeTab === 'external' ? setExternalSearchQuery : setInternalSearchQuery;
  const currentPage = activeTab === 'external' ? externalCurrentPage : internalCurrentPage;
  const setCurrentPage = activeTab === 'external' ? setExternalCurrentPage : setInternalCurrentPage;
  const handleDeleteMentor = activeTab === 'external' ? handleDeleteExternalMentor : handleDeleteInternalMentor;
  const handleDeleteAllMentors = activeTab === 'external' ? handleDeleteAllExternalMentors : handleDeleteAllInternalMentors;

  const indexOfLastMentor = currentPage * mentorsPerPage;
  const indexOfFirstMentor = indexOfLastMentor - mentorsPerPage;
  const displayMentors = filteredMentors.slice(indexOfFirstMentor, indexOfLastMentor);
  const totalPages = Math.ceil(filteredMentors.length / mentorsPerPage);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Evaluator Directory</h1>
          <p className="page-subtitle">View all external evaluators and internal examiners and their group assignments</p>
        </div>
        {currentMentors.length > 0 && (
          <button onClick={handleDeleteAllMentors} className="btn-danger">
            Delete All {activeTab === 'external' ? 'External Evaluators' : 'Internal Examiners'}
          </button>
        )}
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="stat-label">Assigned</p>
          <p className="stat-value">{currentMentors.filter(m => m.isAssigned).length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Available</p>
          <p className="stat-value">{currentMentors.filter(m => !m.isAssigned).length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Groups</p>
          <p className="stat-value">{currentMentors.reduce((sum, m) => sum + m.groupCount, 0)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Students</p>
          <p className="stat-value">{currentMentors.reduce((sum, m) => sum + m.studentsHandled, 0)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="section-card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { key: 'external', label: `External Evaluators (${externalMentors.length})` },
              { key: 'internal', label: `Internal Examiners (${internalMentors.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                    ? 'border-accent-600 text-accent-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Search inside card */}
        <div className="section-card-body border-b border-gray-100 pb-4">
          <label className="form-label">Search {activeTab === 'external' ? 'External Evaluators' : 'Internal Examiners'}</label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={`Search by name, email, or phone...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input flex-1"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="btn-secondary">Clear</button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-1 text-xs text-gray-500">
              Showing {filteredMentors.length} of {currentMentors.length} evaluators
            </p>
          )}
        </div>

        {/* Table */}
        <div className="p-0">
          {(activeTab === 'external' ? externalLoading : internalLoading) ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner mr-3"></div>
              <span className="text-sm text-gray-500">Loading evaluators...</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Evaluator Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Assigned Groups</th>
                  <th>Students Handled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayMentors.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-gray-400">
                      {searchQuery ? `No evaluators found matching "${searchQuery}"` : `No ${activeTab === 'external' ? 'external evaluators' : 'internal examiners'} found.`}
                    </td>
                  </tr>
                ) : (
                  displayMentors.map((mentor, index) => (
                    <tr key={mentor._id}>
                      <td>{indexOfFirstMentor + index + 1}</td>
                      <td className="font-medium">{mentor.name}</td>
                      <td>{mentor.email}</td>
                      <td>{mentor.phone || '-'}</td>
                      <td>
                        <span className={`badge ${mentor.isAssigned ? 'badge-green' : 'badge-gray'}`}>
                          {mentor.isAssigned ? 'Assigned' : 'Available'}
                        </span>
                      </td>
                      <td>
                        {mentor.assignedGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {mentor.assignedGroups.map((group) => (
                              <span key={group._id} className="badge badge-blue">
                                {group.name} ({group.studentCount})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td>{mentor.studentsHandled}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditMentorModal(mentor)}
                            className="btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMentor(mentor._id, mentor.name)}
                            className="btn-danger"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination + Add Mentor */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              {totalPages > 1 ? (
                <>
                  <p className="text-xs text-gray-500">
                    Showing {indexOfFirstMentor + 1}â€“{Math.min(indexOfLastMentor, filteredMentors.length)} of {filteredMentors.length} evaluators
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="btn-secondary disabled:opacity-40"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-600 self-center">Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="btn-secondary disabled:opacity-40"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500">
                  Showing {filteredMentors.length} evaluator{filteredMentors.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <button onClick={openAddMentorModal} className="btn-primary">
              + Add Evaluator
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Mentor Modal */}
      {mentorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {mentorModalMode === 'add'
                  ? `Add ${activeTab === 'internal' ? 'Internal' : 'External'} Evaluator`
                  : 'Edit Evaluator'}
              </h2>
              <button onClick={closeMentorModal} disabled={mentorSaving} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSaveMentor} className="px-6 py-5">
              {mentorFormError && (
                <div className="alert-error mb-4">{mentorFormError}</div>
              )}

              <div className="mb-4">
                <label className="form-label">Evaluator Name</label>
                <input
                  type="text"
                  value={mentorForm.name}
                  onChange={(e) => setMentorForm(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Enter evaluator name"
                  disabled={mentorSaving}
                />
              </div>

              <div className="mb-2">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={mentorForm.email}
                  onChange={(e) => setMentorForm(prev => ({ ...prev, email: e.target.value }))}
                  className="form-input"
                  placeholder="evaluator@example.com"
                  disabled={mentorSaving}
                />
                <p className="mt-1 text-xs text-gray-500">Email must be unique across all evaluators.</p>
              </div>

              <div className="mb-2">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  value={mentorForm.phone}
                  onChange={(e) => setMentorForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="form-input"
                  placeholder="Phone number (text)"
                  disabled={mentorSaving}
                />
                <p className="mt-1 text-xs text-gray-500">Stored as text so leading zeros are preserved.</p>
              </div>

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={closeMentorModal} disabled={mentorSaving} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={mentorSaving} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {mentorSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllMentors;