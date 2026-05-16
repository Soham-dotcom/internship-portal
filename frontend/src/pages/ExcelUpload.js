import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { normalizeCompanyName, similarityScore } from '../utils/companyNormalization';
import { 
  importData, 
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

  useEffect(() => { fetchExternalMentors(); fetchInternalMentors(); }, []);

  const fetchExternalMentors = async () => {
    setLoadingExternalMentorList(true);
    try {
      const response = await getExternalMentors();
      if (response.data.success) setExternalMentorList(response.data.data);
    } catch (error) { console.error('Error fetching external mentors:', error); }
    finally { setLoadingExternalMentorList(false); }
  };

  const fetchInternalMentors = async () => {
    setLoadingInternalMentorList(true);
    try {
      const response = await getInternalMentors();
      if (response.data.success) setInternalMentorList(response.data.data);
    } catch (error) { console.error('Error fetching internal mentors:', error); }
    finally { setLoadingInternalMentorList(false); }
  };

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

  const handleParseFile = () => {
    if (!file) { setMessage({ type: 'error', text: 'Please select a file first' }); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);
        if (json.length === 0) { setMessage({ type: 'error', text: 'Excel file is empty' }); setLoading(false); return; }
        const mapped = json.map((row, idx) => {
          const rawUid = row['UID']
            || row['uid']
            || row['Roll No']
            || row['Roll No.']
            || row['roll no']
            || row['roll no.']
            || row['Sr No']
            || row['Sr No.']
            || row['S.No']
            || row['S No']
            || row['sr no']
            || row['s.no']
            || '';
          const uid = String(rawUid || '').trim() || `AUTO-${idx + 1}`;
          if (!rawUid) console.warn(`Row ${idx + 1}: Missing UID, using ${uid}`);
          const companyName = row['8th Sem Internship Offer'] || row['Company Name'] || row['companyName'] || row['company'] || row['Placement Offer'] || '';
          const standardized_company_name = normalizeCompanyName(companyName);
          return {
            email: row['Institute Email ID'] || row['Personal Email ID'] || row['Email'] || row['email'] || '',
            name: row['Name'] || row['name'] || row['Student Name'] || '',
            uid,
            branch: row['Branch'] || row['branch'] || '',
            internshipType: row['Internship Type'] || row['internshipType'] || '8th Sem',
            companyName,
            standardized_company_name,
            externalMentorName: row['External Mentor Name'] || row['externalMentorName'] || '',
            startDate: row['Start Date'] || row['startDate'] || new Date(),
            endDate: row['End Date'] || row['endDate'] || new Date(),
            documentLink: row['8th Sem Internship Offer Letter'] || row['Document Link'] || row['documentLink'] || '',
            companyLocation: row['Company Location'] || row['companyLocation'] || '',
            internshipTitle: row['Role'] || row['Internship Title'] || row['internshipTitle'] || row['Profile'] || row['profile'] || '',
            profile: row['Profile'] || row['profile'] || row['Tech/Non-Tech'] || row['Tech Non Tech'] || row['Role Type'] || row['role type'] || '',
            stipend: row['8th Sem Internship Stipend'] || row['Stipend'] || row['stipend'] || '',
            gender: row['Gender'] || row['gender'] || '',
            phone: row['Mobile No.'] || row['Phone'] || row['phone'] || '',
            ctc: row['CTC (LPA)'] || row['CTC'] || row['ctc'] || '',
            placementOffer: row['Placement Offer'] || row['placementOffer'] || '',
            remarks: row['Remarks'] || row['remarks'] || '',
            submittedAt: row['Submitted At'] || new Date()
          };
        });
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
        setMessage({ type: 'success', text: `Parsed ${mapped.length} records from ${json.length} rows.` });
      } catch (error) { setMessage({ type: 'error', text: 'Error parsing file: ' + error.message }); }
      finally { setLoading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) { setMessage({ type: 'error', text: 'No data to import' }); return; }
    setImporting(true);
    try {
      const response = await importData(parsedData);
      if (response.data.success) {
        let text = response.data.message;
        if (response.data.inserted !== undefined) {
          text += `\n${response.data.inserted} new records created, ${response.data.updated} updated`;
          if (response.data.failed > 0) text += `, ${response.data.failed} failed`;
        }
        if (response.data.errors?.length > 0) text += '\nErrors:\n' + response.data.errors.join('\n');
        setMessage({ type: response.data.failed > 0 ? 'warning' : 'success', text });
        setParsedData([]); setCompanySuggestions([]); setFile(null);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error importing data: ' + (error.response?.data?.message || error.message) });
    } finally { setImporting(false); }
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
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 3 — Preview & Import</p>
                <p className="text-sm text-gray-600 mb-3">
                  {parsedData.length} valid records ready.{parsedData.length > 10 ? ` Showing first 10 of ${parsedData.length}.` : ''}
                </p>
                <div className="overflow-x-auto max-h-64 overflow-y-auto rounded border border-gray-200 mb-4">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>UID</th><th>Branch</th><th>Company</th><th>Placement Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 10).map((item, i) => (
                        <tr key={i}>
                          <td>{item.name}</td><td>{item.uid}</td>
                          <td><span className="badge badge-blue">{item.branch}</span></td>
                          <td>{item.companyName}</td><td>{item.internshipType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={handleImport} disabled={importing} className="btn-primary">
                  {importing ? 'Importing...' : 'Import to Database'}
                </button>
              </div>
            </>
          )}

          <hr className="border-gray-100" />
          <div className="alert-info">
            <strong>Format requirements:</strong> UID is required. Branch must be COMPS, EXTC, CSE, MCA, AIML, IT, MECH, or ETRX. Rows without UID and Company will be skipped. Max file size 5 MB.
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
        previewColumns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }]}
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
          previewColumns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }]}
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