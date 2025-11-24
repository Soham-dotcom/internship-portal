import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { importData, downloadTemplate } from '../api/axios';

const ExcelUpload = () => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage({ type: '', text: '' });
    }
  };

  const handleParseFile = () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        // Map to internship schema - NEW FORMAT
        const mapped = json.map((row) => ({
          email: row['Email'] || row['email'] || row['Student Email'] || '',
          name: row['Name'] || row['name'] || row['Student Name'] || '',
          uid: row['UID'] || row['uid'] || row['Roll No'] || '',
          branch: row['Branch'] || row['branch'] || '',
          internshipType: row['Internship Type'] || row['internshipType'] || row['type'] || 'Off-Campus',
          companyName: row['Company Name'] || row['companyName'] || row['company'] || '',
          externalMentorName: row['External Mentor Name'] || row['externalMentorName'] || row['Mentor Name'] || '',
          startDate: row['Start Date'] || row['startDate'] || new Date(),
          endDate: row['End Date'] || row['endDate'] || new Date(),
          documentLink: row['Document Link'] || row['documentLink'] || '',
          status: row['Status'] || row['status'] || 'pending',
          stipend: row['Stipend'] || row['stipend'] || '',
          companyLocation: row['Company Location'] || row['companyLocation'] || '',
          internshipTitle: row['Internship Title'] || row['internshipTitle'] || '',
          remarks: row['Remarks'] || row['remarks'] || '',
          submittedAt: row['Submitted At'] || new Date()
        }));

        setParsedData(mapped);
        setMessage({
          type: 'success',
          text: `Successfully parsed ${mapped.length} records`,
        });
      } catch (error) {
        setMessage({ type: 'error', text: 'Error parsing file: ' + error.message });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setMessage({ type: 'error', text: 'No data to import' });
      return;
    }

    setImporting(true);
    try {
      const response = await importData({ internships: parsedData });
      if (response.data.success) {
        let messageText = response.data.message;
        
        // Add detailed breakdown
        if (response.data.inserted !== undefined && response.data.updated !== undefined) {
          messageText += `\n\n📊 Breakdown:`;
          messageText += `\n✅ ${response.data.inserted} new records created`;
          messageText += `\n🔄 ${response.data.updated} existing records updated`;
          if (response.data.failed > 0) {
            messageText += `\n❌ ${response.data.failed} records failed`;
          }
        }
        
        // Add error details if some records failed
        if (response.data.errors && response.data.errors.length > 0) {
          messageText += '\n\n⚠️ Errors:\n' + response.data.errors.join('\n');
        }
        
        setMessage({
          type: response.data.failed > 0 ? 'warning' : 'success',
          text: messageText,
        });
        
        // Clear data after successful import (even if some failed)
        setParsedData([]);
        setFile(null);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error importing data: ' + (error.response?.data?.message || error.message),
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'internship_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error downloading template: ' + error.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Excel File</h1>
        <p className="mt-2 text-gray-600">
          Import student internship records from Excel file
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : message.type === 'warning'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.text}</div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 1: Download Template
          </h2>
          <p className="text-gray-600 mb-4">
            Download the Excel template to see the required format and column headers.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📥 Download Excel Template
          </button>
        </div>

        <hr />

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 2: Upload Your File
          </h2>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            <button
              onClick={handleParseFile}
              disabled={!file || loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Parsing...' : 'Parse File'}
            </button>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {parsedData.length > 0 && (
          <>
            <hr />

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Step 3: Preview & Import
              </h2>
              <p className="text-gray-600 mb-4">
                Found {parsedData.length} records. Review and click Import to add them
                to the database.
              </p>

              {/* Preview Table */}
              <div className="overflow-x-auto mb-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        UID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Branch
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Company
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedData.slice(0, 10).map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.uid}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.branch}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.companyName}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.internshipType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedData.length > 10 && (
                <p className="text-sm text-gray-500 mb-4">
                  Showing first 10 of {parsedData.length} records
                </p>
              )}

              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : '✓ Import to Database'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📋 Instructions
        </h3>
        <ul className="space-y-2 text-blue-800">
          <li>• Download the template to see the exact column format required</li>
          <li>• Ensure all required fields are filled (Name, Email, UID, Branch, Company, etc.)</li>
          <li>• Branch must be: COMPS, EXTC, CSE, MCA, AIML, IT, MECH, or ETRX</li>
          <li>• Internship Type: Off-Campus, On-Campus, College-Arranged, or Self-Arranged</li>
          <li>• Status must be: pending, approved, in-progress, completed, or rejected</li>
          <li>• Dates should be in standard date format (e.g., 2025-01-01)</li>
          <li>• UID format: 10-digit number (e.g., 2021200044)</li>
        </ul>
      </div>
    </div>
  );
};

export default ExcelUpload;

