import axiosInstance from './axios';

// Generate groups with filters and settings
export const generateGroups = (data) => {
  return axiosInstance.post('/groups/generate', data);
};

// List all existing groups
export const listGroups = () => {
  return axiosInstance.get('/groups/list');
};

// Unassign students from groups
export const unassignStudents = (uids) => {
  return axiosInstance.post('/groups/unassign', { uids });
};

// Check if students are already assigned
export const checkAssignment = (uids) => {
  return axiosInstance.post('/groups/check-assignment', { uids });
};

// Export all groups to Excel
export const exportGroups = (groups) => {
  return axiosInstance.post('/groups/export', { groups }, {
    responseType: 'blob',
  });
};

// Export single group to Excel
export const exportSingleGroup = (group) => {
  return axiosInstance.post('/groups/export-single', { group }, {
    responseType: 'blob',
  });
};

// Random pick students
export const randomPick = (data) => {
  return axiosInstance.post('/groups/random-pick', data);
};

// Export random picked students
export const exportRandom = (students) => {
  return axiosInstance.post('/groups/export-random', { students }, {
    responseType: 'blob',
  });
};

// List all groups with mentor details
export const listGroupsWithMentors = () => {
  return axiosInstance.get('/groups/list-with-mentors');
};

// Allocate external mentors to all groups
export const allocateExternalMentorsToAll = () => {
  return axiosInstance.post('/groups/allocate-all-external');
};

// Allocate internal mentors to all groups
export const allocateInternalMentorsToAll = () => {
  return axiosInstance.post('/groups/allocate-all-internal');
};

// Allocate external mentor to a specific group
export const allocateExternalMentorToGroup = (groupId) => {
  return axiosInstance.post(`/groups/${groupId}/allocate-external-mentor`);
};

// Allocate internal mentor to a specific group
export const allocateInternalMentorToGroup = (groupId) => {
  return axiosInstance.post(`/groups/${groupId}/allocate-internal-mentor`);
};

// Search groups by student or mentor name
export const searchGroups = (query) => {
  return axiosInstance.get('/groups/search', {
    params: { query }
  });
};

// Sync mentor assignments (cleanup orphaned assignments)
export const syncMentors = () => {
  return axiosInstance.post('/groups/sync-mentors');
};

// Update group details
export const updateGroup = (groupId, data) => {
  return axiosInstance.put(`/groups/${groupId}`, data);
};

// Manually assign/change a mentor for a group (external by default; can pass mentorType)
export const assignMentorToGroup = (groupId, { mentorId, mentorType } = {}) => {
  return axiosInstance.put(`/groups/${groupId}/assign-mentor`, { mentorId, mentorType });
};

// Clear all groups
export const clearAllGroups = () => {
  return axiosInstance.post('/groups/clear-all');
};

// Send mail to a group's mentor with an Excel attachment
export const sendGroupMail = (groupId, payload = undefined) => {
  return axiosInstance.post(`/send-mail/${groupId}`, payload);
};

export default axiosInstance;

