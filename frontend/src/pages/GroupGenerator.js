import React, { useState } from 'react';
import { exportGroups as exportGroupsOld } from '../api/axios';
import { generateGroups, listGroups, unassignStudents } from '../api/groups';
import { exportSingleGroup } from '../api/advancedAnalytics';

const branches = ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX'];
const statuses = ['pending', 'approved', 'in-progress', 'completed', 'cancelled'];

const GroupGenerator = () => {
  const [filters, setFilters] = useState({
    branch: '',
    company: '',
    status: '',
    year: '',
  });
  const [groupSettings, setGroupSettings] = useState({
    groupSize: 5,
    numGroups: '',
    randomize: true,
    assignToGroups: false, // NEW: Whether to save groups to DB
  });
  const [groups, setGroups] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [existingGroups, setExistingGroups] = useState([]);

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const handleSettingChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setGroupSettings({
      ...groupSettings,
      [e.target.name]: value,
    });
  };

  const handleGenerateGroups = async () => {
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
        groupSize: parseInt(groupSettings.groupSize) || 5,
        numGroups: groupSettings.numGroups ? parseInt(groupSettings.numGroups) : null,
        randomize: groupSettings.randomize,
        assignToGroups: groupSettings.assignToGroups,
      };

      const response = await generateGroups(payload);

      if (response.data.success) {
        setGroups(response.data.data.groups);
        setTotalStudents(response.data.data.totalStudents);
        
        let messageText = `Generated ${response.data.data.totalGroups} groups with ${response.data.data.totalStudents} students`;
        
        if (response.data.data.assigned) {
          messageText += '\n✅ Groups have been saved and students assigned!';
        } else {
          messageText += '\n⚠️ Preview only - not saved to database';
        }
        
        setMessage({
          type: 'success',
          text: messageText,
        });
        
        // Refresh existing groups if assigned
        if (response.data.data.assigned) {
          fetchExistingGroups();
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error generating groups. Note: Only unassigned students can be added to groups.',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingGroups = async () => {
    try {
      const response = await listGroups();
      if (response.data.success) {
        setExistingGroups(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching existing groups:', error);
    }
  };

  const handleUnassignGroup = async (groupId) => {
    const group = existingGroups.find(g => g._id === groupId);
    if (!group) return;
    
    if (!window.confirm(`Unassign all ${group.studentCount} students from ${group.groupName}?`)) {
      return;
    }
    
    try {
      const uids = group.students.map(s => s.uid);
      const response = await unassignStudents(uids);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        fetchExistingGroups();
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error unassigning students' 
      });
    }
  };

  // Load existing groups on mount
  React.useEffect(() => {
    fetchExistingGroups();
  }, []);

  const handleExportGroups = async () => {
    try {
      const response = await exportGroupsOld({ groups });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `student_groups_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage({ type: 'success', text: 'Groups exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exporting groups' });
    }
  };

  const handleExportSingleGroup = async (group) => {
    try {
      const response = await exportSingleGroup(group);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${group.groupName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage({ type: 'success', text: `${group.groupName} exported successfully!` });
    } catch (error) {
      setMessage({ type: 'error', text: `Error exporting ${group.groupName}` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Group Generator</h1>
          <p className="mt-2 text-gray-600">
            Generate student groups based on filters and preferences
          </p>
        </div>
        {groups.length > 0 && (
          <button
            onClick={handleExportGroups}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            📥 Export Groups to Excel
          </button>
        )}
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : message.type === 'warning'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.text}</div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              name="branch"
              value={filters.branch}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <input
              type="text"
              name="company"
              value={filters.company}
              onChange={handleFilterChange}
              placeholder="Search company..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <input
              type="text"
              name="year"
              value={filters.year}
              onChange={handleFilterChange}
              placeholder="e.g., 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Group Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Group Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Size
            </label>
            <input
              type="number"
              name="groupSize"
              value={groupSettings.groupSize}
              onChange={handleSettingChange}
              min="1"
              placeholder="e.g., 5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number of students per group
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Groups (Optional)
            </label>
            <input
              type="number"
              name="numGroups"
              value={groupSettings.numGroups}
              onChange={handleSettingChange}
              min="1"
              placeholder="Leave empty to use group size"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Overrides group size if specified
            </p>
          </div>

          <div className="flex flex-col space-y-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="randomize"
                checked={groupSettings.randomize}
                onChange={handleSettingChange}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Randomize Students
              </span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="assignToGroups"
                checked={groupSettings.assignToGroups}
                onChange={handleSettingChange}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">
                💾 Assign to Database
              </span>
            </label>
            <p className="text-xs text-gray-500">
              If checked, groups will be saved and students marked as assigned
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleGenerateGroups}
            disabled={loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : '🎲 Generate Groups'}
          </button>
        </div>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>⚠️ Important:</strong> Only students NOT already assigned to a group will be included. 
            Students already in a group will be excluded automatically.
          </p>
        </div>
      </div>
      
      {/* Existing Groups */}
      {existingGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📋 Existing Groups ({existingGroups.length})
          </h2>
          <div className="space-y-3">
            {existingGroups.map((group) => (
              <div key={group._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-900">{group.groupName}</h3>
                  <p className="text-sm text-gray-600">
                    {group.studentCount} student{group.studentCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleUnassignGroup(group._id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                >
                  Unassign All
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Groups */}
      {groups.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Generated Groups
            </h2>
            <p className="text-gray-600 mb-4">
              {groups.length} groups with {totalStudents} total students
            </p>
          </div>

          {groups.map((group) => (
            <div key={group.groupNumber} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Group {group.groupNumber} ({group.students.length} students)
                </h3>
                <button
                  onClick={() => handleExportSingleGroup(group)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  📥 Export Group
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        UID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Branch
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Company
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {group.students.map((student, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.uid}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.branch}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.company}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {student.internshipType}
                        </td>
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

