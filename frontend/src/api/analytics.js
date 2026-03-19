import api from './axios';

export const getStats = () => api.get('/analytics/summary');
export const searchCompanies = (name) => api.get(`/analytics/companies/search?name=${name}`);
export const getCompanyDetails = (name) => api.get(`/analytics/companies/details/${name}`);
export const getCompanyBranchStats = () => api.get('/analytics/companies/branches');
