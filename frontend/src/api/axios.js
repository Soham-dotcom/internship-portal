import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Internships
export const getInternships = (params) => API.get('/internships', { params });
export const getInternshipById = (id) => API.get(`/internships/${id}`);
export const createInternship = (data) => API.post('/internships', data);
export const updateInternship = (id, data) => API.put(`/internships/${id}`, data);
export const deleteInternship = (id) => API.delete(`/internships/${id}`);
export const getSummaryStats = () => API.get('/internships/stats/summary');

// Upload
export const uploadExcel = (formData) => 
  API.post('/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
export const importData = (data) => API.post('/upload/import', data);
export const downloadTemplate = () => 
  API.get('/upload/template', { responseType: 'blob' });

// Analytics
export const getCompanyAnalytics = () => API.get('/analytics/companies');
export const getBranchAnalytics = () => API.get('/analytics/branches');
export const getStatusAnalytics = () => API.get('/analytics/status');
export const getCompanyBranchAnalytics = () => API.get('/analytics/companies/branches');
export const getStipendAnalytics = () => API.get('/analytics/stipends');
export const getTypeAnalytics = () => API.get('/analytics/types');
export const getAnalyticsSummary = () => API.get('/analytics/summary');

// Groups
export const generateGroups = (data) => API.post('/groups/generate', data);
export const exportGroups = (data) => 
  API.post('/groups/export', data, { responseType: 'blob' });
export const randomPickStudents = (data) => API.post('/groups/random-pick', data);
export const exportRandomStudents = (data) => 
  API.post('/groups/export-random', data, { responseType: 'blob' });

export default API;





