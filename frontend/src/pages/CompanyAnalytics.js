import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getCompanyAnalytics,
  getCompanyBranchAnalytics,
  getStipendAnalytics,
  getTypeAnalytics,
} from '../api/axios';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CompanyAnalytics = () => {
  const [companyStats, setCompanyStats] = useState([]);
  const [companyBranchStats, setCompanyBranchStats] = useState([]);
  const [stipendStats, setStipendStats] = useState([]);
  const [typeStats, setTypeStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [companyRes, companyBranchRes, stipendRes, typeRes] = await Promise.all([
        getCompanyAnalytics(),
        getCompanyBranchAnalytics(),
        getStipendAnalytics(),
        getTypeAnalytics(),
      ]);

      if (companyRes.data.success) {
        setCompanyStats(companyRes.data.data);
      }
      if (companyBranchRes.data.success) {
        setCompanyBranchStats(companyBranchRes.data.data);
      }
      if (stipendRes.data.success) {
        setStipendStats(stipendRes.data.data);
      }
      if (typeRes.data.success) {
        setTypeStats(typeRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const topCompaniesData = companyStats.slice(0, 10).map((item) => ({
    name: item._id,
    students: item.count,
  }));

  const typeDistributionData = typeStats.map((item) => ({
    name: item._id,
    value: item.count,
  }));

  const stipendComparisonData = stipendStats.slice(0, 10).map((item) => ({
    company: item._id,
    avg: Math.round(item.avgStipend),
    min: Math.round(item.minStipend),
    max: Math.round(item.maxStipend),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Analytics</h1>
        <p className="mt-2 text-gray-600">
          Comprehensive analysis of company hiring patterns and trends
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 uppercase">
            Total Companies
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{companyStats.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 uppercase">
            Internship Types
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{typeStats.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 uppercase">
            Top Hiring Company
          </h3>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {companyStats[0]?._id || 'N/A'}
          </p>
          <p className="text-sm text-gray-500">
            {companyStats[0]?.count || 0} students
          </p>
        </div>
      </div>

      {/* Top Companies Hiring */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Top 10 Companies by Student Hiring
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topCompaniesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="students" fill="#3b82f6" name="Number of Students" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Internship Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Internship Category Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {typeDistributionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Type Stats Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Internship Types Breakdown
          </h2>
          <div className="space-y-3">
            {typeStats.map((type, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="font-medium text-gray-900">{type._id}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">
                    {type.count}
                  </span>
                  <p className="text-xs text-gray-500">
                    {type.companies.length} companies
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stipend Comparison */}
      {stipendStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Stipend Comparison (Top 10 Companies)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stipendComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="company" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="min" fill="#ef4444" name="Min Stipend" />
              <Bar dataKey="avg" fill="#3b82f6" name="Avg Stipend" />
              <Bar dataKey="max" fill="#10b981" name="Max Stipend" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Branch Distribution per Company */}
      {companyBranchStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Branch Distribution within Companies
          </h2>
          <div className="space-y-6">
            {companyBranchStats.slice(0, 10).map((company, index) => (
              <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {company._id}
                  </h3>
                  <span className="text-sm text-gray-600">
                    Total: {company.total} students
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {company.branches.map((branch, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {branch.branch.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-primary-600">
                        {branch.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Details Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Complete Company List
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Students Hired
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companyStats.map((company, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {company._id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {company.location || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-semibold bg-primary-100 text-primary-800 rounded-full">
                      {company.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompanyAnalytics;

