import React, { useState, useEffect } from 'react';
import { 
  listGroupsWithMentors, 
  exportGroups, 
  unassignStudents,
  allocateExternalMentorsToAll,
  allocateInternalMentorsToAll,
  allocateExternalMentorToGroup,
  allocateInternalMentorToGroup,
  searchGroups,
  syncMentors,
  updateGroup,
  assignMentorToGroup,
  clearAllGroups,
  sendGroupMail
} from '../api/groups';
import { axiosInstance } from '../api/axios';
import * as XLSX from 'xlsx';
import { getMailDraft, saveMailDraft, listSenderEmails, addSenderEmail } from '../api/mail';

const AllGroups = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    students: [],
    externalMentor: '',
    internalMentor: ''
  });
  const [availableExternalMentors, setAvailableExternalMentors] = useState([]);
  const [availableInternalMentors, setAvailableInternalMentors] = useState([]);
  const [saving, setSaving] = useState(false);

  const [sendingMailByGroupId, setSendingMailByGroupId] = useState({});

  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftForm, setDraftForm] = useState({ subject: '', body: '' });
  const [draftModalError, setDraftModalError] = useState('');

  const [sendMailModalOpen, setSendMailModalOpen] = useState(false);
  const [sendMailModalError, setSendMailModalError] = useState('');
  const [mailGroup, setMailGroup] = useState(null);
  const [mailRecipientType, setMailRecipientType] = useState('external');
  const [senderEmails, setSenderEmails] = useState([]);
  const [selectedSenderEmailId, setSelectedSenderEmailId] = useState('');
  const [loadingSenderEmails, setLoadingSenderEmails] = useState(false);
  const [addingSender, setAddingSender] = useState(false);
  const [newSenderForm, setNewSenderForm] = useState({ email: '', password: '' });
  const [addingSenderSaving, setAddingSenderSaving] = useState(false);

  const [assignMentorModalOpen, setAssignMentorModalOpen] = useState(false);
  const [assigningGroup, setAssigningGroup] = useState(null);
  const [assignMentorType, setAssignMentorType] = useState('external');
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [assigningMentorByGroupId, setAssigningMentorByGroupId] = useState({});

  useEffect(() => { fetchGroups(); }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groups);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await searchGroups(searchQuery);
        if (response.data.success) {
          setFilteredGroups(response.data.data);
          setMessage({ type: 'info', text: `Found ${response.data.count} groups matching "${searchQuery}"` });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Error searching groups' });
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, groups]);

  const fetchGroups = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await listGroupsWithMentors();
      if (response.data.success) {
        setGroups(response.data.data);
        setFilteredGroups(response.data.data);
        setMessage({ type: 'success', text: `Loaded ${response.data.count} groups` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error loading groups' });
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) { newExpanded.delete(groupId); } else { newExpanded.add(groupId); }
    setExpandedGroups(newExpanded);
  };

  const handleExportAll = async () => {
    try {
      if (!groups || groups.length === 0) { setMessage({ type: 'error', text: 'No groups to export' }); return; }
      const formattedGroups = groups.map(group => ({
        _id: group._id, groupId: group._id, groupName: group.groupName,
        groupNumber: parseInt(group.groupName.replace('Group ', '')) || 0, students: group.students
      }));
      const response = await exportGroups(formattedGroups);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `all_student_groups_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'All groups exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error exporting groups' });
    }
  };

  const handleExportSingleGroup = (group) => {
    try {
      const wb = XLSX.utils.book_new();
      const exportData = group.students.map((student, idx) => ({
        'S.No': idx + 1, 'Student Name': student.name, 'UID': student.uid,
        'Institutional Email': student.email || '', 'Branch': student.branch,
        'Company': student.company || '',
        'External Evaluator': group.externalMentor?.name || 'Not Assigned',
        'Internal Examiner': group.internalMentor?.name || 'Not Assigned',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, group.groupName || 'Group');
      XLSX.writeFile(wb, `${group.groupName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setMessage({ type: 'success', text: `${group.groupName} exported successfully!` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error exporting group' });
    }
  };

  const handleUnassignGroup = async (group) => {
    if (!window.confirm(`Unassign all ${group.studentCount} students from ${group.groupName}?`)) return;
    try {
      const uids = group.students.map(s => s.uid);
      const response = await unassignStudents(uids);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error unassigning students' });
    }
  };

  const handleUnassignAllGroups = async () => {
    const totalStudents = groups.reduce((sum, g) => sum + g.studentCount, 0);
    if (!window.confirm(`WARNING: This will unassign ALL ${totalStudents} students from ALL ${groups.length} groups. Are you sure?`)) return;
    try {
      const allUids = [];
      groups.forEach(group => { group.students.forEach(student => { allUids.push(student.uid); }); });
      const response = await unassignStudents(allUids);
      if (response.data.success) {
        setMessage({ type: 'success', text: `Successfully unassigned all ${totalStudents} students from ${groups.length} groups` });
        fetchGroups();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error unassigning all groups' });
    }
  };

  const handleAllocateExternalMentorsToAll = async () => {
    const unassignedGroups = groups.filter(g => !g.externalMentor);
    if (unassignedGroups.length === 0) { setMessage({ type: 'warning', text: 'All groups already have external evaluators assigned.' }); return; }
    if (!window.confirm(`Allocate external evaluators to ${unassignedGroups.length} groups?`)) return;
    try {
      const response = await allocateExternalMentorsToAll();
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating external evaluators' });
    }
  };

  const handleAllocateInternalMentorsToAll = async () => {
    const unassignedGroups = groups.filter(g => !g.internalMentor);
    if (unassignedGroups.length === 0) { setMessage({ type: 'warning', text: 'All groups already have internal examiners assigned.' }); return; }
    if (!window.confirm(`Allocate internal examiners to ${unassignedGroups.length} groups?`)) return;
    try {
      const response = await allocateInternalMentorsToAll();
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating internal examiners' });
    }
  };

  const handleAllocateExternalMentorToGroup = async (groupId, groupName) => {
    if (!window.confirm(`Allocate a random external evaluator to ${groupName}?`)) return;
    try {
      const response = await allocateExternalMentorToGroup(groupId);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating external evaluator' });
    }
  };

  const handleAllocateInternalMentorToGroup = async (groupId, groupName) => {
    if (!window.confirm(`Allocate a random internal examiner to ${groupName}?`)) return;
    try {
      const response = await allocateInternalMentorToGroup(groupId);
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error allocating internal examiner' });
    }
  };

  const handleSyncMentors = async () => {
    if (!window.confirm('Sync Evaluator Assignments? This will fix any evaluators incorrectly marked as assigned/unassigned.')) return;
    try {
      setLoading(true);
      const response = await syncMentors();
      if (response.data.success) { setMessage({ type: 'success', text: response.data.message }); fetchGroups(); }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error syncing evaluators' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = async (group) => {
    setEditingGroup(group);
    setEditFormData({
      name: group.groupName,
      students: group.students.map(s => s.uid).join(', '),
      externalMentor: group.externalMentor?._id || '',
      internalMentor: group.internalMentor?._id || ''
    });
    try {
      const [externalRes, internalRes] = await Promise.all([
        axiosInstance.get('/upload/mentors'),
        axiosInstance.get('/upload/internal-mentors')
      ]);
      if (externalRes.data.success) setAvailableExternalMentors(externalRes.data.data);
      if (internalRes.data.success) setAvailableInternalMentors(internalRes.data.data);
    } catch (error) {
      console.error('Error fetching mentors:', error);
    }
    setEditModalOpen(true);
  };

  const handleOpenAssignMentorModal = async (group, type = 'external') => {
    if (!group?._id) return;

    setAssigningGroup(group);
    setAssignMentorType(type);

    const currentId = type === 'external' ? group.externalMentor?._id : group.internalMentor?._id;
    setSelectedMentorId(currentId || '');

    try {
      if (type === 'external' && availableExternalMentors.length === 0) {
        const res = await axiosInstance.get('/upload/mentors');
        if (res.data.success) setAvailableExternalMentors(res.data.data);
      }
      if (type === 'internal' && availableInternalMentors.length === 0) {
        const res = await axiosInstance.get('/upload/internal-mentors');
        if (res.data.success) setAvailableInternalMentors(res.data.data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading mentors' });
    }

    setAssignMentorModalOpen(true);
  };

  const handleAssignMentorTypeChange = async (nextType) => {
    if (!assigningGroup) return;

    setAssignMentorType(nextType);
    const currentId = nextType === 'external' ? assigningGroup.externalMentor?._id : assigningGroup.internalMentor?._id;
    setSelectedMentorId(currentId || '');

    try {
      if (nextType === 'external' && availableExternalMentors.length === 0) {
        const res = await axiosInstance.get('/upload/mentors');
        if (res.data.success) setAvailableExternalMentors(res.data.data);
      }
      if (nextType === 'internal' && availableInternalMentors.length === 0) {
        const res = await axiosInstance.get('/upload/internal-mentors');
        if (res.data.success) setAvailableInternalMentors(res.data.data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading mentors' });
    }
  };

  const handleCloseAssignMentorModal = () => {
    setAssignMentorModalOpen(false);
    setAssigningGroup(null);
    setAssignMentorType('external');
    setSelectedMentorId('');
  };

  const handleConfirmAssignMentor = async () => {
    const groupId = assigningGroup?._id;
    if (!groupId) return;

    if (!selectedMentorId) {
      setMessage({ type: 'error', text: 'Please select an evaluator' });
      return;
    }

    if (assigningMentorByGroupId[groupId]) return;

    const ok = window.confirm('Are you sure you want to assign/change evaluator?');
    if (!ok) return;

    setAssigningMentorByGroupId(prev => ({ ...prev, [groupId]: true }));
    setMessage({ type: '', text: '' });

    try {
      const response = await assignMentorToGroup(groupId, {
        mentorId: selectedMentorId,
        mentorType: assignMentorType
      });

      if (response.data.success) {
        const updated = response.data.data;

        // Update UI instantly without full refresh
        setGroups(prev => prev.map(g => (g._id === updated._id ? updated : g)));
        setFilteredGroups(prev => prev.map(g => (g._id === updated._id ? updated : g)));

        setMessage({ type: 'success', text: response.data.message || 'Evaluator assigned successfully' });
        handleCloseAssignMentorModal();
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Error assigning evaluator' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error assigning evaluator' });
    } finally {
      setAssigningMentorByGroupId(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingGroup(null);
    setEditFormData({ name: '', students: [], externalMentor: '', internalMentor: '' });
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup) return;
    if (!editFormData.name.trim()) { setMessage({ type: 'error', text: 'Group name is required' }); return; }
    setSaving(true);
    try {
      const updateData = {
        name: editFormData.name,
        externalMentor: editFormData.externalMentor || null,
        internalMentor: editFormData.internalMentor || null
      };
      const response = await updateGroup(editingGroup._id, updateData);
      if (response.data.success) {
        setMessage({ type: 'success', text: `${editFormData.name} updated successfully` });
        handleCloseEditModal();
        fetchGroups();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error updating group' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendMailToGroupMentor = async (group) => {
    console.log('[UI] Click: Send Mail', { groupId: group?._id, groupName: group?.groupName });
    const groupId = group?._id;
    if (!groupId) return;
    if (sendingMailByGroupId[groupId]) return;

    // Pick a sensible default recipient type
    const defaultType = group.externalMentor?.email ? 'external' : group.internalMentor?.email ? 'internal' : 'external';
    setMailRecipientType(defaultType);
    setMailGroup(group);
    setSelectedSenderEmailId('');
    setAddingSender(false);
    setNewSenderForm({ email: '', password: '' });

    setSendMailModalError('');

    setSendMailModalOpen(true);

    // Load sender emails list
    setLoadingSenderEmails(true);
    try {
      console.log('[API] listSenderEmails()');
      const res = await listSenderEmails();
      if (res.data.success) {
        setSenderEmails(res.data.data || []);
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error loading sender emails';
      setSendMailModalError(msg);
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoadingSenderEmails(false);
    }
  };

  const closeSendMailModal = () => {
    setSendMailModalOpen(false);
    setSendMailModalError('');
    setMailGroup(null);
    setSelectedSenderEmailId('');
    setAddingSender(false);
    setNewSenderForm({ email: '', password: '' });
  };

  const handleAddSenderEmail = async () => {
    if (!newSenderForm.email.trim()) {
      setMessage({ type: 'error', text: 'Sender email is required' });
      return;
    }
    if (!newSenderForm.password) {
      setMessage({ type: 'error', text: 'Sender password is required' });
      return;
    }

    setAddingSenderSaving(true);
    try {
      const res = await addSenderEmail({ email: newSenderForm.email, password: newSenderForm.password });
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Sender email added' });
        const created = res.data.data;
        const next = [...senderEmails, created].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
        setSenderEmails(next);
        setSelectedSenderEmailId(created._id);
        setAddingSender(false);
        setNewSenderForm({ email: '', password: '' });
      } else {
        setMessage({ type: 'error', text: res.data.message || 'Error adding sender email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error adding sender email' });
    } finally {
      setAddingSenderSaving(false);
    }
  };

  const handleConfirmSendMail = async () => {
    console.log('[UI] Click: Confirm Send');
    const groupId = mailGroup?._id;
    if (!groupId) return;
    if (sendingMailByGroupId[groupId]) return;

    const hasRecipient = mailRecipientType === 'external'
      ? !!mailGroup?.externalMentor?.email
      : !!mailGroup?.internalMentor?.email;

    if (!hasRecipient) {
      const msg = `Selected ${mailRecipientType} evaluator email is missing for this group.`;
      setSendMailModalError(msg);
      setMessage({ type: 'error', text: msg });
      return;
    }

    // If user is adding a new sender, auto-save it on Send.
    let effectiveSenderEmailId = selectedSenderEmailId;
    if (!effectiveSenderEmailId) {
      if (addingSender) {
        if (!newSenderForm.email.trim()) {
          const msg = 'New sender email is required';
          setSendMailModalError(msg);
          setMessage({ type: 'error', text: msg });
          return;
        }
        if (!newSenderForm.password) {
          const msg = 'New sender password is required';
          setSendMailModalError(msg);
          setMessage({ type: 'error', text: msg });
          return;
        }

        try {
          console.log('[API] addSenderEmail() (auto on Send)', { email: newSenderForm.email });
          const res = await addSenderEmail({ email: newSenderForm.email, password: newSenderForm.password });
          console.log('[API] addSenderEmail() response', res?.data);

          if (!res.data.success) {
            const msg = res.data.message || 'Error adding sender email';
            setSendMailModalError(msg);
            setMessage({ type: 'error', text: msg });
            return;
          }

          const created = res.data.data;
          const next = [...senderEmails, created].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
          setSenderEmails(next);

          effectiveSenderEmailId = created._id;
          setSelectedSenderEmailId(created._id);
          setAddingSender(false);
          setNewSenderForm({ email: '', password: '' });
        } catch (error) {
          const msg = error.response?.data?.message || 'Error adding sender email';
          setSendMailModalError(msg);
          setMessage({ type: 'error', text: msg });
          return;
        }
      } else {
        const msg = 'Please select a sender email (or add a new one).';
        setSendMailModalError(msg);
        setMessage({ type: 'error', text: msg });
        return;
      }
    }

    const ok = window.confirm('Are you sure you want to send mail to this evaluator?');
    if (!ok) return;

    setSendingMailByGroupId(prev => ({ ...prev, [groupId]: true }));
    setSendMailModalError('');
    setMessage({ type: '', text: '' });

    try {
      console.log('[API] sendGroupMail()', { groupId, senderEmailId: effectiveSenderEmailId, recipientType: mailRecipientType });
      const response = await sendGroupMail(groupId, {
        senderEmailId: effectiveSenderEmailId,
        recipientType: mailRecipientType,
      });
      console.log('[API] sendGroupMail() response', response?.data);
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message || 'Mail sent successfully!' });
        closeSendMailModal();
        await fetchGroups();
      } else {
        const msg = response.data.message || 'Error sending mail';
        setSendMailModalError(msg);
        setMessage({ type: 'error', text: msg });
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message || 'Error sending mail';
      if (status === 409) {
        setMessage({ type: 'info', text: msg });
        closeSendMailModal();
        await fetchGroups();
      } else {
        setSendMailModalError(msg);
        setMessage({ type: 'error', text: msg });
      }
    } finally {
      setSendingMailByGroupId(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const openDraftModal = async () => {
    console.log('[UI] Click: Edit Mail Draft');
    setDraftModalOpen(true);
    setDraftLoading(true);
    setDraftModalError('');
    setMessage({ type: '', text: '' });
    try {
      console.log('[API] getMailDraft()');
      const res = await getMailDraft();
      if (res.data.success) {
        setDraftForm({
          subject: res.data.data?.subject || '',
          body: res.data.data?.body || '',
        });
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error loading mail draft';
      setDraftModalError(msg);
      setMessage({ type: 'error', text: msg });
    } finally {
      setDraftLoading(false);
    }
  };

  const closeDraftModal = () => {
    setDraftModalOpen(false);
    setDraftModalError('');
  };

  const handleSaveDraft = async () => {
    console.log('[UI] Click: Save Draft');
    if (!draftForm.subject.trim()) {
      const msg = 'Subject is required';
      setDraftModalError(msg);
      setMessage({ type: 'error', text: msg });
      return;
    }
    if (!draftForm.body.trim()) {
      const msg = 'Body is required';
      setDraftModalError(msg);
      setMessage({ type: 'error', text: msg });
      return;
    }

    const ok = window.confirm('Are you sure you want to save changes to the global mail draft?');
    if (!ok) return;

    setDraftSaving(true);
    try {
      console.log('[API] saveMailDraft()', { subjectLen: draftForm.subject.length, bodyLen: draftForm.body.length });
      const res = await saveMailDraft({ subject: draftForm.subject, body: draftForm.body });
      console.log('[API] saveMailDraft() response', res?.data);
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Mail draft saved successfully' });
        closeDraftModal();
      } else {
        const msg = res.data.message || 'Error saving mail draft';
        setDraftModalError(msg);
        setMessage({ type: 'error', text: msg });
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error saving mail draft';
      setDraftModalError(msg);
      setMessage({ type: 'error', text: msg });
    } finally {
      setDraftSaving(false);
    }
  };

  const expandAll = () => setExpandedGroups(new Set(groups.map(g => g._id)));
  const collapseAll = () => setExpandedGroups(new Set());

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Loading groups...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalStudentsAll = groups.reduce((sum, g) => sum + g.studentCount, 0);
  const avgSize = groups.length > 0 ? Math.round(totalStudentsAll / groups.length) : 0;

  const mentorsForAssign = assignMentorType === 'external' ? availableExternalMentors : availableInternalMentors;
  const currentAssignedMentorId = assignMentorType === 'external'
    ? assigningGroup?.externalMentor?._id
    : assigningGroup?.internalMentor?._id;
  const selectableMentorsForAssign = mentorsForAssign.filter(m => !m.isAssigned || m._id === currentAssignedMentorId);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Evaluation Group Overview</h1>
          <p className="page-subtitle">View and manage evaluation groups and evaluator assignments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchGroups} className="btn-secondary">Refresh</button>
          <button onClick={openDraftModal} className="btn-secondary">Edit Mail Draft</button>
          {groups.length > 0 && (
            <>
              <button onClick={handleAllocateExternalMentorsToAll} className="btn-secondary">Allocate External Evaluators</button>
              <button onClick={handleAllocateInternalMentorsToAll} className="btn-secondary">Allocate Internal Examiners</button>
              <button onClick={handleSyncMentors} className="btn-secondary">Sync Evaluators</button>
              <button onClick={handleExportAll} className="btn-secondary">Export All Groups</button>
              <button onClick={handleUnassignAllGroups} className="btn-danger">Unassign All Groups</button>
            </>
          )}
        </div>
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : message.type === 'info' ? 'info' : 'error'}`}>
          {message.text}
        </div>
      )}

      {/* KPI Summary */}
      {groups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <p className="stat-label">Total Groups</p>
            <p className="stat-value">{groups.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Students Assigned</p>
            <p className="stat-value">{totalStudentsAll}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Avg Students per Group</p>
            <p className="stat-value">{avgSize}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="section-card mb-4">
        <div className="section-card-body">
          <label className="form-label">Search Groups</label>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by student name or evaluator name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 loading-spinner" style={{width:'18px',height:'18px'}}></div>}
            </div>
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setFilteredGroups(groups); setMessage({ type: '', text: '' }); }} className="btn-secondary">
                Clear
              </button>
            )}
          </div>
          {searchQuery && <p className="mt-1 text-xs text-gray-500">Showing {filteredGroups.length} of {groups.length} groups</p>}
        </div>
      </div>

      {/* Expand/Collapse Controls */}
      {filteredGroups.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button onClick={expandAll} className="btn-secondary" style={{fontSize:'13px',padding:'6px 14px'}}>Expand All</button>
          <button onClick={collapseAll} className="btn-secondary" style={{fontSize:'13px',padding:'6px 14px'}}>Collapse All</button>
        </div>
      )}

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="section-card">
          <div className="section-card-body text-center py-16">
            <p className="text-gray-500 text-sm">
              {searchQuery ? `No groups match the search term "${searchQuery}".` : 'No evaluation groups have been created yet. Use the Group Formation System to create groups.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups.has(group._id);
            return (
              <div key={group._id} className="section-card overflow-hidden">
                {/* Group Row Header */}
                <div className="section-card-header flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleGroup(group._id)}
                      className="text-gray-400 hover:text-gray-700 font-bold text-sm w-6"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div>
                      <h3 className="section-title mb-0">{group.groupName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{group.studentCount} student{group.studentCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="ml-4 flex gap-4 text-xs">
                      {group.externalMentor
                        ? <span className="badge badge-blue">External Evaluator: {group.externalMentor.name}</span>
                        : <span className="badge badge-red">No external evaluator</span>}
                      {group.internalMentor
                        ? <span className="badge badge-green">Internal Examiner: {group.internalMentor.name}</span>
                        : <span className="badge badge-red">No internal examiner</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!group.externalMentor && (
                      <button onClick={() => handleAllocateExternalMentorToGroup(group._id, group.groupName)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>
                        Assign External Evaluator
                      </button>
                    )}
                    {!group.internalMentor && (
                      <button onClick={() => handleAllocateInternalMentorToGroup(group._id, group.groupName)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>
                        Assign Internal Examiner
                      </button>
                    )}

                    {/* Manual mentor assignment/change (does not replace random allocation) */}
                    <button
                      onClick={() => handleOpenAssignMentorModal(
                        group,
                        group.externalMentor ? 'external' : group.internalMentor ? 'internal' : 'external'
                      )}
                      disabled={!!assigningMentorByGroupId[group._id]}
                      className="btn-secondary"
                      style={{fontSize:'12px',padding:'4px 10px'}}
                    >
                      {(group.externalMentor || group.internalMentor) ? 'Change Evaluator' : 'Assign Evaluator'}
                    </button>

                    <button onClick={() => handleOpenEditModal(group)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>Edit</button>
                    <button onClick={() => handleExportSingleGroup(group)} className="btn-secondary" style={{fontSize:'12px',padding:'4px 10px'}}>Export</button>
                    <button
                      onClick={() => handleSendMailToGroupMentor(group)}
                      disabled={!!sendingMailByGroupId[group._id]}
                      className="btn-secondary"
                      style={{fontSize:'12px',padding:'4px 10px'}}
                    >
                      {sendingMailByGroupId[group._id] ? 'Sending...' : 'Send Mail'}
                    </button>
                    <button onClick={() => handleUnassignGroup(group)} className="btn-danger" style={{fontSize:'12px',padding:'4px 10px'}}>Unassign</button>
                  </div>
                </div>

                {/* Student Table (expanded) */}
                {isExpanded && (
                  <div className="section-card-body p-0">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student Name</th>
                          <th>UID</th>
                          <th>Branch</th>
                          <th>Company</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((student, idx) => (
                          <tr key={student.uid}>
                            <td>{idx + 1}</td>
                            <td className="font-medium">{student.name}</td>
                            <td>{student.uid}</td>
                            <td><span className="badge badge-blue">{student.branch}</span></td>
                            <td>{student.company || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Group Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Edit Group</h2>
              <button onClick={handleCloseEditModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Group Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="form-input"
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label className="form-label">External Evaluator (Industry)</label>
                <select
                  value={editFormData.externalMentor || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, externalMentor: e.target.value })}
                  className="form-select"
                >
                  <option value="">— No External Evaluator —</option>
                  {availableExternalMentors.map((mentor) => (
                    <option key={mentor._id} value={mentor._id}>{mentor.name} ({mentor.company})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Internal Examiner (Faculty)</label>
                <select
                  value={editFormData.internalMentor || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, internalMentor: e.target.value })}
                  className="form-select"
                >
                  <option value="">— No Internal Examiner —</option>
                  {availableInternalMentors.map((mentor) => (
                    <option key={mentor._id} value={mentor._id}>{mentor.name} ({mentor.department || 'Faculty'})</option>
                  ))}
                </select>
              </div>
              {editingGroup && (
                <div className="alert-info">
                  <strong>Students in this group:</strong> {editingGroup.students?.length || 0}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={handleSaveGroupEdit} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleCloseEditModal} disabled={saving} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign/Change Mentor Modal */}
      {assignMentorModalOpen && assigningGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {assigningGroup.externalMentor ? 'Change Evaluator' : 'Assign Evaluator'}
              </h2>
              <button onClick={handleCloseAssignMentorModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="alert-info">
                <strong>Group:</strong> {assigningGroup.groupName}
              </div>

              <div>
                <label className="form-label">Evaluator Type</label>
                <select
                  value={assignMentorType}
                  onChange={(e) => handleAssignMentorTypeChange(e.target.value)}
                  className="form-select"
                >
                  <option value="external">External Evaluator</option>
                  <option value="internal">Internal Examiner</option>
                </select>
              </div>

              <div>
                <label className="form-label">Select Evaluator <span className="text-red-500">*</span></label>
                <select
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                  className="form-select"
                >
                  <option value="">— Select an evaluator —</option>
                  {selectableMentorsForAssign.map((mentor) => (
                    <option key={mentor._id} value={mentor._id}>
                      {mentor.name} ({mentor.email})
                    </option>
                  ))}
                </select>
                {selectableMentorsForAssign.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No evaluators available.</p>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Only unassigned evaluators are shown (plus the current evaluator).
              </p>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleConfirmAssignMentor}
                disabled={!!assigningMentorByGroupId[assigningGroup._id] || selectableMentorsForAssign.length === 0}
                className="btn-primary flex-1"
              >
                {assigningMentorByGroupId[assigningGroup._id] ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCloseAssignMentorModal}
                disabled={!!assigningMentorByGroupId[assigningGroup._id]}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mail Draft Modal */}
      {draftModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Edit Mail Draft</h2>
              <button onClick={closeDraftModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {!!draftModalError && (
                <div className="alert-error">
                  {draftModalError}
                </div>
              )}
              {draftLoading ? (
                <div className="text-center py-10">
                  <div className="loading-spinner mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Loading draft...</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="form-label">Subject <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={draftForm.subject}
                      onChange={(e) => setDraftForm({ ...draftForm, subject: e.target.value })}
                      className="form-input"
                      placeholder="Enter subject"
                    />
                  </div>
                  <div>
                    <label className="form-label">Body <span className="text-red-500">*</span></label>
                    <textarea
                      value={draftForm.body}
                      onChange={(e) => setDraftForm({ ...draftForm, body: e.target.value })}
                      className="form-input"
                      style={{ minHeight: '160px' }}
                      placeholder="Enter email body"
                    />
                      <p className="mt-1 text-xs text-gray-500">
                        Optional placeholders: {'{{mentorName}}'}, {'{{mentorEmail}}'}, {'{{groupName}}'}
                      </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={handleSaveDraft} disabled={draftSaving || draftLoading} className="btn-primary flex-1">
                {draftSaving ? 'Saving...' : 'Save Draft'}
              </button>
              <button onClick={closeDraftModal} disabled={draftSaving} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Mail Modal */}
      {sendMailModalOpen && mailGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Send Mail</h2>
              <button onClick={closeSendMailModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {!!sendMailModalError && (
                <div className="alert-error">
                  {sendMailModalError}
                </div>
              )}
              <div className="alert-info">
                <strong>Group:</strong> {mailGroup.groupName}
              </div>

              <div>
                <label className="form-label">Send To</label>
                <select
                  value={mailRecipientType}
                  onChange={(e) => setMailRecipientType(e.target.value)}
                  className="form-select"
                >
                  <option value="external">External Evaluator</option>
                  <option value="internal">Internal Examiner</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  External: {mailGroup.externalMentor?.email || '—'} | Internal: {mailGroup.internalMentor?.email || '—'}
                </p>
              </div>

              <div>
                <label className="form-label">Sender Email</label>
                {loadingSenderEmails ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="loading-spinner" style={{ width: '18px', height: '18px' }}></div>
                    Loading sender emails...
                  </div>
                ) : (
                  <select
                    value={selectedSenderEmailId}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__add__') {
                        setAddingSender(true);
                        setSelectedSenderEmailId('');
                      } else {
                        setAddingSender(false);
                        setSelectedSenderEmailId(value);
                      }
                    }}
                    className="form-select"
                  >
                    <option value="">— Select sender email —</option>
                    {senderEmails.map(s => (
                      <option key={s._id} value={s._id}>{s.email}</option>
                    ))}
                    <option value="__add__">+ Add New Sender Email</option>
                  </select>
                )}
              </div>

              {addingSender && (
                <div className="section-card" style={{ marginBottom: 0 }}>
                  <div className="section-card-body space-y-3">
                    <div>
                      <label className="form-label">New Sender Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={newSenderForm.email}
                        onChange={(e) => setNewSenderForm({ ...newSenderForm, email: e.target.value })}
                        className="form-input"
                        placeholder="sender@example.com"
                      />
                    </div>
                    <div>
                      <label className="form-label">Password <span className="text-red-500">*</span></label>
                      <input
                        type="password"
                        value={newSenderForm.password}
                        onChange={(e) => setNewSenderForm({ ...newSenderForm, password: e.target.value })}
                        className="form-input"
                        placeholder="App password / SMTP password"
                      />
                      <p className="mt-1 text-xs text-gray-500">Password is encrypted before storing.</p>
                    </div>
                    <button
                      onClick={handleAddSenderEmail}
                      disabled={addingSenderSaving}
                      className="btn-secondary"
                      style={{ width: '100%' }}
                    >
                      {addingSenderSaving ? 'Adding...' : 'Add Sender Email'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleConfirmSendMail}
                disabled={!!sendingMailByGroupId[mailGroup._id] || loadingSenderEmails}
                className="btn-primary flex-1"
              >
                {sendingMailByGroupId[mailGroup._id] ? 'Sending...' : 'Send'}
              </button>
              <button onClick={closeSendMailModal} disabled={!!sendingMailByGroupId[mailGroup._id]} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllGroups;