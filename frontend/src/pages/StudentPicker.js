import React, { useState } from 'react';
import { randomPick, exportRandom } from '../api/groups';

const branches = ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX'];
const statuses = ['pending', 'approved', 'in-progress', 'completed', 'cancelled'];

const StudentPicker = () => {
  const [filters, setFilters] = useState({
    branch: '',
    company: '',
    status: '',
    year: '',
  });
  const [count, setCount] = useState(1);
  const [pickedStudents, setPickedStudents] = useState([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

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
        setMessage({
          type: 'success',
          text: `Picked ${response.data.picked} student(s) from ${response.data.totalAvailable} unassigned students`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error picking students. Note: Only unassigned students can be picked.',
      });
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
      setMessage({ type: 'success', text: 'Students exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exporting students' });
    }
  };

  const resetFilters = () => {
    setFilters({
      branch: '',
      company: '',
      status: '',
      year: '',
    });
    setPickedStudents([]);
    setMessage({ type: '', text: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Random Student Picker</h1>
          <p className="mt-2 text-gray-600">
            Randomly select students based on filters
          </p>
        </div>
        {pickedStudents.length > 0 && (
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            📥 Export to Excel
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number to Pick
            </label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              min="1"
              placeholder="e.g., 5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-6 flex space-x-4">
          <button
            onClick={handlePickStudents}
            disabled={loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Picking...' : '🎲 Pick Random Students'}
          </button>
          <button
            onClick={resetFilters}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Reset
          </button>
        </div>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>⚠️ Important:</strong> Only students NOT already assigned to a group will be picked. 
            Students in existing groups are excluded automatically.
          </p>
        </div>
      </div>

      {/* Picked Students */}
      {pickedStudents.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Randomly Selected Students
          </h2>
          <p className="text-gray-600 mb-4">
            Selected {pickedStudents.length} out of {totalAvailable} available students
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pickedStudents.map((student, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {student.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{student.uid}</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold bg-primary-100 text-primary-800 rounded">
                      {student.branch}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium w-24">Email:</span>
                      <span className="text-gray-600">{student.email}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium w-24">Company:</span>
                      <span className="text-gray-600">{student.company}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium w-24">Type:</span>
                      <span className="text-gray-600">{student.internshipType}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium w-24">Title:</span>
                      <span className="text-gray-600">{student.internshipTitle}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium w-24">Status:</span>
                      <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                        {student.status}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium w-24">Mentor:</span>
                      <span className="text-gray-600">{student.mentor}</span>
                    </div>
                    {student.documentLink && (
                      <div className="flex items-center text-gray-700">
                        <span className="font-medium w-24">Document:</span>
                        <a href={student.documentLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View Document
                        </a>
                      </div>
                    )}
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📋 How to Use
        </h3>
        <ul className="space-y-2 text-blue-800">
          <li>• Set filters to narrow down the pool of students</li>
          <li>• Specify how many students you want to randomly select</li>
          <li>• Click "Pick Random Students" to select students randomly</li>
          <li>• Export the selected students to Excel for further processing</li>
          <li>• Use this for fair and random selection for events, presentations, or activities</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentPicker;

