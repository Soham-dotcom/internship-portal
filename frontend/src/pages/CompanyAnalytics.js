import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../api/axios';

const CompanyAnalytics = () => {
  const [companies, setCompanies]             = useState([]);
  const [branches, setBranches]               = useState([]);
  const [mentors, setMentors]                 = useState([]);
  const [companyBranches, setCompanyBranches] = useState([]);
  const [types, setTypes]                     = useState([]);
  const [techDistribution, setTechDistribution] = useState(null);
  const [techPositions, setTechPositions]     = useState([]);
  const [nonTechPositions, setNonTechPositions] = useState([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResults, setSearchResults]     = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [currentPage, setCurrentPage]         = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [companiesRes, branchesRes, mentorsRes, companyBranchesRes,
             typesRes, techDistRes, techPosRes, nonTechPosRes] = await Promise.all([
        api.get('/analytics/companies'),
        api.get('/analytics/branches'),
        api.get('/analytics/mentors'),
        api.get('/analytics/companies/branches'),
        api.get('/analytics/types'),
        api.get('/analytics/tech-distribution'),
        api.get('/analytics/positions/tech'),
        api.get('/analytics/positions/non-tech'),
      ]);
      if (companiesRes.data.success)      setCompanies(companiesRes.data.data.slice(0, 10));
      if (branchesRes.data.success)       setBranches(branchesRes.data.data);
      if (mentorsRes.data.success)        setMentors(mentorsRes.data.data);
      if (companyBranchesRes.data.success) setCompanyBranches(companyBranchesRes.data.data);
      if (typesRes.data.success)          setTypes(typesRes.data.data);
      if (techDistRes.data.success) {
        const d = techDistRes.data.data;
        setTechDistribution([
          { category: 'Tech', count: d.tech },
          { category: 'Non-Tech', count: d.nonTech },
        ]);
      }
      if (techPosRes.data.success)    setTechPositions(techPosRes.data.data.slice(0, 10));
      if (nonTechPosRes.data.success) setNonTechPositions(nonTechPosRes.data.data.slice(0, 10));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const response = await api.get(`/analytics/companies/search?name=${query}`);
      if (response.data.success) setSearchResults(response.data.data);
    } catch (error) { console.error('Search error:', error); }
  };

  const handleSelectCompany = async (companyName) => {
    try {
      const response = await api.get(`/analytics/companies/details/${companyName}`);
      if (response.data.success) {
        setSelectedCompany(response.data.data);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) { console.error('Error fetching company details:', error); }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  const topCompany = companies[0];
  const totalWithProfile = techDistribution ? techDistribution.reduce((s, d) => s + d.count, 0) : 0;
  const paginatedCompanyBranches = companyBranches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(companyBranches.length / itemsPerPage);

  const chartTooltip = { contentStyle: { border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 13 } };
  const chartYAxis  = { axisLine: false, tickLine: false, tick: { fontSize: 12, fill: '#6B7280' } };
  const chartXAxis  = { axisLine: { stroke: '#D1D5DB' }, tickLine: false, tick: { fontSize: 12, fill: '#6B7280' } };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Company-wise Analysis</h1>
        <p className="page-subtitle">Hiring patterns, branch distribution, and role breakdown across all companies</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card border-l-4 border-blue-600">
          <p className="stat-label">Companies (Top 10)</p>
          <p className="stat-value">{companies.length}</p>
        </div>
        <div className="stat-card border-l-4 border-slate-500">
          <p className="stat-label">Internship Types</p>
          <p className="stat-value">{types.length}</p>
        </div>
        <div className="stat-card border-l-4 border-blue-500">
          <p className="stat-label">Top Hiring Company</p>
          <p className="text-lg font-bold text-gray-900 mt-1 leading-tight">{topCompany?._id || '—'}</p>
          <p className="stat-secondary">{topCompany?.count ?? 0} students</p>
        </div>
        <div className="stat-card border-l-4 border-amber-500">
          <p className="stat-label">Students with Role Data</p>
          <p className="stat-value">{totalWithProfile}</p>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h2 className="section-title">Company Detail Lookup</h2>
          <p className="text-xs text-gray-500 mt-0.5">Search for a company to view its student list, roles, and branch breakdown</p>
        </div>
        <div className="section-card-body">
          <div className="relative max-w-md">
            <label className="form-label">Company Name</label>
            <input type="text" placeholder="Type to search..." value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)} className="form-input" />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-lg mt-1 max-h-60 overflow-y-auto">
                {searchResults.map((company, idx) => (
                  <button key={idx} onClick={() => handleSelectCompany(company._id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                    <div className="text-sm font-medium text-gray-900">{company._id}</div>
                    <div className="text-xs text-gray-500">{company.location} — {company.count} student(s)</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCompany && (
            <div className="mt-6 border border-gray-200 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedCompany.details.companyName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedCompany.details.companyLocation}</p>
                </div>
                <button onClick={() => setSelectedCompany(null)}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1">
                  Dismiss
                </button>
              </div>
              <div className="grid grid-cols-3 border-b border-gray-200">
                {[
                  { label: 'Total Students', value: selectedCompany.details.totalStudents },
                  { label: 'Distinct Roles', value: selectedCompany.roles.length },
                  { label: 'Status Types', value: selectedCompany.status.length },
                ].map((kpi) => (
                  <div key={kpi.label} className="px-5 py-4 border-r border-gray-200 last:border-r-0">
                    <p className="stat-label">{kpi.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Student Name</th><th>UID</th><th>Branch</th><th>Role</th></tr>
                  </thead>
                  <tbody>
                    {selectedCompany.students.map((student, idx) => (
                      <tr key={idx}>
                        <td className="text-gray-400 tabular-nums">{idx + 1}</td>
                        <td className="font-medium text-gray-900">{student.name}</td>
                        <td className="font-mono text-xs text-gray-600">{student.uid}</td>
                        <td><span className="badge badge-blue">{student.branch}</span></td>
                        <td className="text-gray-600">{student.internshipTitle || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Top 10 Companies by Hiring</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ranked by total students placed</p>
          </div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={companies.map(c => ({ company: c._id, students: c.count }))}
                layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" {...chartXAxis} />
                <YAxis type="category" dataKey="company" width={140} {...chartYAxis} />
                <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                <Bar dataKey="students" fill="#2563EB" radius={[0,2,2,0]} maxBarSize={20}
                  label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Branch-wise Student Count</h2>
            <p className="text-xs text-gray-500 mt-0.5">Distribution across all branches</p>
          </div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branches.map(b => ({ branch: b._id, students: b.count }))}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="branch" {...chartXAxis} />
                <YAxis {...chartYAxis} label={{ value: 'Students', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#9CA3AF' } }} />
                <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                <Bar dataKey="students" fill="#1D4ED8" radius={[2,2,0,0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {techDistribution && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-title">Tech vs. Non-Tech Role Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">{totalWithProfile} students with role classification</p>
            </div>
            <div className="section-card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={techDistribution} margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="category" {...chartXAxis} tick={{ fontSize: 13, fill: '#374151' }} />
                  <YAxis {...chartYAxis} label={{ value: 'Students', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#9CA3AF' } }} />
                  <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                  <Bar dataKey="count" maxBarSize={80} radius={[2,2,0,0]} fill="#2563EB"
                    label={{ position: 'top', fontSize: 13, fill: '#374151', fontWeight: 600 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {types.length > 0 && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-title">Internship Type Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">Breakdown by internship category</p>
            </div>
            <div className="section-card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={types.map(t => ({ type: t._id, count: t.count }))}
                  layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" {...chartXAxis} />
                  <YAxis type="category" dataKey="type" width={140} {...chartYAxis} />
                  <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                  <Bar dataKey="count" fill="#1D4ED8" radius={[0,2,2,0]} maxBarSize={24}
                    label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {techPositions.length > 0 && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-title">Top Tech Roles</h2>
              <p className="text-xs text-gray-500 mt-0.5">Most common technical internship titles</p>
            </div>
            <div className="section-card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={techPositions.map(p => ({ role: p._id, count: p.count }))}
                  layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" {...chartXAxis} />
                  <YAxis type="category" dataKey="role" width={160} {...chartYAxis} />
                  <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                  <Bar dataKey="count" fill="#2563EB" radius={[0,2,2,0]} maxBarSize={20}
                    label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {nonTechPositions.length > 0 && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="section-title">Top Non-Tech Roles</h2>
              <p className="text-xs text-gray-500 mt-0.5">Most common non-technical internship titles</p>
            </div>
            <div className="section-card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nonTechPositions.map(p => ({ role: p._id, count: p.count }))}
                  layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" {...chartXAxis} />
                  <YAxis type="category" dataKey="role" width={160} {...chartYAxis} />
                  <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                  <Bar dataKey="count" fill="#D97706" radius={[0,2,2,0]} maxBarSize={20}
                    label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {mentors.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Mentor-wise Student Distribution</h2>
            <p className="text-xs text-gray-500 mt-0.5">Top 10 external mentors by assigned student count</p>
          </div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mentors.slice(0, 10).map(m => ({ mentor: m._id, students: m.count }))}
                layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" {...chartXAxis} />
                <YAxis type="category" dataKey="mentor" width={160} {...chartYAxis} />
                <Tooltip {...chartTooltip} formatter={v => [`${v}`, 'Students']} />
                <Bar dataKey="students" fill="#1D4ED8" radius={[0,2,2,0]} maxBarSize={20}
                  label={{ position: 'right', fontSize: 11, fill: '#374151' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {companyBranches.length > 0 && (
        <div className="section-card overflow-hidden">
          <div className="section-card-header flex items-center justify-between">
            <div>
              <h2 className="section-title">Company-wise Branch Distribution</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, companyBranches.length)} of {companyBranches.length} companies
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th className="w-8">#</th><th>Company</th><th>Branch Breakdown</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {paginatedCompanyBranches.map((company, idx) => (
                  <tr key={idx}>
                    <td className="text-gray-400 tabular-nums">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                    <td className="font-medium text-gray-900">{company._id}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {company.branches.map((b, i) => (
                          <span key={i} className="badge badge-blue">{b.branch}: {b.count}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right font-semibold tabular-nums text-gray-900">{company.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Previous</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyAnalytics;