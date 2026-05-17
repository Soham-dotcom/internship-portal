import axios from 'axios';
import { clearAuthSession, getAuthToken } from '../auth/session';

const normalizeApiBaseUrl = (value) => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

const DEFAULT_API_BASE = 'http://localhost:5000/api';
const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_URL) || DEFAULT_API_BASE;
const API_TIMEOUT_MS = Number(process.env.REACT_APP_API_TIMEOUT_MS) || 20000;

if (process.env.NODE_ENV === 'production' && !process.env.REACT_APP_API_URL) {
  console.warn('[config] REACT_APP_API_URL is not set; using localhost fallback.');
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT_MS,
});

axiosInstance.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { axiosInstance };

// Auth endpoints
export const getAuthConfig = () => {
  return axiosInstance.get('/auth/config');
};

export const login = (payload) => {
  return axiosInstance.post('/auth/login', payload);
};

// Internships endpoints
export const getInternships = (filters = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    if (filters[key]) {
      params.append(key, filters[key]);
    }
  });
  return axiosInstance.get('/internships', { params });
};

export const getInternshipById = (id) => {
  return axiosInstance.get(`/internships/${id}`);
};

export const createInternship = (data) => {
  return axiosInstance.post('/internships', data);
};

export const updateInternship = (id, data) => {
  return axiosInstance.put(`/internships/${id}`, data);
};

export const deleteInternship = (id) => {
  return axiosInstance.delete(`/internships/${id}`);
};

// Upload endpoints
export const parseExcelFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post('/upload/excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const importInternships = (data) => {
  return axiosInstance.post('/upload/import', data);
};

// Evaluation Matrix upload endpoints
export const uploadMeetingAttendance = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post('/upload/evaluation/meeting-attendance', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadWeeklyReports = (file, weeks = 8) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('weeks', String(weeks));
  return axiosInstance.post('/upload/evaluation/weekly-reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadFinalReport = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post('/upload/evaluation/final-report', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadExternalMarks = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post('/upload/evaluation/external-marks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadExternalVivaMarks = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post('/upload/evaluation/external-viva-marks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadInternalVivaMarks = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post('/upload/evaluation/internal-viva-marks', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Analytics endpoints
export const getSummaryStats = () => {
  return axiosInstance.get('/internships/stats/summary');
};

export const getAnalyticsSummary = () => {
  return Promise.all([
    axiosInstance.get('/analytics/companies'),
    axiosInstance.get('/analytics/branches'),
    axiosInstance.get('/analytics/tech-distribution'),
  ]).then(([companies, branches, techDist]) => ({
    data: {
      success: true,
      data: {
        companies: companies.data.data,
        branches: branches.data.data,
        techDistribution: techDist.data.data,
      },
    },
  }));
};

export const getTechDistribution = () => {
  return axiosInstance.get('/analytics/tech-distribution');
};

export const getCompanyAnalytics = () => {
  return Promise.all([
    axiosInstance.get('/analytics/companies'),
    axiosInstance.get('/analytics/companies/branches'),
  ]).then(([companies, branches]) => ({
    data: {
      success: true,
      data: {
        companies: companies.data.data,
        branches: branches.data.data,
      },
    },
  }));
};

// Groups endpoints
export const generateGroups = (data) => {
  return axiosInstance.post('/groups/generate', data);
};

export const getGroups = () => {
  return axiosInstance.get('/groups');
};

export const getGroupById = (id) => {
  return axiosInstance.get(`/groups/${id}`);
};

// Mentor endpoints
export const updateMentorMetrics = (id, metrics) => {
  return axiosInstance.put(`/mentor/${id}/performance`, metrics);
};

export const addAttendance = (id, attendance) => {
  return axiosInstance.post(`/mentor/${id}/attendance`, attendance);
};

// Mentor directory management (manual add/edit)
export const listMentorDirectory = (type = 'external') => {
  return axiosInstance.get('/mentors', { params: { type } });
};

export const createMentor = (type, mentor) => {
  return axiosInstance.post('/mentors', { type, ...mentor });
};

export const updateMentor = (type, id, mentor) => {
  return axiosInstance.put(`/mentors/${id}`, { type, ...mentor });
};

// Download template
export const downloadTemplate = () => {
  const templateData = {
    columns: ['Email', 'Name', 'UID', 'Branch', 'Internship Type', 'Company Name', 'External Mentor Name', 'Start Date', 'End Date', 'Document Link', 'Status', 'Internship Title'],
    sample: ['student@spit.ac.in', 'John Doe', '2021300001', 'COMPS', 'Off-Campus', 'Google', 'Mentor Name', '2024-01-01', '2024-06-30', 'https://drive.google.com', 'pending', '50000', 'Software Engineer']
  };
  return Promise.resolve({ data: templateData });
};

// Export groups to Excel
export const exportGroups = (groups) => {
  return Promise.resolve({
    data: {
      success: true,
      message: 'Groups exported successfully'
    }
  });
};

// Import data from Excel
export const importData = (internships) => {
  return axiosInstance.post('/upload/import', { internships });
};

// External Mentor upload endpoints
export const importExternalMentors = (mentors) => {
  return axiosInstance.post('/upload/mentors', { mentors });
};

export const getExternalMentors = () => {
  return axiosInstance.get('/upload/mentors');
};

export const downloadExternalMentorTemplate = () => {
  return axiosInstance.get('/upload/external-mentor-template', {
    responseType: 'blob'
  });
};

// Internal Mentor upload endpoints
export const importInternalMentors = (mentors) => {
  return axiosInstance.post('/upload/internal-mentors', { mentors });
};

export const getInternalMentors = () => {
  return axiosInstance.get('/upload/internal-mentors');
};

export const downloadInternalMentorTemplate = () => {
  return axiosInstance.get('/upload/internal-mentor-template', {
    responseType: 'blob'
  });
};

// Legacy mentor endpoints (for backward compatibility)
export const importMentors = (mentors) => {
  return importExternalMentors(mentors);
};

export const getMentors = () => {
  return getExternalMentors();
};

export const downloadMentorTemplate = () => {
  return downloadExternalMentorTemplate();
};

// Health check
export const healthCheck = () => {
  return axiosInstance.get('/health');
};

// Weekly report viewer
export const getWeeklyReports = (weeks = 8) => {
  return axiosInstance.get('/internships/weekly-reports', { params: { weeks } });
};

// Evaluation overview
export const getEvaluationOverview = () => {
  return axiosInstance.get('/internships/evaluation-overview');
};

// Evaluation settings
export const getEvaluationSettings = () => {
  return axiosInstance.get('/evaluation-settings');
};

export const updateEvaluationSettings = (payload) => {
  return axiosInstance.put('/evaluation-settings', payload);
};

export default axiosInstance;
