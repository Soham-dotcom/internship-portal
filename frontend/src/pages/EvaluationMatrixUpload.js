import React, { useState } from 'react';
import {
  uploadMeetingAttendance,
  uploadWeeklyReports,
  uploadFinalReport,
  uploadExternalMarks,
  uploadExternalVivaMarks,
  uploadInternalVivaMarks,
} from '../api/axios';

const validateFile = (selectedFile, setMsg) => {
  const validTypes = [
    '.xlsx',
    '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
  if (!validTypes.includes(ext) && !validTypes.includes(selectedFile.type)) {
    setMsg({ type: 'error', text: 'Please upload a valid Excel file (.xlsx or .xls)' });
    return false;
  }
  return true;
};

const UploadSection = ({ title, subtitle, file, setFile, onUpload, loading, message, extraControls }) => (
  <div className="section-card">
    <div className="section-card-header">
      <h2 className="section-title">{title}</h2>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
    <div className="section-card-body space-y-4">
      {message.text && (
        <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : 'error'}`}>
          <div className="whitespace-pre-wrap">{message.text}</div>
        </div>
      )}

      <div className="space-y-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files[0] || null)}
          className="file-input"
        />
        {extraControls}
      </div>

      <button
        className="btn-primary"
        onClick={onUpload}
        disabled={loading || !file}
      >
        {loading ? 'Uploading...' : 'Upload Excel'}
      </button>
    </div>
  </div>
);

const EvaluationMatrixUpload = () => {
  const [meetingFile, setMeetingFile] = useState(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingMessage, setMeetingMessage] = useState({ type: '', text: '' });

  const [weeklyFile, setWeeklyFile] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyMessage, setWeeklyMessage] = useState({ type: '', text: '' });
  const [weeklyCount, setWeeklyCount] = useState(8);

  const [finalFile, setFinalFile] = useState(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [finalMessage, setFinalMessage] = useState({ type: '', text: '' });

  const [externalFile, setExternalFile] = useState(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalMessage, setExternalMessage] = useState({ type: '', text: '' });

  const [externalVivaFile, setExternalVivaFile] = useState(null);
  const [externalVivaLoading, setExternalVivaLoading] = useState(false);
  const [externalVivaMessage, setExternalVivaMessage] = useState({ type: '', text: '' });

  const [internalVivaFile, setInternalVivaFile] = useState(null);
  const [internalVivaLoading, setInternalVivaLoading] = useState(false);
  const [internalVivaMessage, setInternalVivaMessage] = useState({ type: '', text: '' });

  const handleUpload = async ({ file, setFile, setLoading, setMessage, uploader, payload }) => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }
    if (!validateFile(file, setMessage)) return;

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await uploader(file, payload);
      if (response.data.success) {
        let text = response.data.message || 'Upload completed.';
        if (response.data.errors?.length > 0) {
          text += '\nErrors:\n' + response.data.errors.join('\n');
        }
        setMessage({ type: response.data.skipped > 0 ? 'warning' : 'success', text });
        setFile(null);
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <h1 className="page-title">Evaluation Matrix Upload</h1>
        <p className="page-subtitle">Upload evaluation data in separate Excel files. UID is required for all uploads.</p>
      </div>

      <UploadSection
        title="Meeting Attendance Upload"
        subtitle="Excel format: name | uid | meeting_attended (0/1)"
        file={meetingFile}
        setFile={setMeetingFile}
        loading={meetingLoading}
        message={meetingMessage}
        onUpload={() => handleUpload({
          file: meetingFile,
          setFile: setMeetingFile,
          setLoading: setMeetingLoading,
          setMessage: setMeetingMessage,
          uploader: uploadMeetingAttendance
        })}
      />

      <UploadSection
        title="Weekly Report Upload"
        subtitle="Excel format: name | uid | week1 | week2 | ... (merged into weekly_report_data)"
        file={weeklyFile}
        setFile={setWeeklyFile}
        loading={weeklyLoading}
        message={weeklyMessage}
        extraControls={(
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Number of weeks</label>
            <input
              type="number"
              min={1}
              max={52}
              value={weeklyCount}
              onChange={(e) => setWeeklyCount(Number(e.target.value) || 1)}
              className="input w-24"
            />
          </div>
        )}
        onUpload={() => handleUpload({
          file: weeklyFile,
          setFile: setWeeklyFile,
          setLoading: setWeeklyLoading,
          setMessage: setWeeklyMessage,
          uploader: (file) => uploadWeeklyReports(file, weeklyCount)
        })}
      />

      <UploadSection
        title="Final Report Upload"
        subtitle="Excel format: name | uid | final_report (0/1)"
        file={finalFile}
        setFile={setFinalFile}
        loading={finalLoading}
        message={finalMessage}
        onUpload={() => handleUpload({
          file: finalFile,
          setFile: setFinalFile,
          setLoading: setFinalLoading,
          setMessage: setFinalMessage,
          uploader: uploadFinalReport
        })}
      />

      <UploadSection
        title="Industry Evaluator Marks Upload"
        subtitle="Excel format: name | uid | marks"
        file={externalFile}
        setFile={setExternalFile}
        loading={externalLoading}
        message={externalMessage}
        onUpload={() => handleUpload({
          file: externalFile,
          setFile: setExternalFile,
          setLoading: setExternalLoading,
          setMessage: setExternalMessage,
          uploader: uploadExternalMarks
        })}
      />

      <UploadSection
        title="External Evaluator Viva Upload"
        subtitle="Excel format: name | uid | marks"
        file={externalVivaFile}
        setFile={setExternalVivaFile}
        loading={externalVivaLoading}
        message={externalVivaMessage}
        onUpload={() => handleUpload({
          file: externalVivaFile,
          setFile: setExternalVivaFile,
          setLoading: setExternalVivaLoading,
          setMessage: setExternalVivaMessage,
          uploader: uploadExternalVivaMarks
        })}
      />

      <UploadSection
        title="Internal Examiner Viva Upload"
        subtitle="Excel format: name | uid | marks"
        file={internalVivaFile}
        setFile={setInternalVivaFile}
        loading={internalVivaLoading}
        message={internalVivaMessage}
        onUpload={() => handleUpload({
          file: internalVivaFile,
          setFile: setInternalVivaFile,
          setLoading: setInternalVivaLoading,
          setMessage: setInternalVivaMessage,
          uploader: uploadInternalVivaMarks
        })}
      />
    </div>
  );
};

export default EvaluationMatrixUpload;
