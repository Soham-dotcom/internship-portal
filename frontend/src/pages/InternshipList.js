import React, { useState, useEffect } from 'react';
import { getInternships, createInternship } from '../api/axios';
import * as XLSX from 'xlsx';

const branches = ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX'];

const InternshipList = () => {
  const [internships, setInternships] = useState([]);
  const [filteredInternships, setFilteredInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    branch: '',
    company: '',
    mentor: '',
    year: '',
    type: '',
  });
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    uid: '',
    branch: '',
    phone: '',
    gender: '',
    companyName: '',
    companyLocation: '',
    externalMentorName: '',
    internshipType: 'Off-Campus',
    internshipTitle: '',
    startDate: '',
    endDate: '',
    duration: '',
    stipend: '',
    ctc: '',
    placementOffer: '',
    documentLink: '',
    remarks: '',
  });

  useEffect(() => {
    fetchInternships();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, internships]);

  const fetchInternships = async () => {
    try {
      const response = await getInternships();
      if (response.data.success) {
        setInternships(response.data.data);
        setFilteredInternships(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching internships:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...internships];

    if (filters.branch) {
      filtered = filtered.filter((i) =>
        (i.branch || '').toLowerCase() === filters.branch.toLowerCase()
      );
    }
    if (filters.company) {
      filtered = filtered.filter((i) =>
        (i.companyName || '').toLowerCase().includes(filters.company.toLowerCase())
      );
    }

    if (filters.mentor) {
      filtered = filtered.filter((i) =>
        (i.externalMentorName || '').toLowerCase().includes(filters.mentor.toLowerCase())
      );
    }
    if (filters.year) {
      filtered = filtered.filter((i) => (i.uid || '').startsWith(filters.year));
    }
    if (filters.type) {
      filtered = filtered.filter((i) =>
        (i.internshipType || '').toLowerCase().includes(filters.type.toLowerCase())
      );
    }

    setFilteredInternships(filtered);
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const resetFilters = () => {
    setFilters({
      branch: '',
      company: '',
      mentor: '',
      year: '',
      type: '',
    });
  };

  const exportToExcel = () => {
    const data = filteredInternships.map((item, index) => ({
      'Sr. No': index + 1,
      'Name': item.name,
      'Email': item.email,
      'UID': item.uid,
      'Branch': item.branch,
      'Company Name': item.companyName,
      'Company Location': item.companyLocation || '',
      'Internship Type': item.internshipType,
      'Internship Title': item.internshipTitle || '',
      'Start Date': new Date(item.startDate).toLocaleDateString(),
      'End Date': new Date(item.endDate).toLocaleDateString(),
      'Status': item.status,
      'External Mentor': item.externalMentorName,
      'Document Link': item.documentLink || '',
      'Submitted At': new Date(item.submittedAt).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Internships');
    XLSX.writeFile(wb, `internships_${new Date().toISOString().split('T')[0]}.xlsx`);
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading internships...</p>
        </div>
      </div>
    );
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!formData.uid || !formData.name) {
      setMessage({ type: 'error', text: 'UID and Name are required' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await createInternship(formData);
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Student added successfully!' });
        setFormData({
          name: '',
          email: '',
          uid: '',
          branch: '',
          phone: '',
          gender: '',
          companyName: '',
          companyLocation: '',
          externalMentorName: '',
          internshipType: 'Off-Campus',
          internshipTitle: '',
          startDate: '',
          endDate: '',
          duration: '',
          stipend: '',
          ctc: '',
          placementOffer: '',
          documentLink: '',
          remarks: '',
        });
        setTimeout(() => {
          setShowModal(false);
          setMessage({ type: '', text: '' });
          fetchInternships(); // Refresh the list
        }, 1500);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error adding student: ' + error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Student Internship Records</h1>
          <p className="page-subtitle">
            {filteredInternships.length} of {internships.length} records displayed
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary">
            Export to Excel
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Add Internship Record
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-title">Filter Records</h2>
        </div>
        <div className="section-card-body">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Branch</label>
              <select name="branch" value={filters.branch} onChange={handleFilterChange} className="form-select">
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Company Name</label>
              <input type="text" name="company" value={filters.company} onChange={handleFilterChange} placeholder="Filter by company" className="form-input" />
            </div>
            <div>
              <label className="form-label">External Evaluator</label>
              <input type="text" name="mentor" value={filters.mentor} onChange={handleFilterChange} placeholder="Filter by evaluator" className="form-input" />
            </div>
            <div>
              <label className="form-label">Year (UID prefix)</label>
              <input type="text" name="year" value={filters.year} onChange={handleFilterChange} placeholder="e.g. 2024" className="form-input" />
            </div>
            <div>
              <label className="form-label">Placement Type</label>
              <input type="text" name="type" value={filters.type} onChange={handleFilterChange} placeholder="e.g. Off-Campus" className="form-input" />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={resetFilters} className="btn-secondary text-xs">Clear All Filters</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="section-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>UID</th>
                <th>Branch</th>
                <th>Company</th>
                <th>Role / Type</th>
                <th>Duration</th>
                <th>External Mentor</th>
              </tr>
            </thead>
            <tbody>
              {filteredInternships.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.email}</div>
                  </td>
                  <td className="font-mono text-xs text-gray-600">{item.uid}</td>
                  <td><span className="badge badge-blue">{item.branch}</span></td>
                  <td>
                    <div className="text-gray-900">{item.companyName}</div>
                    {item.companyLocation && <div className="text-xs text-gray-400">{item.companyLocation}</div>}
                  </td>
                  <td>
                    <div className="text-gray-900">{item.internshipTitle || 'Intern'}</div>
                    <div className="text-xs text-gray-400">{item.internshipType}</div>
                  </td>
                  <td className="tabular-nums">
                    {item.startDate && item.endDate
                      ? `${Math.max(1, Math.ceil((new Date(item.endDate) - new Date(item.startDate)) / (1000 * 60 * 60 * 24 * 30)))} mo.`
                      : '—'}
                  </td>
                  <td className="text-gray-600">{item.externalMentorName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInternships.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-500">
            No records found matching the applied filters.
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Add New Student Record</h2>
              <button
                onClick={() => { setShowModal(false); setMessage({ type: '', text: '' }); }}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {message.text && (
              <div className={`mx-6 mt-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleAddStudent} className="p-6 overflow-y-auto space-y-4">
              <fieldset>
                <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1 w-full">Student Information</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" name="name" value={formData.name} onChange={handleFormChange} required className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">UID <span className="text-red-500">*</span></label>
                    <input type="text" name="uid" value={formData.uid} onChange={handleFormChange} required className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Institutional Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Phone Number</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Branch</label>
                    <select name="branch" value={formData.branch} onChange={handleFormChange} className="form-select">
                      <option value="">Select Branch</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleFormChange} className="form-select">
                      <option value="">Select</option>
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1 w-full">Internship Details</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Company Name</label>
                    <input type="text" name="companyName" value={formData.companyName} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Company Location</label>
                    <input type="text" name="companyLocation" value={formData.companyLocation} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Internship Type</label>
                    <select name="internshipType" value={formData.internshipType} onChange={handleFormChange} className="form-select">
                      <option value="Off-Campus">Off-Campus</option>
                      <option value="On-Campus">On-Campus</option>
                      <option value="College-Arranged">College-Arranged</option>
                      <option value="Self-Arranged">Self-Arranged</option>
                      <option value="8th Sem">8th Sem</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Role / Internship Title</label>
                    <input type="text" name="internshipTitle" value={formData.internshipTitle} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">External Mentor Name</label>
                    <input type="text" name="externalMentorName" value={formData.externalMentorName} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Duration (months)</label>
                    <input type="number" name="duration" value={formData.duration} onChange={handleFormChange} min="0" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Start Date</label>
                    <input type="date" name="startDate" value={formData.startDate} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">End Date</label>
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleFormChange} className="form-input" />
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1 w-full">Compensation &amp; Placement</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Monthly Stipend (INR)</label>
                    <input type="text" name="stipend" value={formData.stipend} onChange={handleFormChange} placeholder="e.g. 25000" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">CTC (LPA)</label>
                    <input type="text" name="ctc" value={formData.ctc} onChange={handleFormChange} placeholder="e.g. 12.00" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Placement Offer</label>
                    <input type="text" name="placementOffer" value={formData.placementOffer} onChange={handleFormChange} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Document / Offer Letter Link</label>
                    <input type="url" name="documentLink" value={formData.documentLink} onChange={handleFormChange} placeholder="https://" className="form-input" />
                  </div>
                </div>
              </fieldset>

              <div>
                <label className="form-label">Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleFormChange} rows={3} className="form-input resize-none" placeholder="Additional notes for this record" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                  {submitting ? 'Saving...' : 'Save Record'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setMessage({ type: '', text: '' }); }} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternshipList;
