import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, FileSpreadsheet, AlertCircle, X, Moon, ArrowRight, Link as LinkIcon } from 'lucide-react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [showProceedDialog, setShowProceedDialog] = useState(false);
  const [googleFormsUrl, setGoogleFormsUrl] = useState('https://docs.google.com/forms/d/1sYOeJ_uPeKMUXQpxi8gEhwOwkJBf5Q1aU-0XPeJtUbg/edit');
  const [formFields, setFormFields] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingFields, setIsFetchingFields] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0, active: false });
  const [selectedRows, setSelectedRows] = useState([]);

  const fileInputRef = useRef(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 7000);
  };

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;

    // Check if it's an excel file
    if (!selectedFile.name.match(/\.(xls|xlsx)$/)) {
      showToast('Please upload a valid Excel file (.xls or .xlsx)');
      return;
    }

    setFile(selectedFile);
    setToastMessage(null);
    await uploadFile(selectedFile);
  };

  const uploadFile = async (fileToUpload) => {
    setLoading(true);
    setProgress(0);
    setProgressText("Uploading...");

    const formData = new FormData();
    formData.append('file', fileToUpload);

    let extractInterval;

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setProgress(percentCompleted);

          if (percentCompleted >= 50 && !extractInterval) {
            setProgressText("Extracting...");
            let currentProgress = 50;
            extractInterval = setInterval(() => {
              currentProgress += 2;
              if (currentProgress > 90) {
                clearInterval(extractInterval);
              } else {
                setProgress(currentProgress);
              }
            }, 150);
          }
        }
      });

      clearInterval(extractInterval);
      setProgress(90);
      setProgressText("Preparing components...");

      // Artificial delay to show the final stage
      setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setData(response.data);
          setSelectedRows(response.data.data.map((_, i) => i));
          setLoading(false);
        }, 400);
      }, 600);

    } catch (err) {
      clearInterval(extractInterval);
      showToast(err.response?.data?.detail || 'An error occurred while uploading the file.');
      setData(null);
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">Task Sheets Extractor</h1>
        <p className="subtitle">Upload your Task files to instantly view and analyze the data.</p>
      </header>

      {!data && (
        <div
          className={`upload-card ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <UploadCloud className="upload-icon" />
          <h2 className="upload-text">Drag & Drop your Task Sheet here</h2>
          <p className="upload-hint">Supports .xls and .xlsx formats</p>

          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            accept=".xls,.xlsx"
            onChange={(e) => handleFileChange(e.target.files[0])}
          />

          <button
            className="upload-button"
            onClick={() => fileInputRef.current.click()}
          >
            Browse Files
          </button>

          {loading && (
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                <span>{progressText}</span>
                <span className="progress-percentage">{progress}%</span>
              </div>
            </div>
          )}


        </div>
      )}

      {data && (
        <div className="table-container">
          <div className="table-header">
            <div className="table-title">
              <FileSpreadsheet size={24} color="var(--accent)" />
              Extracted Data
              <span className="file-badge">{data.filename}</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="upload-button"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem', background: 'var(--surface-bg)', color: 'var(--primary)', border: '1px solid var(--primary)', boxShadow: 'none' }}
                onClick={() => {
                  setData(null);
                  setFile(null);
                  setSelectedRows([]);
                }}
              >
                Upload Another
              </button>
              <button
                className="upload-button"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => setShowProceedDialog(true)}
              >
                Proceed <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={data.data.length > 0 && selectedRows.length === data.data.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(data.data.map((_, i) => i));
                        } else {
                          setSelectedRows([]);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ width: '50px' }}>No.</th>
                  {data.columns.map((col, index) => (
                    <th key={index}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row, rowIndex) => (
                  <tr key={rowIndex} className={selectedRows.includes(rowIndex) ? 'selected-row' : ''} style={selectedRows.includes(rowIndex) ? { backgroundColor: 'rgba(99, 102, 241, 0.05)' } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(rowIndex)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows([...selectedRows, rowIndex]);
                          } else {
                            setSelectedRows(selectedRows.filter(i => i !== rowIndex));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{rowIndex + 1}</td>
                    {data.columns.map((col, colIndex) => (
                      <td key={colIndex}>
                        {row[col] !== null ? String(row[col]) : <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={data.columns.length + 2} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No data found in this task.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <AlertCircle size={20} color="#ef4444" />
            <span className="toast-message">{toastMessage}</span>
            <button className="toast-close" onClick={() => setToastMessage(null)}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>&copy; 2026 Task Sheets Extractor</p>
      </footer>

      {showProceedDialog && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              <h3 className="dialog-title">Auto Key-in to Google Forms</h3>
              <button className="toast-close" onClick={() => {
                if (submitProgress.active) return;
                setShowProceedDialog(false);
                setFormFields(null);
                setFieldMapping({});
                setShowConfirmation(false);
                setSubmitProgress({ current: 0, total: 0, active: false });
              }}>
                <X size={20} />
              </button>
            </div>
            <div className="dialog-body">
              {!formFields ? (
                <>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    Enter the Google Forms URL where you want the extracted data to be automatically keyed in.
                  </p>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <LinkIcon size={18} className="input-icon" />
                    <input
                      type="url"
                      className="url-input"
                      style={{ paddingRight: '2rem' }}
                      placeholder="https://docs.google.com/forms/d/e/.../viewform"
                      value={googleFormsUrl}
                      onChange={(e) => setGoogleFormsUrl(e.target.value)}
                      autoFocus
                    />
                    {googleFormsUrl && (
                      <button
                        type="button"
                        onClick={() => setGoogleFormsUrl('')}
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          height: '100%'
                        }}
                      >
                        <X size={16} color="var(--text-secondary)" />
                      </button>
                    )}
                  </div>
                </>
              ) : !showConfirmation ? (
                <div className="mapping-container">
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    Map your Excel columns to the corresponding Google Form fields.
                  </p>
                  <div className="mapping-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {formFields.map(field => (
                      <div key={field.id} style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {field.label}
                        </label>
                        <select
                          className="url-input"
                          style={{ padding: '0.6rem 1rem' }}
                          value={fieldMapping[field.id] || ""}
                          onChange={(e) => setFieldMapping({ ...fieldMapping, [field.id]: e.target.value })}
                        >
                          <option value="">-- Ignore this field --</option>
                          {data.columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="confirmation-container" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  {!submitProgress.active ? (
                    <>
                      <AlertCircle size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                      <h4 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                        Are you sure to fill the form with {selectedRows.length} items?
                      </h4>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        This will automatically submit {selectedRows.length} responses to the connected Google Form.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="progress-container" style={{ margin: '2rem 0' }}>
                        <div className="progress-bar-bg" style={{ height: '12px' }}>
                          <div
                            className="progress-bar-fill"
                            style={{ 
                              width: `${(submitProgress.current / submitProgress.total) * 100}%`, 
                              height: '100%',
                              transition: 'width 0.3s ease-out' 
                            }}
                          ></div>
                        </div>
                        <div className="progress-text" style={{ marginTop: '1rem', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                          <span>Submitting...</span>
                          <span className="progress-percentage">{submitProgress.current} / {submitProgress.total}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowProceedDialog(false);
                  setFormFields(null);
                  setFieldMapping({});
                  setShowConfirmation(false);
                  setSubmitProgress({ current: 0, total: 0, active: false });
                }}
                disabled={isSubmitting || isFetchingFields || submitProgress.active}
              >
                Cancel
              </button>

              {!formFields ? (
                <button
                  className="upload-button"
                  style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}
                  disabled={isFetchingFields}
                  onClick={async () => {
                    if (!googleFormsUrl) {
                      showToast('Please enter a Google Forms URL first');
                      return;
                    }
                    if (!googleFormsUrl.includes('docs.google.com/forms/') && !googleFormsUrl.includes('forms.gle/')) {
                      showToast('Please enter a valid Google Forms URL');
                      return;
                    }
                    setIsFetchingFields(true);
                    try {
                      const res = await axios.post('http://127.0.0.1:8000/api/fetch-form-fields', { url: googleFormsUrl });
                      const fetchedFields = res.data.fields;
                      const initialMapping = {};
                      
                      // Auto-map based on exact or case-insensitive match, ignoring punctuation
                      fetchedFields.forEach((field, index) => {
                        const cleanStr = str => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
                        let matchedCol = data.columns.find(
                          col => cleanStr(col) === cleanStr(field.label)
                        );
                        
                        // Fix for the specific form typo: Second 'Priority' field is actually 'Status'
                        if (field.label === 'Priority' && index === 4) {
                           matchedCol = data.columns.find(c => cleanStr(c) === 'status');
                        }
                        
                        // Fallback to order-based mapping
                        if (!matchedCol && index < data.columns.length) {
                          matchedCol = data.columns[index];
                        }

                        if (matchedCol) {
                          initialMapping[field.id] = matchedCol;
                        }
                      });
                      
                      setFieldMapping(initialMapping);
                      setFormFields(fetchedFields);
                    } catch (err) {
                      showToast(err.response?.data?.detail || 'Failed to fetch form fields.');
                    } finally {
                      setIsFetchingFields(false);
                    }
                  }}
                >
                  {isFetchingFields ? 'Fetching...' : 'Next'}
                </button>
              ) : !showConfirmation ? (
                <button
                  className="upload-button"
                  style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}
                  onClick={() => {
                    if (selectedRows.length === 0) {
                      showToast('Please select at least one row to submit.');
                      return;
                    }
                    setShowConfirmation(true);
                  }}
                >
                  Review & Submit
                </button>
              ) : !submitProgress.active ? (
                <button
                  className="upload-button"
                  style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}
                  disabled={isSubmitting}
                  onClick={async () => {
                    setIsSubmitting(true);
                    setSubmitProgress({ current: 0, total: selectedRows.length, active: true });
                    let successCount = 0;
                    let lastError = null;
                    try {
                      for (let i = 0; i < selectedRows.length; i++) {
                        const rowIndex = selectedRows[i];
                        const res = await axios.post('http://127.0.0.1:8000/api/submit-form', {
                          url: googleFormsUrl,
                          data: [data.data[rowIndex]],
                          mapping: fieldMapping,
                          types: Object.fromEntries(formFields.map(f => [f.id, f.type]))
                        });
                        if (res.data.submitted_count > 0) {
                          successCount += res.data.submitted_count;
                        }
                        if (res.data.errors && res.data.errors.length > 0) {
                          console.error(`Submission error for row ${rowIndex + 1}:`, res.data.errors);
                          lastError = res.data.errors[0];
                        }
                        setSubmitProgress({ current: i + 1, total: selectedRows.length, active: true });
                      }
                      if (successCount === 0 && lastError) {
                         showToast(`Failed to key in. Server says: ${lastError}`);
                      } else if (successCount < selectedRows.length) {
                         showToast(`Keyed in ${successCount} items. ${selectedRows.length - successCount} failed (Check console).`);
                      } else {
                         showToast(`Successfully keyed in ${successCount} items!`);
                      }
                      setShowProceedDialog(false);
                      setFormFields(null);
                      setFieldMapping({});
                      setShowConfirmation(false);
                      setSubmitProgress({ current: 0, total: 0, active: false });
                    } catch (err) {
                      showToast('Error during auto key-in.');
                      setSubmitProgress((prev) => ({ ...prev, active: false }));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  Start
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
