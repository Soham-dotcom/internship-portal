import React, { useState } from 'react';
import { 
  getStudentByUID, 
  updateStudent, 
  deleteStudent, 
  createStudent 
} from '../api/mentorEdit';

const MentorEdit = () => {
  const [searchUID, setSearchUID] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    uid: '',
    branch: '',
    internshipType: '',
    companyName: '',
    externalMentorName: '',
    startDate: '',
    endDate: '',
    documentLink: '',
    status: 'pending',
    stipend: '',
    companyLocation: '',
    internshipTitle: '',
    remarks: ''
  });

  const handleSearch = async () => {
    if (!searchUID.trim()) {
      setMessage({ type: 'error', text: 'Please enter a UID to search' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await getStudentByUID(searchUID);
      const data = response.data.data;
      
      setStudent(data);
      setFormData({
        email: data.email || '',
        name: data.name || '',
        uid: data.uid || '',
        branch: data.branch || '',
        internshipType: data.internshipType || '',
        companyName: data.companyName || '',
        externalMentorName: data.externalMentorName || '',
        startDate: data.startDate ? data.startDate.split('T')[0] : '',
        endDate: data.endDate ? data.endDate.split('T')[0] : '',
        documentLink: data.documentLink || '',
        status: data.status || 'pending',
        stipend: data.stipend || '',
        companyLocation: data.companyLocation || '',
        internshipTitle: data.internshipTitle || '',
        remarks: data.remarks || ''
      });
      setIsEditMode(true);
      setIsCreateMode(false);
      setMessage({ type: 'success', text: 'Student record found!' });
    } catch (error) {
      setStudent(null);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Student not found' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdate = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await updateStudent(student.uid, formData);
      setStudent(response.data.data);
      setMessage({ type: 'success', text: 'Student record updated successfully!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update record' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the record for ${student.name} (${student.uid})?`)) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await deleteStudent(student.uid);
      setMessage({ type: 'success', text: 'Student record deleted successfully!' });
      setStudent(null);
      setIsEditMode(false);
      setSearchUID('');
      resetForm();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to delete record' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.uid.trim()) {
      setMessage({ type: 'error', text: 'UID is required to create a new record' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await createStudent(formData);
      setStudent(response.data.data);
      setMessage({ type: 'success', text: 'Student record created successfully!' });
      setIsCreateMode(false);
      setIsEditMode(true);
      setSearchUID(formData.uid);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to create record' 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      uid: '',
      branch: '',
      internshipType: '',
      companyName: '',
      externalMentorName: '',
      startDate: '',
      endDate: '',
      documentLink: '',
      status: 'pending',
      stipend: '',
      companyLocation: '',
      internshipTitle: '',
      remarks: ''
    });
  };

  const handleNewRecord = () => {
    setIsCreateMode(true);
    setIsEditMode(false);
    setStudent(null);
    setSearchUID('');
    resetForm();
    setMessage({ type: '', text: '' });
  };

  const handleCancel = () => {
    setIsCreateMode(false);
    setIsEditMode(false);
    setStudent(null);
    setSearchUID('');
    resetForm();
    setMessage({ type: '', text: '' });
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Mentor Edit - Student Records</h1>

      {/* Message Display */}
      {message.text && (
        <div
          className={`p-4 rounded-lg mb-6 ${
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

      {/* Search Section */}
      {!isCreateMode && !isEditMode && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Search Student by UID</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={searchUID}
              onChange={(e) => setSearchUID(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter UID (e.g., 2021200044)"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={handleNewRecord}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + New Record
            </button>
          </div>
        </div>
      )}

      {/* Edit/Create Form */}
      {(isEditMode || isCreateMode) && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {isCreateMode ? 'Create New Student Record' : `Edit Student: ${student?.name || 'Unknown'}`}
            </h2>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium mb-1">UID *</label>
              <input
                type="text"
                name="uid"
                value={formData.uid}
                onChange={handleInputChange}
                disabled={isEditMode}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="2021200044"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Student Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="student@spit.ac.in"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Branch</label>
              <select
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Branch</option>
                <option value="COMPS">COMPS</option>
                <option value="IT">IT</option>
                <option value="EXTC">EXTC</option>
                <option value="ETRX">ETRX</option>
                <option value="CSE">CSE</option>
                <option value="MCA">MCA</option>
                <option value="AIML">AIML</option>
                <option value="MECH">MECH</option>
              </select>
            </div>

            {/* Internship Details */}
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Company Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Internship Type</label>
              <select
                name="internshipType"
                value={formData.internshipType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                <option value="Off-Campus">Off-Campus</option>
                <option value="On-Campus">On-Campus</option>
                <option value="College-Arranged">College-Arranged</option>
                <option value="Self-Arranged">Self-Arranged</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">External Mentor Name</label>
              <input
                type="text"
                name="externalMentorName"
                value={formData.externalMentorName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mentor Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Internship Title</label>
              <input
                type="text"
                name="internshipTitle"
                value={formData.internshipTitle}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Software Intern"
              />
            </div>

            {/* Dates */}
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Additional Info */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stipend</label>
              <input
                type="text"
                name="stipend"
                value={formData.stipend}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Company Location</label>
              <input
                type="text"
                name="companyLocation"
                value={formData.companyLocation}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mumbai"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Document Link</label>
              <input
                type="text"
                name="documentLink"
                value={formData.documentLink}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            {isEditMode && (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                >
                  Delete Record
                </button>
              </>
            )}
            {isCreateMode && (
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Record'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      {!isCreateMode && !isEditMode && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">📝 Mentor Edit Features:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Search for any student by UID</li>
            <li>• Edit any field instantly</li>
            <li>• Create new student records</li>
            <li>• Delete existing records</li>
            <li>• All changes save to database immediately</li>
            <li>• Empty fields are allowed</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MentorEdit;




