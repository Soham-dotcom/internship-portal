import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default axiosInstance;
