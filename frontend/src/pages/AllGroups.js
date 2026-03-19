import React, { useState, useEffect } from 'react';
import { 
  listGroupsWithMentors, 
  exportGroups, 
  unassignStudents,
  allocateExternalMentorsToAll,
  allocateInternalMentorsToAll,
  allocateExternalMentorToGroup,
  allocateInternalMentorToGroup,
  searchGroups,
  syncMentors,
  updateGroup,
  clearAllGroups
} from '../api/groups';
import axios from 'axios';
import * as XLSX from 'xlsx';

const AllGroups = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    students: [],
    externalMentor: '',
    internalMentor: ''
  });
  const [availableExternalMentors, setAvailableExternalMentors] = useState([]);
  const [availableInternalMentors, setAvailableInternalMentors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchGroups(); }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groups);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await searchGroups(searchQuery);
        if (response.data.success) {
          setFilteredGroups(response.data.data);
          setMessage({ type: 'info', text: `Found ${response.data.count} groups matching "${searchQuery}"` });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Error searching groups' });
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, groups]);

  const fetchGroups = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await listGroupsWithMentors();
      if (response.data.success) {
        setGroups(response.data.data);
        setFilteredGroups(response.data.data);
        setMessage({ type: 'success', text: `Loaded ${response.data.count} groups` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error loading groups' });
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) { newExpanded.delete(groupId); } else { newExpanded.add(groupId); }
    setExpandedGroups(newExpanded);
  };

  const handleExportAll = async () => {
    try {
      if (!groups || groups.length === 0) { setMessage({ type: 'error', text: 'No groups to export' }); return; }
      const formattedGroups = groups.map(group => ({
        _id: group._id, groupId: group._id, groupName: group.groupName,
        groupNumber: parseInt(group.groupName.replace('Group ', '')) || 0, students: group.students
      }));
      const response = await exportGroups(formattedGroups);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `all_student_groups_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'All groups exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error exporting groups' });
    }
  };

  const handleExportSingleGroup = (group) => {
    try {
      const wb = XLSX.utils.book_new();
      const exportData = group.students.map((student, idx) => ({
        'S.No': idx + 1, 'Student Name': student.name, 'UID': student.uid,
        'Institutional Email': student.email || '', 'Branch': student.branch,
        'Company': student.company || '',
        'External Mentor': group.externalMentor?.name || 'Not Assigned',
        'Internal Mentor': group.internalMentor?.name || 'Not Assigned',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, group.groupName || 'Group');
      XLSX.writeFile(wb, `${group.groupName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setMessage({ type: 'success', text: `${group.groupName} exported successfully!` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exporting group' });
    }
  };

  const handleUnassignGroup = async (group) => {
    if (!window.confirm(`Unassign all ${group.studentCount} students from ${group.groupName}?`)) return;
    try {
      const uids = group.students.map(s => s.uid);
      const response = await unassignStudents(uids);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error unassigning students' });
    }
  };

  const handleUnassignAllGroups = async () => {
    const totalStudents = groups.reduce((sum, g) => sum + g.studentCount, 0);
    if (!window.confirm(`WARNING: This will unassign ALL ${totalStudents} students from ALL ${groups.length} groups. Are you sure?`)) return;
    try {
      const allUids = [];
      groups.forEach(group => { group.students.forEach(student => { allUids.push(student.uid); }); });
      const response = await unassignStudents(allUids);
      if (response.data.success) {
        setMessage({ type: 'success', text: `Successfully unassigned all ${totalStudents} students from ${groups.length} groups` });
        fetchGroups();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error unassigning all groups' });
    }
  };

  const handleAllocateExternalMentorsToAll = async () => {
    const unassignedGroups = groups.filter(g => !g.externalMentor);
    if (unassignedGroups.length === 0) { setMessage({ type: 'warning', text: 'All groups already have external mentors assigned.' }); return; }
    if (!window.confirm(`Allocate external mentors to ${unassignedGroups.length} groups?`)) return;
    try {
      const response = await allocateExternalMentorsToAll();
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating external mentors' });
    }
  };

  const handleAllocateInternalMentorsToAll = async () => {
    const unassignedGroups = groups.filter(g => !g.internalMentor);
    if (unassignedGroups.length === 0) { setMessage({ type: 'warning', text: 'All groups already have internal mentors assigned.' }); return; }
    if (!window.confirm(`Allocate internal mentors to ${unassignedGroups.length} groups?`)) return;
    try {
      const response = await allocateInternalMentorsToAll();
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating internal mentors' });
    }
  };

  const handleAllocateExternalMentorToGroup = async (groupId, groupName) => {
    if (!window.confirm(`Allocate a random external mentor to ${groupName}?`)) return;
    try {
      const response = await allocateExternalMentorToGroup(groupId);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating external mentor' });
    }
  };

  const handleAllocateInternalMentorToGroup = async (groupId, groupName) => {
    if (!window.confirm(`Allocate a random internal mentor to ${groupName}?`)) return;
    try {
      const response = await allocateInternalMentorToGroup(groupId);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating internal mentor' });
    }
  };

  const handleSyncMentors = async () => {
    if (!window.confirm('Sync Mentor Assignments? This will fix any mentors incorrectly marked as assigned/unassigned.')) return;
    try {
      setLoading(true);
      const response = await syncMentors();
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error syncing mentors' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = async (group) => {
    setEditingGroup(group);
    setEditFormData({
      name: group.groupName,
      students: group.students.map(s => s.uid).join(', '),
      externalMentor: group.externalMentor?._id || '',
      internalMentor: group.internalMentor?._id || ''
    });
    try {
      const [externalRes, internalRes] = await Promise.all([
        axios.get('http://localhost:5000/api/upload/mentors'),
        axios.get('http://localhost:5000/api/upload/internal-mentors')
      ]);
      if (externalRes.data.success) setAvailableExternalMentors(externalRes.data.data);
      if (internalRes.data.success) setAvailableInternalMentors(internalRes.data.data);
    } catch (error) {
      console.error('Error fetching mentors:', error);
    }
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingGroup(null);
    setEditFormData({ name: '', students: [], externalMentor: '', internalMentor: '' });
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup) return;
    if (!editFormData.name.trim()) { setMessage({ type: 'error', text: 'Group name is required' }); return; }
    setSaving(true);
    try {
      const updateData = {
        name: editFormData.name,
        externalMentor: editFormData.externalMentor || null,
        internalMentor: editFormData.internalMentor || null
      };
      const response = await updateGroup(editingGroup._id, updateData);
      if (response.data.success) {
        setMessage({ type: 'success', text: `${editFormData.name} updated successfully` });
        handleCloseEditModal();
        fetchGroups();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error updating group' });
    } finally {
      setSaving(false);
    }
  };

  const expandAll = () => setExpandedGroups(new Set(groups.map(g => g._id)));
  const collapseAll = () => setExpandedGroups(new Set());

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Loading groups...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalStudentsAll = groups.reduce((sum, g) => sum + g.studentCount, 0);
  const avgSize = groups.length > 0 ? Math.round(totalStudentsAll / groups.length) : 0;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Student Groups</h1>
          <p className="page-subtitle">View and manage allocated student groups and mentor assignments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchGroups} className="btn-secondary">Refresh</button>
          {groups.length > 0 && (
            <>
              <button onClick={handleAllocateExternalMentorsToAll} className="btn-secondary">Allocate External Mentors</button>
              <button onClick={handleAllocateInternalMentorsToAll} className="btn-secondary">Allocate Internal Mentors</button>
              <button onClick={handleSyncMentors} className="btn-secondary">Sync Mentors</button>
              <button onClick={handleExportAll} className="btn-secondary">Export All Groups</button>
              <button onClick={handleUnassignAllGroups} className="btn-danger">Unassign All Groups</button>
            </>
          )}
        </div>
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : message.type === 'info' ? 'info' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* KPI Summary */}
      {groups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <p className="stat-label">Total Groups</p>
            <p className="stat-value">{groups.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Students Assigned</p>
            <p className="stat-value">{totalStudentsAll}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Avg Students per Group</p>
            <p className="stat-value">{avgSize}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="section-card mb-4">
        <div className="section-card-body">
          <label className="form-label">Search Groups</label>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by student name or mentor name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 loading-spinner" style={{width:'18px',height:'18px'}}></div>}
            </div>
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setFilteredGroups(groups); setMessage({ type: '', text: '' }); }} className="btn-secondary">
                Clear
              </button>
            )}
          </div>
          {searchQuery && <p className="mt-1 text-xs text-gray-500">Showing {filteredGroups.length} of {groups.length} groups</p>}
        </div>
      </div>

      {/* Expand/Collapse Controls */}
      {filteredGroups.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button onClick={expandAll} className="btn-secondary" style={{fontSize:'13px',padding:'6px 14px'}}>Expand All</button>
          <button onClick={collapseAll} className="btn-secondary" style={{fontSize:'13px',padding:'6px 14px'}}>Collapse All</button>
        </div>
      )}

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="section-card">
          <div className="section-card-body text-center py-16">
            <p className="text-gray-500 text-sm">
              {searchQuery ? `No groups match the search term "${searchQuery}".` : 'No student groups have been created yet. Use the Group Generator to create groups.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups.has(group._id);
            return (
              <div key={group._id} className="section-card overflow-hidden">
                {/* Group Row Header */}
                <div className="section-card-header flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleGroup(group._id)}
                      className="text-gray-400 hover:text-gray-700 font-bold text-sm w-6"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div>
                      <h3 className="section-title mb-0">{group.groupName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{group.studentCount} student{group.studentCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="ml-4 flex gap-4 text-xs">
                      {group.externalMentor
                        ? <span className="badge badge-blue">External: {group.externalMentor.name}</span>
                        : <span className="badge badge-red">No external mentor</span>}
                      {group.internalMentor
                        ? <span className="badge badge-green">Internal: {group.internalMentor.name}</span>
                        : <span className="badge badge-red">No internal mentor</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!group.externalMentor && (
                      <button onClick={() => handleAllocateExternalMentorToGroup(group._id, group.groupName)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>
                        Assign External
                      </button>
                    )}
                    {!group.internalMentor && (
                      <button onClick={() => handleAllocateInternalMentorToGroup(group._id, group.groupName)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>
                        Assign Internal
                      </button>
                    )}
                    <button onClick={() => handleOpenEditModal(group)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>Edit</button>
                    <button onClick={() => handleExportSingleGroup(group)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>Export</button>
                    <button onClick={() => handleUnassignGroup(group)} className="btn-danger" style={{fontSize:'12px',padding:'4px 10px'}}>Unassign</button>
                  </div>
                </div>

                {/* Student Table (expanded) */}
                {isExpanded && (
                  <div className="section-card-body p-0">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student Name</th>
                          <th>UID</th>
                          <th>Branch</th>
                          <th>Company</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((student, idx) => (
                          <tr key={student.uid}>
                            <td>{idx + 1}</td>
                            <td className="font-medium">{student.name}</td>
                            <td>{student.uid}</td>
                            <td><span className="badge badge-blue">{student.branch}</span></td>
                            <td>{student.company || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Group Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Edit Group</h2>
              <button onClick={handleCloseEditModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Group Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="form-input"
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label className="form-label">External Mentor (Industry)</label>
                <select
                  value={editFormData.externalMentor || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, externalMentor: e.target.value })}
                  className="form-select"
                >
                  <option value="">— No External Mentor —</option>
                  {availableExternalMentors.map((mentor) => (
                    <option key={mentor._id} value={mentor._id}>{mentor.name} ({mentor.company})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Internal Mentor (Faculty)</label>
                <select
                  value={editFormData.internalMentor || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, internalMentor: e.target.value })}
                  className="form-select"
                >
                  <option value="">— No Internal Mentor —</option>
                  {availableInternalMentors.map((mentor) => (
                    <option key={mentor._id} value={mentor._id}>{mentor.name} ({mentor.department || 'Faculty'})</option>
                  ))}
                </select>
              </div>
              {editingGroup && (
                <div className="alert-info">
                  <strong>Students in this group:</strong> {editingGroup.students?.length || 0}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={handleSaveGroupEdit} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleCloseEditModal} disabled={saving} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllGroups;