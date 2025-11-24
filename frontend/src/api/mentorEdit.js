import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

export const getStudentByUID = (uid) => axios.get(`${API_BASE}/mentor-edit/${uid}`);

export const updateStudent = (uid, data) => axios.put(`${API_BASE}/mentor-edit/${uid}`, data);

export const deleteStudent = (uid) => axios.delete(`${API_BASE}/mentor-edit/${uid}`);

export const createStudent = (data) => axios.post(`${API_BASE}/mentor-edit`, data);

export const patchStudent = (uid, fields) => axios.patch(`${API_BASE}/mentor-edit/${uid}`, fields);




