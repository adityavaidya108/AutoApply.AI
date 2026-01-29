// Storage module for AutoApply.AI extension
// Handles saving, retrieving, and downloading user documents

/**
 * Get storage status - checks what documents are currently stored
 * @returns {Promise<{resume: boolean, coverLetter: boolean, qa: boolean}>}
 */
async function getStorageStatus() {
  try {
    const result = await chrome.storage.local.get(['resume', 'coverLetter', 'qa']);
    return {
      resume: !!result.resume,
      coverLetter: !!result.coverLetter,
      qa: !!result.qa
    };
  } catch (error) {
    console.error('Error getting storage status:', error);
    return { resume: false, coverLetter: false, qa: false };
  }
}

/**
 * Save resume data and original file
 * @param {Object} data - Parsed resume data from LLM (structured JSON)
 * @param {Object} originalFile - Original file metadata { name, uploadedAt, fileData }
 * @returns {Promise<void>}
 */
async function saveResume(data, originalFile) {
  try {
    const resumeData = {
      data: data,
      originalFile: originalFile
    };
    await chrome.storage.local.set({ resume: resumeData });
    console.log('Resume saved successfully');
  } catch (error) {
    console.error('Error saving resume:', error);
    throw error;
  }
}

/**
 * Save cover letter text and original file
 * @param {string} text - Cover letter text content
 * @param {Object} originalFile - Original file metadata { name, uploadedAt, fileData }
 * @returns {Promise<void>}
 */
async function saveCoverLetter(text, originalFile) {
  try {
    const coverLetterData = {
      text: text,
      originalFile: originalFile
    };
    await chrome.storage.local.set({ coverLetter: coverLetterData });
    console.log('Cover letter saved successfully');
  } catch (error) {
    console.error('Error saving cover letter:', error);
    throw error;
  }
}

/**
 * Save Q&A answers and original file
 * @param {Object} answers - Q&A answers object { whyWorkHere, whyYou, salary, ... }
 * @param {Object} originalFile - Original file metadata { name, uploadedAt, fileData }
 * @returns {Promise<void>}
 */
async function saveQA(answers, originalFile) {
  try {
    const qaData = {
      answers: answers,
      originalFile: originalFile
    };
    await chrome.storage.local.set({ qa: qaData });
    console.log('QA sheet saved successfully');
  } catch (error) {
    console.error('Error saving QA sheet:', error);
    throw error;
  }
}

/**
 * Get resume data and original file
 * @returns {Promise<{data: Object, originalFile: Object} | null>}
 */
async function getResume() {
  try {
    const result = await chrome.storage.local.get(['resume']);
    return result.resume || null;
  } catch (error) {
    console.error('Error getting resume:', error);
    return null;
  }
}

/**
 * Get cover letter text and original file
 * @returns {Promise<{text: string, originalFile: Object} | null>}
 */
async function getCoverLetter() {
  try {
    const result = await chrome.storage.local.get(['coverLetter']);
    return result.coverLetter || null;
  } catch (error) {
    console.error('Error getting cover letter:', error);
    return null;
  }
}

/**
 * Get Q&A answers and original file
 * @returns {Promise<{answers: Object, originalFile: Object} | null>}
 */
async function getQA() {
  try {
    const result = await chrome.storage.local.get(['qa']);
    return result.qa || null;
  } catch (error) {
    console.error('Error getting QA sheet:', error);
    return null;
  }
}

/**
 * Get demographics / EEO preferences (gender, race, veteran status)
 * Used to autofill voluntary demographic fields on job forms.
 * @returns {Promise<{gender?: string, race?: string, veteranStatus?: string}>}
 */
async function getDemographics() {
  try {
    const result = await chrome.storage.local.get(['demographics']);
    return result.demographics || {};
  } catch (error) {
    console.error('Error getting demographics:', error);
    return {};
  }
}

/**
 * Save demographics / EEO preferences
 * @param {Object} demographics - { gender?, race?, veteranStatus? }
 * @returns {Promise<void>}
 */
