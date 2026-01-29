// Popup script - runs when extension popup opens

console.log('AutoApply.AI popup loaded');

// Backend API URL
const API_BASE_URL = 'http://localhost:8000';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM ready');
  
  // Initialize popup
  initializePopup();
  
  // Setup event listeners
  setupEventListeners();
});

/**
 * Initialize popup - check storage status and update UI
 */
async function initializePopup() {
  try {
    // Check storage status
    const status = await window.storage.getStorageStatus();
    
    // Update UI for each document type
    await updateDocumentUI('resume', status.resume);
    await updateDocumentUI('coverLetter', status.coverLetter);
    await updateDocumentUI('qa', status.qa);

    // Load demographics (EEO) preferences
    const demographics = await window.storage.getDemographics();
    const genderSelect = document.getElementById('demographicsGender');
    const raceSelect = document.getElementById('demographicsRace');
    const veteranSelect = document.getElementById('demographicsVeteran');
    if (genderSelect && demographics.gender) genderSelect.value = demographics.gender;
    if (raceSelect && demographics.race) raceSelect.value = demographics.race;
    if (veteranSelect && demographics.veteranStatus) veteranSelect.value = demographics.veteranStatus;

    // Load work authorization preferences
    const workAuth = await window.storage.getWorkAuthPreferences();
    const sponsorshipSelect = document.getElementById('workAuthRequiresSponsorship');
    if (sponsorshipSelect && workAuth.requiresSponsorship) sponsorshipSelect.value = workAuth.requiresSponsorship;
    
    console.log('Popup initialized with storage status:', status);
  } catch (error) {
    console.error('Error initializing popup:', error);
    showMessage('Error loading storage status', 'error');
  }
}

/**
 * Update UI for a specific document type
 * @param {string} docType - 'resume', 'coverLetter', or 'qa'
 * @param {boolean} isStored - Whether document is stored
 */
