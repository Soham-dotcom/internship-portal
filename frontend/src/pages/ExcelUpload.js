import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { normalizeCompanyName, similarityScore } from '../utils/companyNormalization';
import { confirmDialog } from '../ui/feedback';
import {
  previewImport,
  applyImport,
  getLatestImport,
  undoImport,
  downloadTemplate, 
  importExternalMentors, 
  getExternalMentors, 
  downloadExternalMentorTemplate,
  importInternalMentors,
  getInternalMentors,
  downloadInternalMentorTemplate
} from '../api/axios';

const ExcelUpload = () => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  // Import safety: every import is previewed first, and the latest one can be undone.
  const [importMode, setImportMode] = useState('add-only');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [acceptErrors, setAcceptErrors] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [undoing, setUndoing] = useState(false);

  const [externalMentorFile, setExternalMentorFile] = useState(null);
  const [parsedExternalMentors, setParsedExternalMentors] = useState([]);
  const [externalMentorLoading, setExternalMentorLoading] = useState(false);
  const [externalMentorImporting, setExternalMentorImporting] = useState(false);
  const [externalMentorMessage, setExternalMentorMessage] = useState({ type: '', text: '' });
  const [externalMentorList, setExternalMentorList] = useState([]);
  const [loadingExternalMentorList, setLoadingExternalMentorList] = useState(false);

  const [internalMentorFile, setInternalMentorFile] = useState(null);
  const [parsedInternalMentors, setParsedInternalMentors] = useState([]);
  const [internalMentorLoading, setInternalMentorLoading] = useState(false);
  const [internalMentorImporting, setInternalMentorImporting] = useState(false);
  const [internalMentorMessage, setInternalMentorMessage] = useState({ type: '', text: '' });
  const [internalMentorList, setInternalMentorList] = useState([]);
  const [loadingInternalMentorList, setLoadingInternalMentorList] = useState(false);

  const fetchExternalMentors = useCallback(async () => {
    setLoadingExternalMentorList(true);
    try {
      const response = await getExternalMentors();
      if (response.data.success) setExternalMentorList(response.data.data);
    } catch (error) { console.error('Error fetching external mentors:', error); }
    finally { setLoadingExternalMentorList(false); }
  }, []);

  const fetchInternalMentors = useCallback(async () => {
    setLoadingInternalMentorList(true);
    try {
      const response = await getInternalMentors();
      if (response.data.success) setInternalMentorList(response.data.data);
    } catch (error) { console.error('Error fetching internal mentors:', error); }
    finally { setLoadingInternalMentorList(false); }
  }, []);

  const fetchLatestImport = useCallback(async () => {
    try {
      const response = await getLatestImport();
      setLastImport(response.data.data);
    } catch {
      setLastImport(null); // the undo panel is optional; the page works without it
    }
  }, []);

  useEffect(() => {
    fetchExternalMentors();
    fetchInternalMentors();
    fetchLatestImport();
  }, [fetchExternalMentors, fetchInternalMentors, fetchLatestImport]);

  const validateFile = (selectedFile, setMsg) => {
    const validTypes = ['.xlsx', '.xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext) && !validTypes.includes(selectedFile.type)) {
      setMsg({ type: 'error', text: 'Please upload a valid Excel file (.xlsx or .xls)' });
      return false;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'File size exceeds 5MB limit' });
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && validateFile(selectedFile, setMessage)) { setFile(selectedFile); setMessage({ type: '', text: '' }); }
    else if (selectedFile) setFile(null);
  };

  // First listed column that exists AND has a value. Returns undefined otherwise, so a
  // missing column or blank cell is simply not sent, and can never overwrite stored data.
  // (This used to fall back to today's date for dates, '' for text, invented UIDs like
  // "AUTO-1", and the row's serial number as a UID.)
  const pickCell = (row, keys) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return undefined;
  };

  // For the preview table: readable dates, and a dash for empty values.
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
    return String(value);
  };

  const withoutMissing = (record) => Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );

  const runPreview = async (records, mode) => {
    setPreviewing(true);
    setPreview(null);
    setAcceptErrors(false);
    try {
      const response = await previewImport(records, mode);
      setPreview(response.data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Could not preview the import: ' + (error.response?.data?.message || error.message) });
    } finally {
      setPreviewing(false);
    }
  };

  const handleParseFile = () => {
    if (!file) { setMessage({ type: 'error', text: 'Please select a file first' }); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        // cellDates: real dates instead of Excel serial numbers (45658 would become 1970).
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);
        if (json.length === 0) { setMessage({ type: 'error', text: 'Excel file is empty' }); setLoading(false); return; }
        const mapped = json.map((row) => withoutMissing({
          // No UID → sent as blank so the preview reports the row, never an invented ID.
          uid: String(pickCell(row, ['UID', 'uid', 'Roll No', 'Roll No.', 'roll no', 'roll no.']) ?? '').trim(),
          email: pickCell(row, ['Institute Email ID', 'Personal Email ID', 'Email', 'email']),
          name: pickCell(row, ['Name', 'name', 'Student Name']),
          branch: pickCell(row, ['Branch', 'branch']),
          internshipType: pickCell(row, ['Internship Type', 'internshipType']),
          companyName: pickCell(row, ['8th Sem Internship Offer', 'Company Name', 'companyName', 'company', 'Placement Offer']),
          externalMentorName: pickCell(row, ['External Mentor Name', 'externalMentorName']),
          startDate: pickCell(row, ['Start Date', 'startDate']),
          endDate: pickCell(row, ['End Date', 'endDate']),
          documentLink: pickCell(row, ['8th Sem Internship Offer Letter', 'Document Link', 'documentLink']),
          companyLocation: pickCell(row, ['Company Location', 'companyLocation']),
          internshipTitle: pickCell(row, ['Role', 'Internship Title', 'internshipTitle', 'Profile', 'profile']),
          profile: pickCell(row, ['Profile', 'profile', 'Tech/Non-Tech', 'Tech Non Tech', 'Role Type', 'role type']),
          stipend: pickCell(row, ['8th Sem Internship Stipend', 'Stipend', 'stipend']),
          gender: pickCell(row, ['Gender', 'gender']),
          phone: pickCell(row, ['Mobile No.', 'Phone', 'phone']),
          ctc: pickCell(row, ['CTC (LPA)', 'CTC', 'ctc']),
          placementOffer: pickCell(row, ['Placement Offer', 'placementOffer']),
          remarks: pickCell(row, ['Remarks', 'remarks']),
          submittedAt: pickCell(row, ['Submitted At']),
        }));
        setParsedData(mapped);
        const rawNames = mapped
          .map((item) => String(item.companyName || '').trim())
          .filter(Boolean);
        const uniqueNames = Array.from(new Set(rawNames));
        const suggestions = [];
        for (let i = 0; i < uniqueNames.length; i += 1) {
          for (let j = i + 1; j < uniqueNames.length; j += 1) {
            const a = normalizeCompanyName(uniqueNames[i]);
            const b = normalizeCompanyName(uniqueNames[j]);
            if (!a || !b || a === b) continue;
            const score = similarityScore(a, b);
            if (score >= 0.8) {
              suggestions.push(`${uniqueNames[i]}  ~  ${uniqueNames[j]}`);
            }
          }
        }
        setCompanySuggestions(suggestions.slice(0, 20));
        setMessage({ type: '', text: '' });
        runPreview(mapped, importMode);
      } catch (error) { setMessage({ type: 'error', text: 'Error parsing file: ' + error.message }); }
      finally { setLoading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleModeChange = (mode) => {
    setImportMode(mode);
    if (parsedData.length > 0) runPreview(parsedData, mode);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) { setMessage({ type: 'error', text: 'No data to import' }); return; }
    setImporting(true);
    try {
      const response = await applyImport(parsedData, importMode, acceptErrors);
      let text = response.data.message;
      if (response.data.ignoredFieldsNote) text += `\n${response.data.ignoredFieldsNote} (${response.data.ignoredFields.join(', ')})`;
      setMessage({ type: 'success', text });
      setParsedData([]); setCompanySuggestions([]); setFile(null); setPreview(null);
      fetchLatestImport();
    } catch (error) {
      setMessage({ type: 'error', text: 'Nothing was imported: ' + (error.response?.data?.message || error.message) });
    } finally { setImporting(false); }
  };

  const handleUndoImport = async () => {
    if (!lastImport) return;
    const { inserted, updated } = lastImport.counts || {};
    const ok = await confirmDialog({
      title: 'Undo the last import?',
      message: `Import from ${new Date(lastImport.createdAt).toLocaleString()} by ${lastImport.createdBy}.\n\n`
        + `${inserted || 0} added student(s) will move to the Recycle Bin and ${updated || 0} updated student(s) will get their old details back. `
        + 'Fields edited since the import are kept.',
      confirmLabel: 'Undo import',
    });
    if (!ok) return;
    setUndoing(true);
    try {
      const response = await undoImport(lastImport._id);
      let text = response.data.message;
      if (response.data.conflicts?.length > 0) text += '\n\nKept because they were edited after the import:\n' + response.data.conflicts.join('\n');
      setMessage({ type: response.data.conflicts?.length > 0 ? 'warning' : 'success', text });
      fetchLatestImport();
    } catch (error) {
      setMessage({ type: 'error', text: 'Undo failed, nothing was changed: ' + (error.response?.data?.message || error.message) });
    } finally { setUndoing(false); }
  };


  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a'); link.href = url;
      link.setAttribute('download', 'internship_template.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { setMessage({ type: 'error', text: 'Error downloading template: ' + error.message }); }
  };

  const handleExternalMentorFileChange = (e) => {
    const f = e.target.files[0];
    if (f && validateFile(f, setExternalMentorMessage)) { setExternalMentorFile(f); setExternalMentorMessage({ type: '', text: '' }); }
    else if (f) setExternalMentorFile(null);
  };

  const parseMentorFile = (fileObj, setLoading, setData, setMsg) => {
    if (!fileObj) { setMsg({ type: 'error', text: 'Please select a file first' }); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (json.length === 0) { setMsg({ type: 'error', text: 'Excel file is empty' }); setLoading(false); return; }
        const mapped = json.map(row => ({
          name: row['Name'] || row['name'] || row['Mentor Name'] || row['Full Name'] || '',
          email: row['Email'] || row['email'] || row['Gmail'] || row['gmail'] || row['Mentor Email'] || row['E-mail'] || '',
          phone: String(
            row['Phone']
              || row['phone']
              || row['PhoneNo']
              || row['phoneno']
              || row['Phone No']
              || row['Phone No.']
              || row['Phone Number']
              || row['phone number']
              || row['Mobile']
              || row['Mobile No']
              || row['Mobile No.']
              || row['Contact']
              || ''
          ),
        })).filter(item => item.name && item.email);
        setData(mapped);
        setMsg({ type: mapped.length === 0 ? 'error' : 'success', text: mapped.length === 0 ? 'No valid records found. Ensure columns "Name" and "Email" exist.' : `Parsed ${mapped.length} records.` });
      } catch (error) { setMsg({ type: 'error', text: 'Error parsing file: ' + error.message }); }
      finally { setLoading(false); }
    };
    reader.readAsArrayBuffer(fileObj);
  };

  const handleParseExternalMentorFile = () => parseMentorFile(externalMentorFile, setExternalMentorLoading, setParsedExternalMentors, setExternalMentorMessage);

  const handleImportExternalMentors = async () => {
    if (parsedExternalMentors.length === 0) { setExternalMentorMessage({ type: 'error', text: 'No data to import' }); return; }
    setExternalMentorImporting(true);
    try {
      const response = await importExternalMentors(parsedExternalMentors);
      if (response.data.success) {
        let text = response.data.message;
        if (response.data.inserted !== undefined) text += `\n${response.data.inserted} added, ${response.data.updated} updated${response.data.failed > 0 ? `, ${response.data.failed} failed` : ''}`;
        setExternalMentorMessage({ type: response.data.failed > 0 ? 'warning' : 'success', text });
        setParsedExternalMentors([]); setExternalMentorFile(null); fetchExternalMentors();
      }
    } catch (error) {
      setExternalMentorMessage({ type: 'error', text: 'Error importing: ' + (error.response?.data?.message || error.message) });
    } finally { setExternalMentorImporting(false); }
  };

  const handleDownloadExternalMentorTemplate = async () => {
    try {
      const response = await downloadExternalMentorTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a'); link.href = url;
      link.setAttribute('download', 'external_mentor_template.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { setExternalMentorMessage({ type: 'error', text: 'Error downloading template: ' + error.message }); }
  };

  const handleInternalMentorFileChange = (e) => {
    const f = e.target.files[0];
    if (f && validateFile(f, setInternalMentorMessage)) { setInternalMentorFile(f); setInternalMentorMessage({ type: '', text: '' }); }
    else if (f) setInternalMentorFile(null);
  };

  const handleParseInternalMentorFile = () => parseMentorFile(internalMentorFile, setInternalMentorLoading, setParsedInternalMentors, setInternalMentorMessage);

  const handleImportInternalMentors = async () => {
    if (parsedInternalMentors.length === 0) { setInternalMentorMessage({ type: 'error', text: 'No data to import' }); return; }
    setInternalMentorImporting(true);
    try {
      const response = await importInternalMentors(parsedInternalMentors);
      if (response.data.success) {
        let text = response.data.message;
        if (response.data.inserted !== undefined) text += `\n${response.data.inserted} added, ${response.data.updated} updated${response.data.failed > 0 ? `, ${response.data.failed} failed` : ''}`;
        setInternalMentorMessage({ type: response.data.failed > 0 ? 'warning' : 'success', text });
        setParsedInternalMentors([]); setInternalMentorFile(null); fetchInternalMentors();
      }
    } catch (error) {
      setInternalMentorMessage({ type: 'error', text: 'Error importing: ' + (error.response?.data?.message || error.message) });
    } finally { setInternalMentorImporting(false); }
  };

  const handleDownloadInternalMentorTemplate = async () => {
    try {
      const response = await downloadInternalMentorTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a'); link.href = url;
      link.setAttribute('download', 'internal_mentor_template.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { setInternalMentorMessage({ type: 'error', text: 'Error downloading template: ' + error.message }); }
  };

  const UploadSection = ({ title, subtitle, templateLabel, fileInputLabel, onDownloadTemplate, fileState, onFileChange, onParse, isParsing, parseLabel, parsedRows, previewColumns, onImport, isImporting, importLabel, alertMsg, existingList, existingLoading, existingLabel }) => (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-title">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="section-card-body space-y-6">
        {alertMsg.text && (
          <div className={`alert-${alertMsg.type === 'success' ? 'success' : alertMsg.type === 'warning' ? 'warning' : 'error'}`}>
            <div className="whitespace-pre-wrap">{alertMsg.text}</div>
          </div>
        )}

        {/* Step 1 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 1 — Download Template</p>
          <p className="text-sm text-gray-600 mb-3">Download the Excel template to see the required column format.</p>
          <button onClick={onDownloadTemplate} className="btn-secondary">{templateLabel}</button>
        </div>

        <hr className="border-gray-100" />

        {/* Step 2 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 2 — Upload File</p>
          <label className="form-label">{fileInputLabel}</label>
          <div className="flex gap-3 items-start flex-wrap">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={onFileChange}
              className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
            />
            <button onClick={onParse} disabled={!fileState || isParsing} className="btn-primary">
              {isParsing ? 'Parsing...' : (parseLabel || 'Parse File')}
            </button>
          </div>
          {fileState && <p className="mt-1.5 text-xs text-gray-500">{fileState.name} ({(fileState.size / 1024).toFixed(1)} KB)</p>}
        </div>

        {/* Step 3 */}
        {parsedRows.length > 0 && (
          <>
            <hr className="border-gray-100" />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 3 — Preview & Import</p>
              <p className="text-sm text-gray-600 mb-3">
                {parsedRows.length} records ready to import.
                {parsedRows.length > 10 ? ` Showing first 10 of ${parsedRows.length}.` : ''}
              </p>
              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded border border-gray-200 mb-4">
                <table className="data-table">
                  <thead>
                    <tr>{previewColumns.map(col => <th key={col.key}>{col.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i}>{previewColumns.map(col => <td key={col.key}>{row[col.key]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={onImport} disabled={isImporting} className="btn-primary">
                {isImporting ? 'Importing...' : (importLabel || 'Import to Database')}
              </button>
            </div>
          </>
        )}

        <hr className="border-gray-100" />

        {/* Existing Records List */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{existingLabel} ({existingList.length})</p>
          {existingLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><div className="loading-spinner"></div> Loading records...</div>
          ) : existingList.length > 0 ? (
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded border border-gray-200">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {previewColumns.map(col => <th key={col.key}>{col.label}</th>)}
                    <th>Added On</th>
                  </tr>
                </thead>
                <tbody>
                  {existingList.map((item, i) => (
                    <tr key={item._id}>
                      <td>{i + 1}</td>
                      {previewColumns.map(col => <td key={col.key}>{item[col.key]}</td>)}
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No records found. Upload a file to import records.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Import Center</h1>
          <p className="page-subtitle">Import student internship records and evaluator data from Excel files</p>
        </div>
      </div>

      {/* Section 1 — Student Data */}
      <div className="section-card mb-6">
        <div className="section-card-header">
          <h2 className="section-title">Student Internship Records</h2>
          <p className="text-sm text-gray-500">Import student data from Excel (.xlsx / .xls, max 5 MB)</p>
        </div>
        <div className="section-card-body space-y-6">
          {message.text && (
            <div className={`alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : 'error'}`}>
              <div className="whitespace-pre-wrap">{message.text}</div>
            </div>
          )}

          {companySuggestions.length > 0 && (
            <div className="alert-warning">
              <div className="font-semibold">Possible duplicate company names detected:</div>
              <ul className="mt-2 space-y-1 text-sm">
                {companySuggestions.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
              <div className="text-xs text-gray-600 mt-2">
                Review these before importing to keep analytics accurate.
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 1 — Download Template</p>
            <p className="text-sm text-gray-600 mb-3">Download the template to see required column headers and format.</p>
            <button onClick={handleDownloadTemplate} className="btn-secondary">Download Student Data Template</button>
          </div>

          <hr className="border-gray-100" />

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 2 — Upload File</p>
            <label className="form-label">Select Excel File</label>
            <div className="flex gap-3 items-start flex-wrap">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
              />
              <button onClick={handleParseFile} disabled={!file || loading} className="btn-primary">
                {loading ? 'Parsing...' : 'Parse File'}
              </button>
            </div>
            {file && <p className="mt-1.5 text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
          </div>

          {parsedData.length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 3 — Review what will change</p>

                <fieldset>
                  <legend className="form-label">Students who already exist</legend>
                  <div className="flex flex-col gap-1 text-sm text-gray-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={importMode === 'add-only'}
                        onChange={() => handleModeChange('add-only')}
                      />
                      Add new students only. Existing students are not changed. (Recommended)
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={importMode === 'update'}
                        onChange={() => handleModeChange('update')}
                      />
                      Also update existing students with the details shown below
                    </label>
                  </div>
                </fieldset>

                {previewing && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="loading-spinner" style={{ width: '18px', height: '18px' }} />
                    Checking {parsedData.length} rows against the database...
                  </div>
                )}

                {preview && !previewing && (
                  <>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="badge-green">{preview.summary.new} new</span>
                      <span className="badge-blue">
                        {preview.summary.changed} with different details
                        {importMode === 'add-only' && preview.summary.changed > 0 ? ' (not changed)' : ''}
                      </span>
                      <span className="badge-gray">{preview.summary.unchanged} unchanged</span>
                      {preview.summary.inRecycleBin > 0 && (
                        <span className="badge-gray">{preview.summary.inRecycleBin} in Recycle Bin (skipped)</span>
                      )}
                      {preview.summary.errors > 0 && <span className="badge-red">{preview.summary.errors} with errors</span>}
                    </div>

                    {preview.changedStudents.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          {importMode === 'update' ? 'These changes will be saved:' : 'Differences found (shown for information; nothing will change):'}
                        </p>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto rounded border border-gray-200">
                          <table className="data-table">
                            <thead>
                              <tr><th>UID</th><th>Name</th><th>Field</th><th>Now</th><th>In the sheet</th></tr>
                            </thead>
                            <tbody>
                              {preview.changedStudents.flatMap((student) => student.diffs.map((diff, i) => (
                                <tr key={`${student.uid}-${diff.field}`}>
                                  <td>{i === 0 ? student.uid : ''}</td>
                                  <td>{i === 0 ? student.name : ''}</td>
                                  <td>{diff.field}</td>
                                  <td className="text-gray-500">{formatValue(diff.from)}</td>
                                  <td className="font-medium">{formatValue(diff.to)}</td>
                                </tr>
                              )))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {preview.newStudents.length > 0 && (
                      <p className="text-sm text-gray-600">
                        New: {preview.newStudents.slice(0, 15).map((s) => s.uid).join(', ')}
                        {preview.newStudents.length > 15 ? ` and ${preview.summary.new - 15} more` : ''}
                      </p>
                    )}

                    {preview.inRecycleBin.length > 0 && (
                      <div className="alert-warning text-sm">
                        In the Recycle Bin, so skipped: {preview.inRecycleBin.map((s) => s.uid).join(', ')}.
                        An administrator can restore them first if they should be updated.
                      </div>
                    )}

                    {preview.errors.length > 0 && (
                      <div className="alert-error text-sm">
                        <div className="font-semibold mb-1">Rows that cannot be imported:</div>
                        <ul className="space-y-0.5">
                          {preview.errors.slice(0, 20).map((err) => (
                            <li key={`${err.row}-${err.uid}`}>Row {err.row}{err.uid ? ` (${err.uid})` : ''}: {err.message}</li>
                          ))}
                        </ul>
                        <label className="flex items-center gap-2 mt-2">
                          <input type="checkbox" checked={acceptErrors} onChange={(e) => setAcceptErrors(e.target.checked)} />
                          Skip these {preview.summary.errors} rows and import the rest
                        </label>
                      </div>
                    )}

                    {preview.ignoredFields?.length > 0 && (
                      <div className="alert-info text-sm">
                        Ignored columns: {preview.ignoredFields.join(', ')}. Marks can only be set through Evaluation Marks Import.
                      </div>
                    )}

                    <button
                      onClick={handleImport}
                      disabled={
                        importing
                        || (preview.summary.errors > 0 && !acceptErrors)
                        || (preview.summary.new === 0 && (importMode === 'add-only' || preview.summary.willUpdate === 0))
                      }
                      className="btn-primary"
                    >
                      {importing
                        ? 'Importing...'
                        : `Import ${preview.summary.new} new${importMode === 'update' ? `, update ${preview.summary.willUpdate}` : ''}`}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {lastImport && !lastImport.undoneAt && (
            <>
              <hr className="border-gray-100" />
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                <span>
                  Last import: {new Date(lastImport.createdAt).toLocaleString()} by {lastImport.createdBy}
                  {' '}({lastImport.counts?.inserted || 0} added, {lastImport.counts?.updated || 0} updated)
                </span>
                <button onClick={handleUndoImport} disabled={undoing} className="btn-secondary">
                  {undoing ? 'Undoing...' : 'Undo last import'}
                </button>
              </div>
            </>
          )}

          <hr className="border-gray-100" />
          <div className="alert-info">
            <strong>How importing works:</strong> UID is required for every row. Nothing is saved until you review the preview and click Import.
            Blank cells never erase existing data, and marks cannot be changed from this page. Max file size 5 MB.
          </div>
        </div>
      </div>

      {/* Section 2 — External Evaluators */}
      <UploadSection
        title="External Evaluators (Industry)"
        subtitle="Import external evaluators from Excel"
        templateLabel="Download External Evaluator Template"
        fileInputLabel="Select Excel File"
        onDownloadTemplate={handleDownloadExternalMentorTemplate}
        fileState={externalMentorFile}
        onFileChange={handleExternalMentorFileChange}
        onParse={handleParseExternalMentorFile}
        isParsing={externalMentorLoading}
        parsedRows={parsedExternalMentors}
        previewColumns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }]}
        onImport={handleImportExternalMentors}
        isImporting={externalMentorImporting}
        importLabel="Import External Evaluators"
        alertMsg={externalMentorMessage}
        existingList={externalMentorList}
        existingLoading={loadingExternalMentorList}
        existingLabel="Current External Evaluators"
      />

      {/* Section 3 — Internal Examiners */}
      <div className="mt-6">
        <UploadSection
          title="Internal Examiners (Faculty)"
          subtitle="Import internal examiners from Excel"
          templateLabel="Download Internal Examiner Template"
          fileInputLabel="Select Excel File"
          onDownloadTemplate={handleDownloadInternalMentorTemplate}
          fileState={internalMentorFile}
          onFileChange={handleInternalMentorFileChange}
          onParse={handleParseInternalMentorFile}
          isParsing={internalMentorLoading}
          parsedRows={parsedInternalMentors}
          previewColumns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }]}
          onImport={handleImportInternalMentors}
          isImporting={internalMentorImporting}
          importLabel="Import Internal Examiners"
          alertMsg={internalMentorMessage}
          existingList={internalMentorList}
          existingLoading={loadingInternalMentorList}
          existingLabel="Current Internal Examiners"
        />
      </div>
    </div>
  );
};

export default ExcelUpload;