import axiosInstance from './groups';

// Global draft
export const getMailDraft = () => axiosInstance.get('/mail-draft');
export const saveMailDraft = (data) => axiosInstance.post('/mail-draft', data);

// Sender emails
export const listSenderEmails = () => axiosInstance.get('/sender-emails');
export const addSenderEmail = (data) => axiosInstance.post('/sender-emails', data);
