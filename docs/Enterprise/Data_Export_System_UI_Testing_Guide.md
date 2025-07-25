# Data Export System - UI Testing Guide

## Overview
This document provides comprehensive guidance for UI developers to test the Data Export System endpoints during end-to-end testing. This system provides CSV export functionality for team data at enterprise, department, and individual team levels with proper file download handling.

## Base Configuration

### Server URL
```
Base URL: http://localhost:8383
```

### Authentication
All endpoints require Firebase ID token in the Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${firebaseIdToken}`,
  'Content-Type': 'application/json'
}
```

### Response Format
Export endpoints return CSV data with appropriate headers for file download:
```javascript
// CSV Response Headers
'Content-Type': 'text/csv'
'Content-Disposition': 'attachment; filename="filename.csv"'
```

### Export System Features
- **CSV Export**: Standardized CSV format for data export
- **File Download**: Proper file download headers and naming
- **Multi-level Export**: Enterprise, department, and individual team exports
- **Activity Logging**: All exports are logged for audit purposes
- **Error Handling**: Comprehensive error handling with proper status codes

---

## 1. Authentication Setup

### Get Firebase ID Token
```javascript
// Using Firebase Auth
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(
  auth, 
  'testehakke@gufum.com', 
  '123456'
);

const idToken = await userCredential.user.getIdToken();
```

### Test Authentication
```javascript
const testAuth = async () => {
  try {
    const response = await fetch('http://localhost:8383/SignIn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testehakke@gufum.com',
        password: '123456'
      })
    });
    
    const result = await response.json();
    console.log('Auth Result:', result);
    return result.token;
  } catch (error) {
    console.error('Authentication failed:', error);
  }
};
```

---

## 2. Export Endpoints

### 2.1 Export All Teams for Enterprise
```javascript
const exportAllTeams = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/exports/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Export failed');
    }
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition ? 
      contentDisposition.split('filename=')[1]?.replace(/"/g, '') : 
      `all_teams_${enterpriseId}_${Date.now()}.csv`;
    
    const csvData = await response.text();
    console.log('Export successful, filename:', filename);
    
    return { csvData, filename };
  } catch (error) {
    console.error('Failed to export teams:', error);
    throw error;
  }
};
```

**Usage:**
```javascript
const { csvData, filename } = await exportAllTeams(token, 'x-spark-test');
```

**Expected Response:**
```csv
ID,Name,Description,Department,Member Count,Has Leader,Leader Name,Created Date,Last Updated
mechanical,Mechanical,"Responsible for designing, coding, and testing software applications",Engineering,5,No,None,2025-04-03,2025-04-27
digital-sales,Digital Sales,"Responsible for designing, coding, and testing software applications",sales,11,No,None,2025-04-02,2025-05-03
software-development,Software Development,Updated description for the team,sales,2,Yes,None,2025-04-02,2025-04-02
ui-test-team,UI Test Team,Team created via UI testing,testDep,0,No,None,2025-07-24,2025-07-24
```

### 2.2 Export Teams for Specific Department
```javascript
const exportDepartmentTeams = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/exports/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Export failed');
    }
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition ? 
      contentDisposition.split('filename=')[1]?.replace(/"/g, '') : 
      `teams_${enterpriseId}_${departmentId}_${Date.now()}.csv`;
    
    const csvData = await response.text();
    console.log('Export successful, filename:', filename);
    
    return { csvData, filename };
  } catch (error) {
    console.error('Failed to export department teams:', error);
    throw error;
  }
};
```

**Usage:**
```javascript
const { csvData, filename } = await exportDepartmentTeams(token, 'x-spark-test', 'testdep');
```

**Expected Response:**
```csv
ID,Name,Description,Department,Member Count,Has Leader,Leader Name,Created Date,Last Updated
ui-test-team,UI Test Team,Team created via UI testing,testDep,0,No,None,2025-07-24,2025-07-24
```

### 2.3 Export Individual Team
```javascript
const exportIndividualTeam = async (token, enterpriseId, departmentId, teamId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/exports/teams/${teamId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Export failed');
    }
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition ? 
      contentDisposition.split('filename=')[1]?.replace(/"/g, '') : 
      `team_${teamId}_${Date.now()}.csv`;
    
    const csvData = await response.text();
    console.log('Export successful, filename:', filename);
    
    return { csvData, filename };
  } catch (error) {
    console.error('Failed to export individual team:', error);
    throw error;
  }
};
```