async function saveDemographics(demographics) {
  try {
    await chrome.storage.local.set({ demographics: demographics || {} });
    console.log('Demographics saved successfully');
  } catch (error) {
    console.error('Error saving demographics:', error);
    throw error;
  }
}

/**
 * Get work authorization preferences (sponsorship Yes/No and basis details)
 * @returns {Promise<{requiresSponsorship?: string, sponsorshipBasisDetails?: string}>}
 */
async function getWorkAuthPreferences() {
  try {
    const result = await chrome.storage.local.get(['workAuthPreferences']);
    return result.workAuthPreferences || {};
  } catch (error) {
    console.error('Error getting work auth preferences:', error);
    return {};
  }
}

/**
 * Save work authorization preferences
 * @param {Object} prefs - { requiresSponsorship?, sponsorshipBasisDetails? }
 * @returns {Promise<void>}
 */
async function saveWorkAuthPreferences(prefs) {
  try {
    await chrome.storage.local.set({ workAuthPreferences: prefs || {} });
    console.log('Work auth preferences saved successfully');
  } catch (error) {
    console.error('Error saving work auth preferences:', error);
    throw error;
  }
}

/**
 * Download resume file
 * @returns {Promise<void>}
 */
async function downloadResume() {
  try {
    const resume = await getResume();
    if (!resume || !resume.originalFile) {
      throw new Error('No resume file found in storage');
    }

    const { name, fileData } = resume.originalFile;
    
    // Convert base64 to blob if needed
    let blob;
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      // Data URL format
      const response = await fetch(fileData);
      blob = await response.blob();
    } else if (typeof fileData === 'string') {
      // Base64 string
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: 'application/pdf' });
    } else {
      throw new Error('Invalid file data format');
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'resume.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Resume downloaded successfully');
  } catch (error) {
    console.error('Error downloading resume:', error);
    throw error;
  }
}

/**
 * Download cover letter file
 * @returns {Promise<void>}
 */
async function downloadCoverLetter() {
  try {
    const coverLetter = await getCoverLetter();
    if (!coverLetter || !coverLetter.originalFile) {
      throw new Error('No cover letter file found in storage');
    }

    const { name, fileData } = coverLetter.originalFile;
    
    // Convert base64 to blob if needed
    let blob;
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      // Data URL format
      const response = await fetch(fileData);
      blob = await response.blob();
    } else if (typeof fileData === 'string') {
      // Base64 string
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Determine MIME type from file extension or default to PDF
      const mimeType = name.endsWith('.txt') ? 'text/plain' : 'application/pdf';
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      throw new Error('Invalid file data format');
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'cover_letter.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Cover letter downloaded successfully');
  } catch (error) {
    console.error('Error downloading cover letter:', error);
    throw error;
  }
}

/**
 * Download QA sheet file
 * @returns {Promise<void>}
 */
async function downloadQASheet() {
  try {
    const qa = await getQA();
    if (!qa || !qa.originalFile) {
      throw new Error('No QA sheet file found in storage');
    }

    const { name, fileData } = qa.originalFile;
    
    // Convert base64 to blob if needed
    let blob;
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      // Data URL format
      const response = await fetch(fileData);
      blob = await response.blob();
    } else if (typeof fileData === 'string') {
      // Base64 string
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Determine MIME type from file extension or default to PDF
      const mimeType = name.endsWith('.txt') ? 'text/plain' : 'application/pdf';
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      throw new Error('Invalid file data format');
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'qa_sheet.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('QA sheet downloaded successfully');
  } catch (error) {
    console.error('Error downloading QA sheet:', error);
    throw error;
  }
}

// Export functions for use in other scripts
// Note: In Chrome extensions, we can't use ES6 modules directly in popup/content scripts
// These functions will be available globally when script is loaded, or can be accessed via window object
if (typeof window !== 'undefined') {
  window.storage = {
    getStorageStatus,
    saveResume,
    saveCoverLetter,
    saveQA,
    getResume,
    getCoverLetter,
    getQA,
    getDemographics,
    saveDemographics,
    getWorkAuthPreferences,
    saveWorkAuthPreferences,
    downloadResume,
    downloadCoverLetter,
    downloadQASheet
  };
}
