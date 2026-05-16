import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getSummaryStats, getAnalyticsSummary } from '../api/axios';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCompanies: 0,
    totalOffers: 0,
    branchWiseCount: [],
  });
  const [analytics, setAnalytics] = useState({
    companies: [],
    techDistribution: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        getSummaryStats(),
        getAnalyticsSummary(),
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const branchChartData = stats.branchWiseCount.map((item) => ({
    branch: item._id,
    students: item.count,
  }));

  const companyChartData = analytics.companies.slice(0, 10).map((item) => ({
    company: item._id,
    students: item.count,
  }));

  const totalWithProfile =
    (analytics.techDistribution?.tech ?? 0) +
    (analytics.techDistribution?.nonTech ?? 0);

  const techPct =
    totalWithProfile > 0
      ? `${((analytics.techDistribution.tech / totalWithProfile) * 100).toFixed(1)}% of profiled`
      : null;

  const nonTechPct =
    totalWithProfile > 0
      ? `${((analytics.techDistribution.nonTech / totalWithProfile) * 100).toFixed(1)}% of profiled`
      : null;


  const techNonTechData = [
    { category: 'Tech Roles', count: analytics.techDistribution?.tech ?? 0 },
    { category: 'Non-Tech Roles', count: analytics.techDistribution?.nonTech ?? 0 },
  ];

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Institutional internship overview and placement insights
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total Placement Offers" value={stats.totalOffers || stats.totalStudents} accent="border-blue-600" />
        <Card title="Participating Companies" value={stats.totalCompanies} accent="border-slate-500" />
        <Card title="Technical Placements" value={analytics.techDistribution?.tech ?? 0} subtitle={techPct} accent="border-blue-500" />
        <Card title="Non-Technical Placements" value={analytics.techDistribution?.nonTech ?? 0} subtitle={nonTechPct} accent="border-amber-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch-wise distribution */}
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Branch-wise Student Distribution</h2>
            <p className="text-xs text-gray-500 mt-0.5">{stats.totalStudents} students across all departments</p>
          </div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={branchChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="branch"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#D1D5DB' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Students', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#9CA3AF' } }}
                />
                <Tooltip
                  contentStyle={{ border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 13 }}
                  formatter={(v) => [`${v} students`, 'Count']}
                />
                <Bar dataKey="students" fill="#2563EB" radius={[2, 2, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tech vs Non-Tech */}
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Technical vs. Non-Technical Placements</h2>
            <p className="text-xs text-gray-500 mt-0.5">{totalWithProfile} students with role classification</p>
          </div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={techNonTechData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 13, fill: '#374151' }}
                  axisLine={{ stroke: '#D1D5DB' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Students', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#9CA3AF' } }}
                />
                <Tooltip
                  contentStyle={{ border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 13 }}
                  formatter={(v) => [`${v} students`, 'Count']}
                />
                <Bar dataKey="count" maxBarSize={80} radius={[2, 2, 0, 0]} fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 10 companies */}
      {companyChartData.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-title">Top Recruiting Organizations</h2>
            <p className="text-xs text-gray-500 mt-0.5">Top 10 by number of student placements</p>
          </div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={companyChartData}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#D1D5DB' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  width={160}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 13 }}
                  formatter={(v) => [`${v} students`, 'Count']}
                />
                <Bar
                  dataKey="students"
                  fill="#2563EB"
                  radius={[0, 2, 2, 0]}
                  maxBarSize={24}
                  label={{ position: 'right', fontSize: 12, fill: '#374151' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;