**Usage:**
```javascript
const { csvData, filename } = await exportIndividualTeam(token, 'x-spark-test', 'testdep', 'ui-test-team');
```

**Expected Response:**
```csv
ID,Name,Description,Department,Member Count,Has Leader,Leader Name,Created Date,Last Updated
ui-test-team,UI Test Team,Team created via UI testing,testDep,0,No,None,2025-07-24,2025-07-24
```

---

## 3. File Download Handling

### 3.1 Download CSV File
```javascript
const downloadCSV = (csvData, filename) => {
  // Create blob from CSV data
  const blob = new Blob([csvData], { type: 'text/csv' });
  
  // Create download link
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
```

### 3.2 Parse CSV Data
```javascript
const parseCSV = (csvData) => {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',');
      const row = {};
      
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      
      data.push(row);
    }
  }
  
  return data;
};
```

### 3.3 Complete Export with Download
```javascript
const exportAndDownload = async (token, enterpriseId, departmentId = null, teamId = null) => {
  try {
    let result;
    
    if (teamId && departmentId) {
      // Export individual team
      result = await exportIndividualTeam(token, enterpriseId, departmentId, teamId);
    } else if (departmentId) {
      // Export department teams
      result = await exportDepartmentTeams(token, enterpriseId, departmentId);
    } else {
      // Export all enterprise teams
      result = await exportAllTeams(token, enterpriseId);
    }
    
    // Download the file
    downloadCSV(result.csvData, result.filename);
    
    // Parse and return data for UI display
    const parsedData = parseCSV(result.csvData);
    
    return {
      success: true,
      filename: result.filename,
      data: parsedData,
      rowCount: parsedData.length
    };
  } catch (error) {
    console.error('Export and download failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

---

## 4. Complete UI Testing Workflow

### 4.1 Setup Function
```javascript
const setupExportTesting = async () => {
  // 1. Authenticate
  const token = await testAuth();
  if (!token) {
    console.error('Authentication failed');
    return null;
  }
  
  console.log('✅ Authentication successful');
  return token;
};
```

### 4.2 Export Testing Workflow
```javascript
const testExportSystem = async (token, enterpriseId, departmentId, teamId) => {
  console.log('🧪 Testing Data Export System...');
  
  // 1. Export all teams for enterprise
  const allTeamsResult = await exportAndDownload(token, enterpriseId);
  console.log('✅ All teams exported:', allTeamsResult.rowCount, 'teams');
  
  // 2. Export teams for specific department
  const deptTeamsResult = await exportAndDownload(token, enterpriseId, departmentId);
  console.log('✅ Department teams exported:', deptTeamsResult.rowCount, 'teams');
  
  // 3. Export individual team
  const individualTeamResult = await exportAndDownload(token, enterpriseId, departmentId, teamId);
  console.log('✅ Individual team exported:', individualTeamResult.rowCount, 'teams');
  
  return {
    allTeams: allTeamsResult,
    departmentTeams: deptTeamsResult,
    individualTeam: individualTeamResult
  };
};
```

### 4.3 Error Handling Testing Workflow
```javascript
const testExportErrorHandling = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Export Error Handling...');
  
  // 1. Test non-existent enterprise
  try {
    await exportAllTeams(token, 'non-existent-enterprise');
  } catch (error) {
    console.log('✅ Non-existent enterprise error handled:', error.message);
  }
  
  // 2. Test non-existent department
  try {
    await exportDepartmentTeams(token, enterpriseId, 'non-existent-department');
  } catch (error) {
    console.log('✅ Non-existent department error handled:', error.message);
  }
  
  // 3. Test non-existent team
  try {
    await exportIndividualTeam(token, enterpriseId, departmentId, 'non-existent-team');
  } catch (error) {
    console.log('✅ Non-existent team error handled:', error.message);
  }
  
  // 4. Test invalid authentication
  try {
    await exportAllTeams('invalid-token', enterpriseId);
  } catch (error) {
    console.log('✅ Invalid authentication error handled:', error.message);
  }
};
```

### 4.4 Performance Testing Workflow
```javascript
const testExportPerformance = async (token, enterpriseId, departmentId, teamId) => {
  console.log('⚡ Testing Export Performance...');
  
  const iterations = 3;
  const times = {
    allTeams: [],
    departmentTeams: [],
    individualTeam: []
  };
  
  for (let i = 0; i < iterations; i++) {
    // Test all teams export
    const start1 = performance.now();
    await exportAllTeams(token, enterpriseId);
    const end1 = performance.now();
    times.allTeams.push(end1 - start1);
    
    // Test department teams export
    const start2 = performance.now();
    await exportDepartmentTeams(token, enterpriseId, departmentId);
    const end2 = performance.now();
    times.departmentTeams.push(end2 - start2);
    
    // Test individual team export
    const start3 = performance.now();
    await exportIndividualTeam(token, enterpriseId, departmentId, teamId);
    const end3 = performance.now();
    times.individualTeam.push(end3 - start3);
  }
  
  // Calculate averages
  const avgAllTeams = times.allTeams.reduce((a, b) => a + b, 0) / times.allTeams.length;
  const avgDepartmentTeams = times.departmentTeams.reduce((a, b) => a + b, 0) / times.departmentTeams.length;
  const avgIndividualTeam = times.individualTeam.reduce((a, b) => a + b, 0) / times.individualTeam.length;
  
  console.log(`📊 Export Performance Results:`);
  console.log(`📊 All Teams Export: ${avgAllTeams.toFixed(2)}ms average`);
  console.log(`📊 Department Teams Export: ${avgDepartmentTeams.toFixed(2)}ms average`);
  console.log(`📊 Individual Team Export: ${avgIndividualTeam.toFixed(2)}ms average`);
  
  return { avgAllTeams, avgDepartmentTeams, avgIndividualTeam };
};
```

### 4.5 Complete Test Suite
```javascript
const runCompleteExportTest = async () => {
  console.log('🚀 Starting Complete Data Export System Test Suite...');
  
  try {
    // Setup
    const token = await setupExportTesting();
    if (!token) return;
    
    const enterpriseId = 'x-spark-test';
    const departmentId = 'testdep';
    const teamId = 'ui-test-team';
    
    // Run all test suites
    const exportResults = await testExportSystem(token, enterpriseId, departmentId, teamId);
    const errorResults = await testExportErrorHandling(token, enterpriseId, departmentId);
    const performanceResults = await testExportPerformance(token, enterpriseId, departmentId, teamId);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Test Results:', {
      export: exportResults,
      error: errorResults,
      performance: performanceResults
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};
```

---

## 5. Error Handling Examples

### 5.1 Enterprise Not Found
```javascript
const handleEnterpriseNotFound = (error) => {
  if (error.message.includes('Enterprise not found')) {
    console.error('Enterprise not found');
    // Show appropriate UI message
  }
};
```

### 5.2 Department Not Found
```javascript
const handleDepartmentNotFound = (error) => {
  if (error.message.includes('Department not found')) {
    console.error('Department not found');
    // Show appropriate UI message
  }
};
```

### 5.3 Team Not Found
```javascript
const handleTeamNotFound = (error) => {
  if (error.message.includes('Team not found')) {
    console.error('Team not found');
    // Show appropriate UI message
  }
};
```

### 5.4 Export Generation Error
```javascript
const handleExportError = (error) => {
  if (error.message.includes('Error generating CSV')) {
    console.error('CSV generation failed:', error.message);
    // Show error message in UI
  }
};
```

---

## 6. UI Integration Notes

### 6.1 Loading States
```javascript
const [exporting, setExporting] = useState(false);
const [exportProgress, setExportProgress] = useState(0);
const [error, setError] = useState(null);

const handleExport = async (exportType, params) => {
  setExporting(true);
  setError(null);
  setExportProgress(0);
  
  try {
    setExportProgress(25);
    
    let result;
    switch (exportType) {
      case 'all-teams':
        result = await exportAllTeams(token, params.enterpriseId);
        break;
      case 'department-teams':
        result = await exportDepartmentTeams(token, params.enterpriseId, params.departmentId);
        break;
      case 'individual-team':
        result = await exportIndividualTeam(token, params.enterpriseId, params.departmentId, params.teamId);
        break;
    }
    
    setExportProgress(75);
    
    // Download the file
    downloadCSV(result.csvData, result.filename);
    
    setExportProgress(100);
    console.log('Export completed successfully');
    
  } catch (err) {
    setError(err.message);
  } finally {
    setExporting(false);
    setExportProgress(0);
  }
};
```

### 6.2 Export Progress Indicator
```javascript
const ExportProgressIndicator = ({ exporting, progress, error }) => {
  if (error) {
    return <div className="export-error">❌ Export failed: {error}</div>;
  }
  
  if (exporting) {
    return (
      <div className="export-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <span>Exporting... {progress}%</span>
      </div>
    );
  }
  
  return null;
};
```

### 6.3 Export Options UI
```javascript
const ExportOptions = ({ enterpriseId, departmentId, teamId, onExport }) => {
  const [exportType, setExportType] = useState('all-teams');
  
  const handleExport = () => {
    const params = { enterpriseId };
    
    switch (exportType) {
      case 'department-teams':
        params.departmentId = departmentId;
        break;
      case 'individual-team':
        params.departmentId = departmentId;
        params.teamId = teamId;
        break;
    }
    
    onExport(exportType, params);
  };
  
  return (
    <div className="export-options">
      <h3>Export Teams</h3>
      
      <div className="export-type-selector">
        <label>
          <input
            type="radio"
            value="all-teams"
            checked={exportType === 'all-teams'}
            onChange={(e) => setExportType(e.target.value)}
          />
          All Teams in Enterprise
        </label>
        
        {departmentId && (
          <label>
            <input
              type="radio"
              value="department-teams"
              checked={exportType === 'department-teams'}
              onChange={(e) => setExportType(e.target.value)}
            />
            Teams in Department
          </label>
        )}
        
        {teamId && (
          <label>
            <input
              type="radio"
              value="individual-team"
              checked={exportType === 'individual-team'}
              onChange={(e) => setExportType(e.target.value)}
            />
            Individual Team
          </label>
        )}
      </div>
      
      <button onClick={handleExport} className="export-button">
        📊 Export CSV
      </button>
    </div>
  );
};
```

### 6.4 Export History
```javascript
const ExportHistory = ({ exports }) => {
  return (
    <div className="export-history">
      <h3>Recent Exports</h3>
      <div className="export-list">
        {exports.map((exportItem, index) => (
          <div key={index} className="export-item">
            <div className="export-info">
              <span className="export-type">{exportItem.type}</span>
              <span className="export-date">{exportItem.date}</span>
              <span className="export-filename">{exportItem.filename}</span>
            </div>
            <button 
              onClick={() => downloadCSV(exportItem.csvData, exportItem.filename)}
              className="download-button"
            >
              📥 Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 6.5 Complete Export Dashboard
```javascript
const ExportDashboard = ({ token, enterpriseId, departmentId, teamId }) => {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState(null);
  const [exportHistory, setExportHistory] = useState([]);
  
  const handleExport = async (exportType, params) => {
    setExporting(true);
    setError(null);
    setExportProgress(0);
    
    try {
      setExportProgress(25);
      
      let result;
      switch (exportType) {
        case 'all-teams':
          result = await exportAllTeams(token, params.enterpriseId);
          break;
        case 'department-teams':
          result = await exportDepartmentTeams(token, params.enterpriseId, params.departmentId);
          break;
        case 'individual-team':
          result = await exportIndividualTeam(token, params.enterpriseId, params.departmentId, params.teamId);
          break;
      }
      
      setExportProgress(75);
      
      // Download the file
      downloadCSV(result.csvData, result.filename);
      
      // Add to history
      setExportHistory(prev => [{
        type: exportType,
        date: new Date().toLocaleString(),
        filename: result.filename,
        csvData: result.csvData
      }, ...prev.slice(0, 9)]); // Keep last 10 exports
      
      setExportProgress(100);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };
  
  return (
    <div className="export-dashboard">
      <div className="dashboard-header">
        <h2>Team Export Dashboard</h2>
        <ExportProgressIndicator 
          exporting={exporting} 
          progress={exportProgress} 
          error={error} 
        />
      </div>
      
      <div className="dashboard-content">
        <div className="export-section">
          <ExportOptions 
            enterpriseId={enterpriseId}
            departmentId={departmentId}
            teamId={teamId}
            onExport={handleExport}
          />
        </div>
        
        <div className="history-section">
          <ExportHistory exports={exportHistory} />
        </div>
      </div>
    </div>
  );
};
```

---

## 7. Performance Optimization Tips

### 7.1 Large Dataset Handling
```javascript
// For large exports, show progress and allow cancellation
const exportLargeDataset = async (token, enterpriseId, onProgress, onCancel) => {
  const controller = new AbortController();
  
  if (onCancel) {
    onCancel(() => controller.abort());
  }
  
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/exports/teams`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    // Handle streaming for large files
    const reader = response.body.getReader();
    let csvData = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      csvData += new TextDecoder().decode(value);
      
      if (onProgress) {
        onProgress(csvData.length);
      }
    }
    
    return csvData;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Export cancelled');
    } else {
      throw error;
    }
  }
};
```

### 7.2 Export Caching
```javascript
// Cache recent exports to avoid regenerating
const exportCache = new Map();

const getCachedExport = (key) => {
  const cached = exportCache.get(key);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes
    return cached.data;
  }
  return null;
};

const setCachedExport = (key, data) => {
  exportCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

const exportWithCache = async (token, enterpriseId, departmentId = null, teamId = null) => {
  const cacheKey = `${enterpriseId}_${departmentId || 'all'}_${teamId || 'all'}`;
  
  // Check cache first
  const cached = getCachedExport(cacheKey);
  if (cached) {
    console.log('Using cached export');
    return cached;
  }
  
  // Generate new export
  let result;
  if (teamId && departmentId) {
    result = await exportIndividualTeam(token, enterpriseId, departmentId, teamId);
  } else if (departmentId) {
    result = await exportDepartmentTeams(token, enterpriseId, departmentId);
  } else {
    result = await exportAllTeams(token, enterpriseId);
  }
  
  // Cache the result
  setCachedExport(cacheKey, result);
  
  return result;
};
```

---

## 8. Testing Checklist

### ✅ Pre-Testing Setup
- [ ] Server running on localhost:8383
- [ ] Firebase authentication configured
- [ ] Test user credentials available
- [ ] Enterprise ID available (x-spark-test)
- [ ] Department ID available (testdep)
- [ ] Team ID available (ui-test-team)
- [ ] Network connectivity confirmed

### ✅ Authentication Testing
- [ ] Sign-in endpoint working
- [ ] Token retrieval successful
- [ ] Token validation working

### ✅ Export Functionality Testing
- [ ] Export all teams for enterprise
- [ ] Export teams for specific department
- [ ] Export individual team
- [ ] Verify CSV format and content
- [ ] Verify file download headers
- [ ] Verify filename generation

### ✅ Error Handling Testing
- [ ] Invalid authentication
- [ ] Enterprise not found
- [ ] Department not found
- [ ] Team not found
- [ ] CSV generation errors
- [ ] Network errors

### ✅ Performance Testing
- [ ] Response time measurements
- [ ] Large dataset handling
- [ ] File download performance
- [ ] Memory usage monitoring

### ✅ UI Integration Testing
- [ ] Loading states
- [ ] Progress indicators
- [ ] Error states
- [ ] Export options UI
- [ ] Export history
- [ ] File download handling

---

## 9. Best Practices

### 9.1 Export Naming Conventions
```javascript
// Use descriptive filenames with timestamps
const generateFilename = (type, enterpriseId, departmentId = null, teamId = null) => {
  const timestamp = new Date().toISOString().split('T')[0];
  
  switch (type) {
    case 'all-teams':
      return `all_teams_${enterpriseId}_${timestamp}.csv`;
    case 'department-teams':
      return `teams_${enterpriseId}_${departmentId}_${timestamp}.csv`;
    case 'individual-team':
      return `team_${teamId}_${timestamp}.csv`;
    default:
      return `export_${timestamp}.csv`;
  }
};
```

### 9.2 Export Data Validation
```javascript
const validateExportData = (csvData) => {
  const lines = csvData.split('\n');
  
  // Check if CSV has content
  if (lines.length < 2) {
    throw new Error('Export contains no data');
  }
  
  // Check header format
  const headers = lines[0].split(',');
  const requiredHeaders = ['ID', 'Name', 'Description', 'Department', 'Member Count'];
  
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Missing required header: ${header}`);
    }
  }
  
  return true;
};
```

### 9.3 Error Handling Patterns
```javascript
const handleExportOperation = async (operation, ...args) => {
  try {
    const result = await operation(...args);
    
    // Validate the result
    if (result.csvData) {
      validateExportData(result.csvData);
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Export operation failed:', error);
    return { 
      success: false, 
      error: error.message,
      status: error.status 
    };
  }
};
```

---

This guide provides comprehensive coverage for testing all Data Export System endpoints. The system offers robust CSV export functionality with proper file download handling, making it ideal for enterprise data export requirements. 