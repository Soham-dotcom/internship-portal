import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

export const getAdvancedAnalytics = (filters) => {
  const params = new URLSearchParams();
  
  Object.keys(filters).forEach(key => {
    if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
      params.append(key, filters[key]);
    }
  });
  
  return axios.get(`${API_BASE}/advanced-analytics?${params.toString()}`);
};

export const getFilterOptions = () => axios.get(`${API_BASE}/advanced-analytics/filters`);

export const exportSingleGroup = (group) =>
  axios.post(`${API_BASE}/groups/export-single`, { group }, {
    responseType: 'blob'
  });