async function updateDocumentUI(docType, isStored) {
  const prefix = docType === 'resume' ? 'resume' : 
                 docType === 'coverLetter' ? 'coverLetter' : 'qa';
  
  const statusIndicator = document.getElementById(`${prefix}StatusIndicator`);
  const statusText = document.getElementById(`${prefix}StatusText`);
  const dateDiv = document.getElementById(`${prefix}Date`);
  const dateText = document.getElementById(`${prefix}DateText`);
  const downloadBtn = document.getElementById(`${prefix}DownloadBtn`);
  const updateBtn = document.getElementById(`${prefix}UpdateBtn`);
  const uploadBtn = document.getElementById(`${prefix}UploadBtn`);
  
  if (isStored) {
    // Document is stored - show stored state
    statusIndicator.textContent = '✓';
    statusIndicator.className = 'status-indicator stored';
    statusText.textContent = 'Stored';
    
    // Get and display upload date
    const docData = docType === 'resume' ? await window.storage.getResume() :
                    docType === 'coverLetter' ? await window.storage.getCoverLetter() :
                    await window.storage.getQA();
    
    if (docData && docData.originalFile && docData.originalFile.uploadedAt) {
      const uploadDate = new Date(docData.originalFile.uploadedAt);
      const formattedDate = uploadDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      dateText.textContent = `Stored on ${formattedDate}`;
      dateDiv.style.display = 'block';
    }
    
    // Show download and update buttons, hide upload button
    downloadBtn.style.display = 'inline-block';
    updateBtn.style.display = 'inline-block';
    uploadBtn.style.display = 'none';
  } else {
    // Document is not stored - show not uploaded state
    statusIndicator.textContent = '✗';
    statusIndicator.className = 'status-indicator not-stored';
    statusText.textContent = 'Not uploaded';
    
    // Hide date, download, and update buttons, show upload button
    dateDiv.style.display = 'none';
    downloadBtn.style.display = 'none';
    updateBtn.style.display = 'none';
    uploadBtn.style.display = 'inline-block';
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Resume handlers
  document.getElementById('resumeUploadBtn').addEventListener('click', () => {
    document.getElementById('resumeFileInput').click();
  });
  document.getElementById('resumeUpdateBtn').addEventListener('click', () => {
    document.getElementById('resumeFileInput').click();
  });
  document.getElementById('resumeDownloadBtn').addEventListener('click', handleDownloadResume);
  document.getElementById('resumeFileInput').addEventListener('change', (e) => {
    handleFileUpload('resume', e.target.files[0]);
  });
  
  // Cover Letter handlers
  document.getElementById('coverLetterUploadBtn').addEventListener('click', () => {
    document.getElementById('coverLetterFileInput').click();
  });
  document.getElementById('coverLetterUpdateBtn').addEventListener('click', () => {
    document.getElementById('coverLetterFileInput').click();
  });
  document.getElementById('coverLetterDownloadBtn').addEventListener('click', handleDownloadCoverLetter);
  document.getElementById('coverLetterFileInput').addEventListener('change', (e) => {
    handleFileUpload('coverLetter', e.target.files[0]);
  });
  
  // QA Sheet handlers
  document.getElementById('qaUploadBtn').addEventListener('click', () => {
    document.getElementById('qaFileInput').click();
  });
  document.getElementById('qaUpdateBtn').addEventListener('click', () => {
    document.getElementById('qaFileInput').click();
  });
  document.getElementById('qaDownloadBtn').addEventListener('click', handleDownloadQASheet);
  document.getElementById('qaFileInput').addEventListener('change', (e) => {
    handleFileUpload('qa', e.target.files[0]);
  });
  
  // View All Stored Data button
  document.getElementById('viewAllDataBtn').addEventListener('click', handleViewAllData);

  // Demographics (EEO) - save on change
  function saveDemographicsFromForm() {
    const gender = document.getElementById('demographicsGender').value;
    const race = document.getElementById('demographicsRace').value;
    const veteran = document.getElementById('demographicsVeteran').value;
    const demographics = {};
    if (gender) demographics.gender = gender;
    if (race) demographics.race = race;
    if (veteran) demographics.veteranStatus = veteran;
    window.storage.saveDemographics(demographics);
  }
  document.getElementById('demographicsGender').addEventListener('change', saveDemographicsFromForm);
  document.getElementById('demographicsRace').addEventListener('change', saveDemographicsFromForm);
  document.getElementById('demographicsVeteran').addEventListener('change', saveDemographicsFromForm);

  // Work Authorization - save on change
  function saveWorkAuthFromForm() {
    const requiresSponsorship = document.getElementById('workAuthRequiresSponsorship').value;
    const prefs = {};
    if (requiresSponsorship) prefs.requiresSponsorship = requiresSponsorship;
    window.storage.saveWorkAuthPreferences(prefs);
  }
  document.getElementById('workAuthRequiresSponsorship').addEventListener('change', saveWorkAuthFromForm);
}

/**
 * Handle file upload for a document type
 * @param {string} docType - 'resume', 'coverLetter', or 'qa'
 * @param {File} file - The file to upload
 */
async function handleFileUpload(docType, file) {
  if (!file) {
    return;
  }
  
  const prefix = docType === 'resume' ? 'resume' : 
                 docType === 'coverLetter' ? 'coverLetter' : 'qa';
  
  const loadingIndicator = document.getElementById(`${prefix}Loading`);
  const fileInput = document.getElementById(`${prefix}FileInput`);
  
  try {
    // Show loading indicator
    loadingIndicator.style.display = 'block';
    showMessage(`Uploading ${docType}...`, 'info');
    
    // Convert file to base64 for storage
    const fileData = await fileToBase64(file);
    
    // Prepare form data for API
    const formData = new FormData();
    
    if (docType === 'resume') {
      formData.append('resume_file', file);
    } else if (docType === 'coverLetter') {
      formData.append('cover_letter_file', file);
    } else if (docType === 'qa') {
      formData.append('qa_sheet_file', file);
    }
    
    // Send to backend API
    const response = await fetch(`${API_BASE_URL}/api/parse-user-documents`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Prepare original file metadata
    const originalFile = {
      name: file.name,
      uploadedAt: new Date().toISOString(),
      fileData: fileData
    };
    
    // Save to storage based on document type
    if (docType === 'resume') {
      await window.storage.saveResume(result.resume || result.data, originalFile);
    } else if (docType === 'coverLetter') {
      await window.storage.saveCoverLetter(result.coverLetter || result.text, originalFile);
    } else if (docType === 'qa') {
      await window.storage.saveQA(result.qa || result.answers, originalFile);
    }
    
    // Refresh UI
    await updateDocumentUI(docType, true);
    
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
    
    // Clear file input
    fileInput.value = '';
    
    // Show success message
    showMessage(`${docType.charAt(0).toUpperCase() + docType.slice(1)} uploaded and parsed successfully!`, 'success');
    
  } catch (error) {
    console.error(`Error uploading ${docType}:`, error);
    loadingIndicator.style.display = 'none';
    fileInput.value = '';
    showMessage(`Error uploading ${docType}: ${error.message}`, 'error');
  }
}

/**
 * Handle download resume
 */
async function handleDownloadResume() {
  try {
    await window.storage.downloadResume();
    showMessage('Resume downloaded successfully!', 'success');
  } catch (error) {
    console.error('Error downloading resume:', error);
    showMessage(`Error downloading resume: ${error.message}`, 'error');
  }
}

/**
 * Handle download cover letter
 */
async function handleDownloadCoverLetter() {
  try {
    await window.storage.downloadCoverLetter();
    showMessage('Cover letter downloaded successfully!', 'success');
  } catch (error) {
    console.error('Error downloading cover letter:', error);
    showMessage(`Error downloading cover letter: ${error.message}`, 'error');
  }
}

/**
 * Handle download QA sheet
 */
async function handleDownloadQASheet() {
  try {
    await window.storage.downloadQASheet();
    showMessage('QA sheet downloaded successfully!', 'success');
  } catch (error) {
    console.error('Error downloading QA sheet:', error);
    showMessage(`Error downloading QA sheet: ${error.message}`, 'error');
  }
}

/**
 * Handle view all stored data
 */
async function handleViewAllData() {
  try {
    const resume = await window.storage.getResume();
    const coverLetter = await window.storage.getCoverLetter();
    const qa = await window.storage.getQA();
    
    // Log full data to console for debugging
    console.log('=== FULL CHROME STORAGE DATA ===');
    console.log('Resume:', resume);
    console.log('Cover Letter:', coverLetter);
    console.log('QA:', qa);
    console.log('Raw Chrome Storage:', await chrome.storage.local.get(null));
    
    // Build formatted preview
    let preview = '=== STORED DATA PREVIEW ===\n\n';
    
    if (resume && resume.data) {
      preview += '📄 RESUME:\n';
      preview += `Name: ${resume.data.full_name || 'N/A'}\n`;
      if (resume.data.contact_info) {
        preview += `Email: ${resume.data.contact_info.email || 'N/A'}\n`;
        preview += `Phone: ${resume.data.contact_info.phone || 'N/A'}\n`;
      }
      if (resume.data.experience && resume.data.experience.length > 0) {
        preview += `Experience: ${resume.data.experience.length} position(s)\n`;
      }
      if (resume.data.education && resume.data.education.length > 0) {
        preview += `Education: ${resume.data.education.length} entry/entries\n`;
      }
      preview += '\n';
    } else {
      preview += '📄 RESUME: Not stored\n\n';
    }
    
    if (coverLetter && coverLetter.text) {
      preview += '📝 COVER LETTER:\n';
      const previewText = coverLetter.text.length > 200 
        ? coverLetter.text.substring(0, 200) + '...' 
        : coverLetter.text;
      preview += previewText + '\n\n';
    } else {
      preview += '📝 COVER LETTER: Not stored\n\n';
    }
    
    if (qa && qa.answers) {
      preview += '❓ QA SHEET:\n';
      Object.keys(qa.answers).forEach(key => {
        preview += `${key}: ${qa.answers[key] || 'N/A'}\n`;
      });
      preview += '\n';
    } else {
      preview += '❓ QA SHEET: Not stored\n\n';
    }
    
    // Create modal with full JSON data
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    const allData = {
      resume: resume,
      coverLetter: coverLetter,
      qa: qa
    };
    
    modalContent.innerHTML = `
      <h2 style="margin: 0 0 16px 0;">Stored Data (Full JSON)</h2>
      <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">
        Check browser console (F12) for full object inspection. Click JSON to copy.
      </p>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
        <pre id="json-display" style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 12px; cursor: pointer; user-select: all;" onclick="this.select(); document.execCommand('copy'); alert('Copied to clipboard!');">${JSON.stringify(allData, null, 2)}</pre>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="close-modal" style="
          padding: 10px 20px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        ">Close</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    modal.querySelector('#close-modal').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
  } catch (error) {
    console.error('Error viewing stored data:', error);
    showMessage(`Error viewing stored data: ${error.message}`, 'error');
  }
}

/**
 * Convert file to base64 string
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Get base64 string (remove data URL prefix if present)
      const base64 = reader.result.split(',')[1] || reader.result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Show message to user
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 */
function showMessage(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  const statusMessage = document.getElementById('statusMessage');
  
  statusMessage.textContent = message;
  statusDiv.style.display = 'block';
  
  // Set color based on type
  statusDiv.className = `status ${type}`;
  
  // Auto-hide after 5 seconds for success/info messages
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}