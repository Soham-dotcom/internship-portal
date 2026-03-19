import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AllMentors = () => {
  const [activeTab, setActiveTab] = useState('external');

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

  useEffect(() => { fetchExternalMentors(); fetchInternalMentors(); }, []);

  useEffect(() => {
    if (externalSearchQuery.trim() === '') {
      setFilteredExternalMentors(externalMentors);
    } else {
      const q = externalSearchQuery.toLowerCase();
      setFilteredExternalMentors(externalMentors.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)));
      setExternalCurrentPage(1);
    }
  }, [externalSearchQuery, externalMentors]);

  useEffect(() => {
    if (internalSearchQuery.trim() === '') {
      setFilteredInternalMentors(internalMentors);
    } else {
      const q = internalSearchQuery.toLowerCase();
      setFilteredInternalMentors(internalMentors.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)));
      setInternalCurrentPage(1);
    }
  }, [internalSearchQuery, internalMentors]);

  const fetchExternalMentors = async () => {
    try {
      setExternalLoading(true);
      const response = await axios.get('http://localhost:5000/api/upload/mentors-with-details');
      if (response.data.success) { setExternalMentors(response.data.data); setFilteredExternalMentors(response.data.data); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error loading external mentors' });
    } finally { setExternalLoading(false); }
  };

  const fetchInternalMentors = async () => {
    try {
      setInternalLoading(true);
      const response = await axios.get('http://localhost:5000/api/upload/internal-mentors-with-details');
      if (response.data.success) { setInternalMentors(response.data.data); setFilteredInternalMentors(response.data.data); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error loading internal mentors' });
    } finally { setInternalLoading(false); }
  };

  const handleDeleteExternalMentor = async (mentorId, mentorName) => {
    if (!window.confirm(`Delete External Mentor: ${mentorName}? This action cannot be undone.`)) return;
    try {
      const response = await axios.delete(`http://localhost:5000/api/upload/mentors/${mentorId}`);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchExternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting external mentor' });
    }
  };

  const handleDeleteInternalMentor = async (mentorId, mentorName) => {
    if (!window.confirm(`Delete Internal Mentor: ${mentorName}? This action cannot be undone.`)) return;
    try {
      const response = await axios.delete(`http://localhost:5000/api/upload/internal-mentors/${mentorId}`);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchInternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting internal mentor' });
    }
  };

  const handleDeleteAllExternalMentors = async () => {
    if (!window.confirm(`WARNING: Delete ALL ${externalMentors.length} External Mentors? This cannot be undone.`)) return;
    if (!window.confirm(`Final confirmation: Delete ${externalMentors.length} external mentors?`)) return;
    try {
      setExternalLoading(true);
      const response = await axios.delete('http://localhost:5000/api/upload/mentors');
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchExternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting external mentors' });
    } finally { setExternalLoading(false); }
  };

  const handleDeleteAllInternalMentors = async () => {
    if (!window.confirm(`WARNING: Delete ALL ${internalMentors.length} Internal Mentors? This cannot be undone.`)) return;
    if (!window.confirm(`Final confirmation: Delete ${internalMentors.length} internal mentors?`)) return;
    try {
      setInternalLoading(true);
      const response = await axios.delete('http://localhost:5000/api/upload/internal-mentors');
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchInternalMentors(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error deleting internal mentors' });
    } finally { setInternalLoading(false); }
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
          <h1 className="page-title">Mentor Directory</h1>
          <p className="page-subtitle">View all external and internal mentors and their group assignments</p>
        </div>
        {currentMentors.length > 0 && (
          <button onClick={handleDeleteAllMentors} className="btn-danger">
            Delete All {activeTab === 'external' ? 'External' : 'Internal'} Mentors
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
              { key: 'external', label: `External Mentors (${externalMentors.length})` },
              { key: 'internal', label: `Internal Mentors (${internalMentors.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
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
          <label className="form-label">Search {activeTab === 'external' ? 'External' : 'Internal'} Mentors</label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={`Search by name or email...`}
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
              Showing {filteredMentors.length} of {currentMentors.length} mentors
            </p>
          )}
        </div>

        {/* Table */}
        <div className="p-0">
          {(activeTab === 'external' ? externalLoading : internalLoading) ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner mr-3"></div>
              <span className="text-sm text-gray-500">Loading mentors...</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mentor Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Assigned Groups</th>
                  <th>Students Handled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayMentors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-gray-400">
                      {searchQuery ? `No mentors found matching "${searchQuery}"` : `No ${activeTab} mentors found.`}
                    </td>
                  </tr>
                ) : (
                  displayMentors.map((mentor, index) => (
                    <tr key={mentor._id}>
                      <td>{indexOfFirstMentor + index + 1}</td>
                      <td className="font-medium">{mentor.name}</td>
                      <td>{mentor.email}</td>
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
                        <button onClick={() => handleDeleteMentor(mentor._id, mentor.name)} className="btn-danger" style={{fontSize:'12px',padding:'4px 10px'}}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Showing {indexOfFirstMentor + 1}–{Math.min(indexOfLastMentor, filteredMentors.length)} of {filteredMentors.length} mentors
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-40"
                  style={{fontSize:'12px',padding:'4px 10px'}}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600 self-center">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-40"
                  style={{fontSize:'12px',padding:'4px 10px'}}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllMentors;