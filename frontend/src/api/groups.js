import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

export const generateGroups = (data) => axios.post(`${API_BASE}/groups/generate`, data);

export const checkAssignment = (uids) => axios.post(`${API_BASE}/groups/check-assignment`, { uids });

export const unassignStudents = (uids) => axios.post(`${API_BASE}/groups/unassign`, { uids });

export const listGroups = () => axios.get(`${API_BASE}/groups/list`);

export const exportGroups = (groups) => 
  axios.post(`${API_BASE}/groups/export`, { groups }, {
    responseType: 'blob'
  });

export const randomPick = (data) => axios.post(`${API_BASE}/groups/random-pick`, data);

export const exportRandom = (students) =>
  axios.post(`${API_BASE}/groups/export-random`, { students }, {
    responseType: 'blob'
  });




