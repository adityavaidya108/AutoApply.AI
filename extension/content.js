// Content script - runs on every web page
// Implements job application form detection

console.log('AutoApply.AI content script loaded on:', window.location.href);

// Detection state
let detectionState = {
  platform: null,
  fields: {},
  isJobForm: false,
  lastDetection: null
};

// Track last detection result to avoid duplicate logs
let lastDetectionResult = {
  platform: null,
  fieldCount: 0,
  fieldKeys: null
};

// MutationObserver for dynamic forms
let formObserver = null;

// Field highlighting state
let highlightsVisible = false;

// Debounce timer for detection
let detectionDebounceTimer = null;

// Cache configuration for personalized answers (defined early for use in cleanup)
const ANSWER_CACHE_CONFIG = {
  EXPIRATION_TIME_MS: 30 * 60 * 1000, // 30 minutes
  MAX_SESSION_TIME_MS: 60 * 60 * 1000, // 1 hour max session time (prevents budget overrun)
  MAX_CACHE_SIZE: 10, // Maximum number of cached answer sets
  STORAGE_KEY: 'autoaapply_answer_cache',
  SESSION_START_KEY: 'autoaapply_session_start'
};

/**
 * Check if extension context is still valid
 * @returns {boolean} - Whether extension context is valid
 */
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime - if it throws, context is invalid
    return chrome.runtime && chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

/**
 * Safely send message to background script
 * @param {Object} message - Message to send
 * @param {Function} callback - Optional callback
 */
function safeSendMessage(message, callback) {
  if (!isExtensionContextValid()) {
    // Suppress warning for file:// URLs (expected behavior)
    const isFileProtocol = window.location.protocol === 'file:';
    if (!isFileProtocol) {
      console.warn('AutoApply.AI: Extension context invalidated, skipping message send');
    }
    if (callback) callback({ success: false, error: 'Extension context invalidated' });
    return;
  }
  
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // Suppress warning for file:// URLs
        const isFileProtocol = window.location.protocol === 'file:';
        if (!isFileProtocol) {
          console.warn('AutoApply.AI: Error sending message:', chrome.runtime.lastError.message);
        }
        if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
      } else if (callback) {
        callback(response);
      }
    });
  } catch (error) {
    // Suppress warning for file:// URLs
    const isFileProtocol = window.location.protocol === 'file:';
    if (!isFileProtocol) {
      console.warn('AutoApply.AI: Error in sendMessage:', error);
    }
    if (callback) callback({ success: false, error: error.message });
  }
}

// Listen for messages from popup or background
try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if context is still valid
    if (!isExtensionContextValid()) {
      console.warn('AutoApply.AI: Extension context invalidated, ignoring message');
      return false;
    }
    
    try {
      if (request.action === 'test') {
        sendResponse({ success: true, message: 'Content script is working!' });
        return true;
      }
      
      if (request.action === 'checkForms') {
        const hasForms = checkForForms();
        sendResponse({ hasForms: hasForms });
        return true;
      }
      
      if (request.action === 'getDetectionState') {
        sendResponse(detectionState);
        return true;
      }
      
      if (request.action === 'triggerDetection') {
        detectJobApplicationForm();
        sendResponse(detectionState);
        return true;
      }
    } catch (error) {
      console.error('AutoApply.AI: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
      return false;
    }
    
    return true;
  });
} catch (error) {
  console.warn('AutoApply.AI: Could not set up message listener:', error);
}

// Check if page has form elements
function checkForForms() {
  const forms = document.querySelectorAll('form');
  const inputs = document.querySelectorAll('input, textarea, select');
  
  return forms.length > 0 || inputs.length > 0;
}

/**
 * Detect the job application platform based on URL and DOM
 * @returns {string} - Platform name or 'generic'
 */
function detectPlatform() {
  const hostname = window.location.hostname.toLowerCase();
  const url = window.location.href.toLowerCase();
  
  // Workday detection
  if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) {
    return 'workday';
  }
  
  // Greenhouse detection
  if (hostname.includes('greenhouse.io') || hostname.includes('boards.greenhouse.io')) {
    return 'greenhouse';
  }
  
  // Lever detection
  if (hostname.includes('lever.co') || hostname.includes('jobs.lever.co')) {
    return 'lever';
  }
  
  // LinkedIn detection
  if (hostname.includes('linkedin.com') && url.includes('/jobs/')) {
    return 'linkedin';
  }
  
  // Indeed detection
  if (hostname.includes('indeed.com')) {
    return 'indeed';
  }
  
  // Generic fallback
  return 'generic';
}

/**
 * Platform-specific form detection
 * @param {string} platform - Platform name
 * @returns {boolean} - Whether a job application form was detected
 */
function detectPlatformForm(platform) {
  switch (platform) {
    case 'workday':
      return detectWorkdayForm();
    case 'greenhouse':
      return detectGreenhouseForm();
    case 'lever':
      return detectLeverForm();
    case 'linkedin':
      return detectLinkedInForm();
    case 'indeed':
      return detectIndeedForm();
    default:
      return detectGenericForm();
  }
}

/**
 * Workday-specific form detection
 */
function detectWorkdayForm() {
  // Workday often uses specific class names and data attributes
  const workdaySelectors = [
    '[data-automation-id*="input"]',
    '[data-automation-id*="field"]',
    '.wd-input',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]'
  ];
  
  for (const selector of workdaySelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Greenhouse-specific form detection
 */
function detectGreenhouseForm() {
  const greenhouseSelectors = [
    '#application_form',
    '.application-form',
    '[data-application-form]',
    'form[action*="greenhouse"]'
  ];
  
  for (const selector of greenhouseSelectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Lever-specific form detection
 */
function detectLeverForm() {
  const leverSelectors = [
    '#application-form',
    '.application-form',
    'form[action*="lever"]',
    '[data-lever-form]'
  ];
  
  for (const selector of leverSelectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  return false;
}

/**
 * LinkedIn-specific form detection
 */
function detectLinkedInForm() {
  const linkedinSelectors = [
    '.jobs-apply-form',
    '[data-job-apply-form]',
    'form[action*="linkedin"]'
  ];
  
  for (const selector of linkedinSelectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Indeed-specific form detection
 */
function detectIndeedForm() {
  const indeedSelectors = [
    '#apply-button',
    '.indeed-apply-form',
    'form[action*="indeed"]'
  ];
  
  for (const selector of indeedSelectors) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generic form detection (fallback)
 */
function detectGenericForm() {
  // Look for common job application form indicators
  const forms = document.querySelectorAll('form');
  const inputs = document.querySelectorAll('input, textarea, select');
  
  // Check for common job application field names in labels
  const jobApplicationKeywords = [
    'resume', 'cv', 'cover letter', 'first name', 'last name',
    'email', 'phone', 'address', 'experience', 'education',
    'why do you want to work', 'salary', 'work authorization'
  ];
  
  let keywordMatches = 0;
  const allText = document.body.textContent.toLowerCase();
  
  for (const keyword of jobApplicationKeywords) {
    if (allText.includes(keyword)) {
      keywordMatches++;
    }
  }
  
  // If we have forms/inputs and multiple job-related keywords, likely a job form
  return (forms.length > 0 || inputs.length > 5) && keywordMatches >= 3;
}

/**
 * Identify form fields using labels, placeholders, and visual proximity
 * @returns {Object} - Object mapping field types to DOM elements
 */
function identifyFormFields() {
  const fields = {};
  const allInputs = document.querySelectorAll('input, textarea, select');
  
  for (const input of allInputs) {
    // Skip hidden, disabled, or non-visible inputs
    if (input.type === 'hidden' || input.disabled || !isElementVisible(input)) {
      continue;
    }
    
    // Skip Select2 widget hidden inputs (they have select2-offscreen or select2-focusser classes)
    if (input.classList.contains('select2-offscreen') || 
        input.classList.contains('select2-focusser') ||
        input.classList.contains('select2-input') ||
        input.hasAttribute('aria-haspopup')) {
      // Skip Select2 hidden inputs - they're not the actual form fields
      continue;
    }
    
    // Skip buttons
    const inputType = input.type ? input.type.toLowerCase() : '';
    if (inputType === 'button' || inputType === 'submit' || inputType === 'reset') {
      continue;
    }
    
    // For radio buttons, only process the first one in each group to avoid duplicates
    if (inputType === 'radio' && input.name) {
      const radioGroup = document.querySelectorAll(`input[type="radio"][name="${input.name}"]`);
      if (radioGroup.length > 0 && radioGroup[0] !== input) {
        continue; // Skip if not the first radio in the group
      }
    }
    
    let fieldType = null;
    
    // Method 1: Label-based matching (PRIMARY)
    const label = findAssociatedLabel(input);
    if (label) {
      let labelText = label.textContent || label.innerText;
      // Clean label text - remove asterisks, "required" messages, etc.
      if (labelText) {
        labelText = labelText
          .replace(/\*+/g, '') // Remove asterisks
          .replace(/\(required\)/gi, '') // Remove (required)
          .replace(/is required/gi, '') // Remove "is required"
          .replace(/this field is required/gi, '') // Remove "this field is required"
          .trim();
        
        if (labelText) {
          fieldType = window.fieldMapping?.findFieldType(labelText);
          if (fieldType) {
            // If we already have this field type, prefer the one with a proper label
            if (fields[fieldType]) {
              const existingLabel = findAssociatedLabel(fields[fieldType]);
              const existingLabelText = existingLabel ? (existingLabel.textContent || '').trim() : '';
              const currentLabelText = labelText.trim();
              
              // Prefer the one with a non-empty label, or the one that's not a Select2 input
              if (currentLabelText && (!existingLabelText || fields[fieldType].classList.contains('select2-offscreen') || fields[fieldType].classList.contains('select2-focusser'))) {
                fields[fieldType] = input;
              }
            } else {
              fields[fieldType] = input;
            }
            continue;
          }
        }
      }
    }
    
    // Method 2: Placeholder matching (PRIMARY)
    if (input.placeholder) {
      fieldType = window.fieldMapping?.findFieldType(input.placeholder);
      if (fieldType) {
        fields[fieldType] = input;
        continue;
      }
    }
    
    // Method 3: ARIA label matching (SECONDARY)
    if (input.getAttribute('aria-label')) {
      const ariaLabel = input.getAttribute('aria-label');
      fieldType = window.fieldMapping?.findFieldType(ariaLabel);
      if (fieldType) {
        fields[fieldType] = input;
        continue;
      }
    }
    
    // Method 4: Visual proximity (SECONDARY)
    // Look for nearby text that might indicate the field type
    const nearbyText = findNearbyText(input);
    if (nearbyText) {
      // Clean nearby text too
      const cleanedText = nearbyText
        .replace(/\*+/g, '')
        .replace(/\(required\)/gi, '')
        .replace(/is required/gi, '')
        .trim();
      if (cleanedText) {
        fieldType = window.fieldMapping?.findFieldType(cleanedText);
        if (fieldType) {
          fields[fieldType] = input;
          continue;
        }
      }
    }
    
    // Method 5: Check for aria-describedby or aria-labelledby (for accessibility)
    const ariaLabel = input.getAttribute('aria-label') || 
                      input.getAttribute('aria-labelledby') ? 
                        document.getElementById(input.getAttribute('aria-labelledby'))?.textContent : null;
    if (ariaLabel) {
      const cleanedAria = ariaLabel
        .replace(/\*+/g, '')
        .replace(/\(required\)/gi, '')
        .trim();
      if (cleanedAria) {
        fieldType = window.fieldMapping?.findFieldType(cleanedAria);
        if (fieldType) {
          fields[fieldType] = input;
          continue;
        }
      }
    }
  }
  
  return fields;
}

/**
 * Find label associated with an input element
 * @param {HTMLElement} input - Input element
 * @returns {HTMLElement|null} - Associated label or null
 */
function findAssociatedLabel(input) {
  // Check for explicit label association via 'for' attribute
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label;
  }
  
  // Check for implicit label (label wrapping input)
  const label = input.closest('label');
  if (label) return label;
  
  // Check for nearby label (within same parent or previous sibling)
  let parent = input.parentElement;
  while (parent && parent !== document.body) {
    const label = parent.querySelector('label');
    if (label) {
      // Check if label is close to input (same parent or nearby)
      const labelRect = label.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      
      // If label is above or to the left of input, likely associated
      if (labelRect.bottom <= inputRect.top + 50 || labelRect.right <= inputRect.left + 50) {
        return label;
      }
    }
    parent = parent.parentElement;
  }
  
  return null;
}

/**
 * Find nearby text that might indicate field type
 * @param {HTMLElement} input - Input element
 * @returns {string|null} - Nearby text or null
 */
function findNearbyText(input) {
  const parent = input.parentElement;
  if (!parent) return null;
  
  // Look for text nodes or span/div elements near the input
  const siblings = Array.from(parent.children);
  const inputIndex = siblings.indexOf(input);
  
  // Check previous sibling
  if (inputIndex > 0) {
    const prevSibling = siblings[inputIndex - 1];
    const text = prevSibling.textContent || prevSibling.innerText;
    if (text && text.trim().length < 50) {
      return text.trim();
    }
  }
  
  // Check parent's text content (excluding input's own text)
  const parentText = parent.textContent || parent.innerText;
  const inputText = input.value || input.textContent || '';
  const nearbyText = parentText.replace(inputText, '').trim();
  
  if (nearbyText && nearbyText.length < 100) {
    return nearbyText;
  }
  
  return null;
}

/**
 * Check if element is visible
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - Whether element is visible
 */
function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Main form detection function
 * @param {boolean} forceLog - Force logging even if results haven't changed
 * @returns {Object} - Detection result
 */
function detectJobApplicationForm(forceLog = false) {
  // Detect platform
  const platform = detectPlatform();
  
  // Detect if it's a job application form
  const isJobForm = detectPlatformForm(platform);
  
  // Identify form fields
  const fields = isJobForm ? identifyFormFields() : {};
  
  const fieldCount = Object.keys(fields).length;
  const fieldKeys = Object.keys(fields).sort().join(',');
  
  // Check if results have changed
  const resultsChanged = 
    lastDetectionResult.platform !== platform ||
    lastDetectionResult.fieldCount !== fieldCount ||
    lastDetectionResult.fieldKeys !== fieldKeys ||
    lastDetectionResult.isJobForm !== isJobForm;
  
  // Only log if results changed or forced
  if (resultsChanged || forceLog) {
    // Update last detection result
    lastDetectionResult = {
      platform,
      fieldCount,
      fieldKeys,
      isJobForm
    };
  }
  
  // Update detection state
  detectionState = {
    platform,
    fields,
    isJobForm,
    lastDetection: new Date().toISOString()
  };
  
  // Send detection results to background script (safely) - only if changed
  if (resultsChanged) {
    safeSendMessage({
      action: 'formDetected',
      data: {
        platform,
        fieldCount,
        fields: Object.keys(fields),
        url: window.location.href,
        timestamp: detectionState.lastDetection
      }
    });
  }
  
  // Show visual indicator if form detected (only update if state changed)
  if (isJobForm !== detectionState.isJobForm || resultsChanged) {
    if (isJobForm) {
      showVisualIndicator();
      // Don't show highlights by default - user must click button
      highlightsVisible = false;
      removeFieldHighlights(); // Ensure no highlights initially
    } else {
      hideVisualIndicator();
      removeFieldHighlights();
    }
  }
  
  return detectionState;
}

/**
 * Show visual indicator when form is detected
 */
function showVisualIndicator() {
  // Remove existing indicator if present
  hideVisualIndicator();
  
  const fieldCount = Object.keys(detectionState.fields).length;
  const totalInputs = document.querySelectorAll('input, textarea, select').length;
  const mappedCount = fieldCount;
  const unmappedCount = Math.max(0, totalInputs - mappedCount);
  
  const indicator = document.createElement('div');
  indicator.id = 'autoaapply-indicator';
  indicator.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      min-width: 280px;
    ">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>🚀 AutoApply.AI</span>
          <span>Form Detected ✓</span>
        </div>
        <button id="autoaapply-close" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        ">✕</button>
      </div>
      
      <div style="margin-bottom: 12px; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="color: #4CAF50;">✓</span>
          <span>${mappedCount} fields mapped</span>
        </div>
        ${unmappedCount > 0 ? `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #ff9800;">⚠</span>
          <span>${unmappedCount} fields unmapped</span>
        </div>
        ` : ''}
      </div>
      
      <div style="display: flex; gap: 8px;">
        <button id="autoaapply-toggle-highlights" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          flex: 1;
        ">${highlightsVisible ? 'Hide' : 'Show'} Highlights</button>
        <button id="autoaapply-view-details" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          flex: 1;
        ">View Details</button>
      </div>
    </div>
  `;
  
  // Close button
  indicator.querySelector('#autoaapply-close').addEventListener('click', () => {
    hideVisualIndicator();
    removeFieldHighlights();
  });
  
  // Toggle highlights button
  indicator.querySelector('#autoaapply-toggle-highlights').addEventListener('click', () => {
    highlightsVisible = !highlightsVisible;
    if (highlightsVisible) {
      updateFieldHighlights();
    } else {
      removeFieldHighlights();
    }
    // Update button text directly without recreating indicator
    const toggleButton = indicator.querySelector('#autoaapply-toggle-highlights');
    if (toggleButton) {
      toggleButton.textContent = highlightsVisible ? 'Hide Highlights' : 'Show Highlights';
    }
  });
  
  // View details button
  indicator.querySelector('#autoaapply-view-details').addEventListener('click', () => {
    showFieldSummary();
  });
  
  document.body.appendChild(indicator);
}

/**
 * Hide visual indicator
 */
function hideVisualIndicator() {
  const indicator = document.getElementById('autoaapply-indicator');
  if (indicator) {
    indicator.remove();
  }
  removeFieldHighlights();
}


/**
 * Show field summary when indicator is clicked
 */
function showFieldSummary() {
  const fieldCount = Object.keys(detectionState.fields).length;
  const fieldsList = Object.keys(detectionState.fields).join(', ');
  
  let summary = `AutoApply.AI Detection Summary:\n\n`;
  summary += `Platform: ${detectionState.platform}\n`;
  summary += `Fields Detected: ${fieldCount}\n\n`;
  summary += `Mapped Fields:\n`;
  
  if (fieldCount > 0) {
    Object.entries(detectionState.fields).forEach(([fieldType, element]) => {
      const label = findAssociatedLabel(element)?.textContent?.trim() || 
                    element.placeholder || 
                    element.getAttribute('aria-label') || 
                    'Unknown';
      summary += `  ✓ ${fieldType}: ${label.substring(0, 50)}\n`;
    });
  } else {
    summary += `  None detected\n`;
  }
  
  alert(summary);
}

/**
 * Update field highlights - add colored borders and tooltips
 */
function updateFieldHighlights() {
  // Remove existing highlights first
  removeFieldHighlights();
  
  if (!detectionState.isJobForm) return;
  
  Object.entries(detectionState.fields).forEach(([fieldType, element]) => {
    // Add highlight class
    element.classList.add('autoaapply-highlight');
    
    // Add colored border (green for successfully mapped)
    element.style.border = '2px solid #4CAF50';
    element.style.borderRadius = '4px';
    element.style.boxShadow = '0 0 0 2px rgba(76, 175, 80, 0.2)';
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'autoaapply-tooltip';
    tooltip.textContent = `Mapped: ${fieldType}`;
    tooltip.style.cssText = `
      position: absolute;
      background: #333;
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 10001;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      margin-top: -35px;
    `;
    
    // Position tooltip relative to element
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.top}px`;
    
    document.body.appendChild(tooltip);
    
    // Show tooltip on hover
    element.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
    });
    
    element.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    // Store tooltip reference
    element._autoaapplyTooltip = tooltip;
  });
}

/**
 * Remove field highlights
 */
function removeFieldHighlights() {
  // Remove highlights from all elements
  document.querySelectorAll('.autoaapply-highlight').forEach(element => {
    element.classList.remove('autoaapply-highlight');
    element.style.border = '';
    element.style.borderRadius = '';
    element.style.boxShadow = '';
    
    // Remove tooltip
    if (element._autoaapplyTooltip) {
      element._autoaapplyTooltip.remove();
      delete element._autoaapplyTooltip;
    }
  });
  
  // Remove any orphaned tooltips
  document.querySelectorAll('.autoaapply-tooltip').forEach(tooltip => {
    tooltip.remove();
  });
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

function initialize() {
  // Clean up expired cache entries on initialization (defer to ensure function is defined)
  setTimeout(() => {
    if (typeof cleanupExpiredCache === 'function') {
      cleanupExpiredCache().catch(err => {
        console.error('Error in cache cleanup:', err);
      });
    }
  }, 100);
  
  // fieldMapping.js is loaded before content.js (via manifest)
  // Run initial detection after page loads (force log on first run)
  setTimeout(() => {
    detectJobApplicationForm(true); // Force log on initial detection
  }, 1000); // Wait a bit for page to fully load
  
  // Set up MutationObserver for dynamic forms
  formObserver = new MutationObserver(() => {
    // Re-run detection when DOM changes (debounced with longer delay)
    clearTimeout(detectionDebounceTimer);
    detectionDebounceTimer = setTimeout(() => {
      detectJobApplicationForm();
    }, 2000); // Increased to 2 seconds to reduce spam
  });
  
  formObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ============================================================================
// PHASE 5: AUTOFILL FUNCTIONALITY
// ============================================================================

// Backend API URL
const API_BASE_URL = 'http://localhost:8000';

// Autofill state
let autofillState = {
  isFilling: false,
  originalValues: new Map(), // Store original field values for undo
  fillProgress: { filled: 0, failed: 0, total: 0 }
};

/**
 * Get or create session start time (for tracking across multipage forms)
 * @returns {Promise<number>} - Session start timestamp
 */
async function getSessionStartTime() {
  return new Promise((resolve) => {
    chrome.storage.local.get([ANSWER_CACHE_CONFIG.SESSION_START_KEY], (result) => {
      const sessionStart = result[ANSWER_CACHE_CONFIG.SESSION_START_KEY];
      
      // If no session or session is too old (over 1 hour), start new session
      const now = Date.now();
      if (!sessionStart || (now - sessionStart) > ANSWER_CACHE_CONFIG.MAX_SESSION_TIME_MS) {
        const newSessionStart = now;
        chrome.storage.local.set({ [ANSWER_CACHE_CONFIG.SESSION_START_KEY]: newSessionStart }, () => {
          resolve(newSessionStart);
        });
      } else {
        resolve(sessionStart);
      }
    });
  });
}

/**
 * Clear session start time (call when user explicitly starts a new application)
 */
function clearSessionStartTime() {
  chrome.storage.local.remove([ANSWER_CACHE_CONFIG.SESSION_START_KEY]);
}

/**
 * Clean up expired cache entries (call periodically)
 */
async function cleanupExpiredCache() {
  try {
    const cacheData = await new Promise((resolve) => {
      chrome.storage.local.get([ANSWER_CACHE_CONFIG.STORAGE_KEY], (result) => {
        resolve(result[ANSWER_CACHE_CONFIG.STORAGE_KEY] || {});
      });
    });

    const now = Date.now();
    let cleaned = false;

    for (const [key, value] of Object.entries(cacheData)) {
      const cacheAge = now - value.timestamp;
      if (cacheAge > ANSWER_CACHE_CONFIG.EXPIRATION_TIME_MS) {
        delete cacheData[key];
        cleaned = true;
      }
    }

    if (cleaned) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ [ANSWER_CACHE_CONFIG.STORAGE_KEY]: cacheData }, resolve);
      });
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

// ============================================================================
// 5.1.1: DATA MAPPING
// ============================================================================

/**
 * Map stored resume data to form field values
 * @param {Object} resumeData - Parsed resume data from storage
 * @returns {Object} - Mapped field values
 */
function mapResumeDataToFields(resumeData) {
  if (!resumeData || !resumeData.data) {
    return {};
  }

  const data = resumeData.data;
  const mapped = {};

  // Split full name into first/last
  if (data.full_name) {
    const nameParts = data.full_name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      mapped.firstName = nameParts[0];
      mapped.lastName = nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1) {
      mapped.firstName = nameParts[0];
      mapped.lastName = '';
    }
  }

  // Contact information
  if (data.contact_info) {
    if (data.contact_info.email) {
      mapped.email = data.contact_info.email;
    }
    if (data.contact_info.phone) {
      mapped.phone = data.contact_info.phone;
    }
    if (data.contact_info.address) {
      // Try to parse address components if available
      mapped.address = data.contact_info.address;
    }
    if (data.contact_info.city) {
      mapped.city = data.contact_info.city;
    }
    if (data.contact_info.state) {
      mapped.state = data.contact_info.state;
    }
    if (data.contact_info.zipCode || data.contact_info.zip) {
      mapped.zipCode = data.contact_info.zipCode || data.contact_info.zip;
    }
    if (data.contact_info.country) {
      mapped.country = data.contact_info.country;
    }
    if (data.linkedin_url) {
      mapped.linkedIn = data.linkedin_url;
    }
    if (data.portfolio_url) {
      mapped.portfolio = data.portfolio_url;
    }
  }

  // Professional information
  if (data.experience && data.experience.length > 0) {
    const mostRecent = data.experience[0];
    if (mostRecent.title) {
      mapped.currentJobTitle = mostRecent.title;
    }
    if (mostRecent.company) {
      mapped.currentCompany = mostRecent.company;
    }

    // Calculate years of experience
    let totalYears = 0;
    for (const exp of data.experience) {
      if (exp.start_date && exp.end_date) {
        const start = parseDate(exp.start_date);
        const end = exp.end_date.toLowerCase().includes('present') || 
                    exp.end_date.toLowerCase().includes('current') 
                    ? new Date() 
                    : parseDate(exp.end_date);
        if (start && end) {
          const years = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
          totalYears += Math.max(0, years);
        }
      }
    }
    if (totalYears > 0) {
      mapped.yearsOfExperience = Math.round(totalYears * 10) / 10; // Round to 1 decimal
    }
  }

  // Education
  if (data.education && data.education.length > 0) {
    const mostRecent = data.education[0];
    if (mostRecent.institution) {
      mapped.school = mostRecent.institution;
    }
    if (mostRecent.degree) {
      mapped.degree = mostRecent.degree;
      if (mostRecent.major) {
        mapped.degree += ` in ${mostRecent.major}`;
      }
    }
    if (mostRecent.end_date) {
      mapped.graduationDate = formatDateForForm(mostRecent.end_date);
    }
    if (mostRecent.gpa) {
      mapped.gpa = mostRecent.gpa.toString();
    }
  }

  // Skills
  if (data.skills && Array.isArray(data.skills)) {
    const skillList = [];
    for (const skill of data.skills) {
      if (typeof skill === 'string') {
        skillList.push(skill);
      } else if (skill.keywords && Array.isArray(skill.keywords)) {
        skillList.push(...skill.keywords);
      }
    }
    if (skillList.length > 0) {
      mapped.skills = skillList.join(', ');
    }
  }

  return mapped;
}

/**
 * Map stored cover letter to field value
 * @param {Object} coverLetterData - Cover letter data from storage
 * @returns {string|null} - Cover letter text
 */
function mapCoverLetterData(coverLetterData) {
  if (!coverLetterData || !coverLetterData.text) {
    return null;
  }
  return coverLetterData.text;
}

/**
 * Map stored QA answers to field values
 * @param {Object} qaData - QA data from storage
 * @returns {Object} - Mapped field values
 */
function mapQADataToFields(qaData) {
  if (!qaData || !qaData.answers) {
    return {};
  }

  const answers = qaData.answers;
  const mapped = {};

  if (answers.salary) {
    mapped.salary = answers.salary;
  }
  if (answers.workAuthorization) {
    // Convert work authorization answer to yes/no for checkboxes/radios
    const authValue = String(answers.workAuthorization).toLowerCase().trim();
    if (authValue.includes('yes') || authValue.includes('eligible') || authValue.includes('authorized')) {
      mapped.workAuthorization = 'yes';
    } else if (authValue.includes('no') || authValue.includes('not')) {
      mapped.workAuthorization = 'no';
    } else {
      mapped.workAuthorization = answers.workAuthorization;
    }
  }

  return mapped;
}

/**
 * Combine all mapped data into a single object
 * @param {Object} resumeData - Resume data
 * @param {Object} coverLetterData - Cover letter data
 * @param {Object} qaData - QA data
 * @returns {Object} - Combined mapped data
 */
function combineMappedData(resumeData, coverLetterData, qaData) {
  const resumeMapped = mapResumeDataToFields(resumeData);
  const coverLetterText = mapCoverLetterData(coverLetterData);
  const qaMapped = mapQADataToFields(qaData);

  const combined = { ...resumeMapped, ...qaMapped };
  if (coverLetterText) {
    combined.coverLetter = coverLetterText;
  }

  return combined;
}

// ============================================================================
// 5.1.2: ANTI-BOT DETECTION AVOIDANCE
// ============================================================================

/**
 * Generate random delay between min and max milliseconds
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {number} - Random delay
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simulate human-like typing in a text field
 * @param {HTMLElement} element - Input element
 * @param {string} text - Text to type
 * @returns {Promise<void>}
 */
async function simulateTyping(element, text) {
  if (!text) return;

  // For short text, type character by character
  if (text.length <= 50) {
    for (let i = 0; i < text.length; i++) {
      element.value = text.substring(0, i + 1);
      dispatchInputEvent(element);
      await sleep(randomDelay(30, 80)); // Typing speed: 30-80ms per character
    }
  } else {
    // For longer text, type in chunks with occasional pauses
    const chunkSize = 10;
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, Math.min(i + chunkSize, text.length));
      element.value = text.substring(0, i + chunkSize);
      dispatchInputEvent(element);
      
      // Occasional longer pause to simulate thinking/reading
      const delay = Math.random() < 0.1 ? randomDelay(200, 500) : randomDelay(50, 150);
      await sleep(delay);
    }
  }
}

/**
 * Dispatch input events in sequence (focus, click, input, change, blur)
 * @param {HTMLElement} element - Element to dispatch events on
 */
function dispatchInputEvent(element) {
  // Focus event
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  
  // Small delay before click
  setTimeout(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Input event
    setTimeout(() => {
      element.dispatchEvent(new InputEvent('input', { bubbles: true, data: element.value }));
      
      // Change event
      setTimeout(() => {
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }, randomDelay(10, 30));
    }, randomDelay(10, 30));
  }, randomDelay(10, 30));
}

/**
 * Scroll element into view if needed
 * @param {HTMLElement} element - Element to scroll to
 */
function scrollToElement(element) {
  const rect = element.getBoundingClientRect();
  const isVisible = rect.top >= 0 && rect.left >= 0 && 
                    rect.bottom <= window.innerHeight && 
                    rect.right <= window.innerWidth;
  
  if (!isVisible) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Wait for scroll to complete
    return new Promise(resolve => setTimeout(resolve, 300));
  }
  return Promise.resolve();
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 5.1.7: SMART FIELD MATCHING
// ============================================================================

/**
 * Parse date string into Date object
 * @param {string} dateStr - Date string
 * @returns {Date|null} - Parsed date or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Try various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try parsing common formats manually
    const patterns = [
      /(\w+)\s+(\d{4})/, // "July 2022"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // "7/15/2022"
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // "2022-07-15"
    ];
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        return new Date(dateStr);
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Format date for form input (various formats)
 * @param {string|Date} date - Date to format
 * @param {string} format - Desired format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
 * @returns {string} - Formatted date string
 */
function formatDateForForm(date, format = 'MM/DD/YYYY') {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : parseDate(date);
  if (!dateObj) return date.toString(); // Fallback to original string
  
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
    default:
      return `${month}/${day}/${year}`;
  }
}

/**
 * Match dropdown option by text or value (fuzzy matching)
 * @param {HTMLSelectElement} select - Select element
 * @param {string} targetValue - Value to match
 * @returns {HTMLOptionElement|null} - Matching option or null
 */
function findMatchingOption(select, targetValue) {
  if (!targetValue) return null;
  
  const normalizedTarget = targetValue.toLowerCase().trim();
  
  // First try exact match
  for (const option of select.options) {
    if (option.value.toLowerCase() === normalizedTarget || 
        option.text.toLowerCase() === normalizedTarget) {
      return option;
    }
  }
  
  // Try contains match
  for (const option of select.options) {
    const optionText = option.text.toLowerCase();
    const optionValue = option.value.toLowerCase();
    
    if (optionText.includes(normalizedTarget) || 
        normalizedTarget.includes(optionText) ||
        optionValue.includes(normalizedTarget) ||
        normalizedTarget.includes(optionValue)) {
      return option;
    }
  }
  
  // Try fuzzy matching for common variations (e.g., "United States" vs "USA" vs "US")
  const variations = {
    'united states': ['usa', 'us', 'united states of america', 'u.s.', 'u.s.a.'],
    'united kingdom': ['uk', 'u.k.', 'great britain', 'britain'],
    'canada': ['ca', 'can'],
  };
  
  for (const [key, variants] of Object.entries(variations)) {
    if (normalizedTarget === key || variants.includes(normalizedTarget)) {
      for (const option of select.options) {
        const optionText = option.text.toLowerCase();
        if (optionText === key || variants.some(v => optionText.includes(v))) {
          return option;
        }
      }
    }
  }
  
  return null;
}

/**
 * Format phone number to match expected format
 * @param {string} phone - Phone number
 * @param {string} format - Desired format ((XXX) XXX-XXXX, XXX-XXX-XXXX, etc.)
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phone, format = '(XXX) XXX-XXXX') {
  if (!phone) return '';
  
  // Extract digits only
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone; // Return original if invalid
  
  const areaCode = digits.substring(0, 3);
  const firstPart = digits.substring(3, 6);
  const secondPart = digits.substring(6, 10);
  
  switch (format) {
    case '(XXX) XXX-XXXX':
      return `(${areaCode}) ${firstPart}-${secondPart}`;
    case 'XXX-XXX-XXXX':
      return `${areaCode}-${firstPart}-${secondPart}`;
    case 'XXX.XXX.XXXX':
      return `${areaCode}.${firstPart}.${secondPart}`;
    default:
      return `(${areaCode}) ${firstPart}-${secondPart}`;
  }
}

// ============================================================================
// 5.1.3: AUTOFILL LOGIC
// ============================================================================

/**
 * Fill a single form field with value
 * @param {HTMLElement} element - Form element
 * @param {*} value - Value to fill
 * @param {string} fieldType - Field type identifier
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function fillField(element, value, fieldType) {
  if (!element || value === null || value === undefined) {
    return { success: false, error: 'Invalid element or value' };
  }

  // Safety check: skip Select2 hidden inputs
  if (element.classList.contains('select2-offscreen') || 
      element.classList.contains('select2-focusser') ||
      element.classList.contains('select2-input') ||
      element.hasAttribute('aria-haspopup')) {
    return { success: false, error: 'Skipped Select2 hidden input' };
  }

  // Safety check: skip buttons (submit, button, reset types)
  const tagName = element.tagName.toLowerCase();
  const inputType = element.type ? element.type.toLowerCase() : '';
  if (tagName === 'button' || inputType === 'button' || inputType === 'submit' || inputType === 'reset') {
    return { success: false, error: 'Skipped button element' };
  }

  // Safety check: skip password, credit card, SSN fields
  if (isSensitiveField(element)) {
    return { success: false, error: 'Skipped sensitive field' };
  }

  // Check if field is visible and enabled
  if (!isElementVisible(element) || element.disabled || element.readOnly) {
    return { success: false, error: 'Field not visible or disabled' };
  }

  try {
    // Scroll to element
    await scrollToElement(element);

    // Store original value for undo
    if (!autofillState.originalValues.has(element)) {
      autofillState.originalValues.set(element, element.value || element.textContent || '');
    }

    // Add small delay before filling
    await sleep(randomDelay(50, 200));

    // Handle different input types
    if (tagName === 'input') {
      if (inputType === 'text' || inputType === 'email' || inputType === 'tel' || inputType === 'url') {
        // Text inputs - use typing simulation for longer text
        if (String(value).length > 20) {
          await simulateTyping(element, String(value));
        } else {
          element.value = String(value);
          dispatchInputEvent(element);
          await sleep(randomDelay(50, 150));
        }
      } else if (inputType === 'checkbox') {
        // Checkbox - set checked based on value
        // Handle boolean, yes/no, true/false values
        let shouldCheck = false;
        if (typeof value === 'boolean') {
          shouldCheck = value;
        } else if (typeof value === 'string') {
          const lowerValue = value.toLowerCase().trim();
          shouldCheck = lowerValue === 'yes' || lowerValue === 'true' || lowerValue === '1' || lowerValue === 'y';
        } else {
          shouldCheck = Boolean(value);
        }
        element.checked = shouldCheck;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('click', { bubbles: true }));
        await sleep(randomDelay(50, 150));
      } else if (inputType === 'radio') {
        // Radio button - find matching option and check it
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
        const valueStr = String(value).toLowerCase().trim();
        let found = false;
        
        for (const radio of radioGroup) {
          const radioValue = radio.value.toLowerCase().trim();
          const radioLabel = findAssociatedLabel(radio)?.textContent?.toLowerCase().trim() || '';
          
          // Try to match by value or label
          if (radioValue === valueStr || 
              radioLabel === valueStr ||
              radioLabel.includes(valueStr) ||
              valueStr.includes(radioValue) ||
              (valueStr === 'yes' && (radioValue === 'yes' || radioValue === 'true' || radioLabel.includes('yes'))) ||
              (valueStr === 'no' && (radioValue === 'no' || radioValue === 'false' || radioLabel.includes('no')))) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            radio.dispatchEvent(new Event('click', { bubbles: true }));
            found = true;
            break;
          }
        }
        
        if (!found) {
          return { success: false, error: 'No matching radio option found' };
        }
        await sleep(randomDelay(50, 150));
      } else if (inputType === 'date' || inputType === 'month' || inputType === 'year') {
        // Date inputs - format appropriately
        const formattedDate = formatDateForForm(value, 'YYYY-MM-DD');
        element.value = formattedDate;
        dispatchInputEvent(element);
        await sleep(randomDelay(50, 150));
      } else {
        // Other input types
        element.value = String(value);
        dispatchInputEvent(element);
        await sleep(randomDelay(50, 150));
      }
    } else if (tagName === 'textarea') {
      // Textarea - use typing simulation for longer text
      if (String(value).length > 50) {
        await simulateTyping(element, String(value));
      } else {
        element.value = String(value);
        dispatchInputEvent(element);
        await sleep(randomDelay(100, 300)); // Longer delay for textareas
      }
    } else if (tagName === 'select') {
      // Select dropdown
      const option = findMatchingOption(element, String(value));
      if (option) {
        element.value = option.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(randomDelay(100, 200));
      } else {
        return { success: false, error: 'No matching option found' };
      }
    } else {
      // Other elements (div with contenteditable, etc.)
      element.textContent = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(randomDelay(50, 150));
    }

    // Verify value was set
    const actualValue = element.value || element.textContent || '';
    if (actualValue && actualValue.includes(String(value).substring(0, Math.min(10, String(value).length)))) {
      return { success: true };
    } else {
      return { success: false, error: 'Value not set correctly' };
    }
  } catch (error) {
    console.error(`Error filling field ${fieldType}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if field is sensitive (password, credit card, SSN)
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - Whether field is sensitive
 */
function isSensitiveField(element) {
  if (element.type === 'password') return true;
  
  const name = (element.name || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const label = findAssociatedLabel(element);
  const labelText = label ? (label.textContent || '').toLowerCase() : '';
  
  const sensitiveKeywords = ['password', 'credit', 'card', 'ssn', 'social security', 'cvv', 'cvc'];
  
  for (const keyword of sensitiveKeywords) {
    if (name.includes(keyword) || id.includes(keyword) || labelText.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Main autofill function
 * @param {Object} fieldMapping - Detected fields mapping { fieldType: HTMLElement }
 * @param {Object} userData - Combined mapped user data
 * @param {Object} personalizedAnswers - Personalized answers for questions
 * @param {Array<string>} selectedFields - Optional: array of field types to fill (if selective)
 * @returns {Promise<{success: boolean, filled: number, failed: number, errors: Array}>}
 */
async function autofillForm(fieldMapping, userData, personalizedAnswers = {}, selectedFields = null) {
  if (autofillState.isFilling) {
    return { success: false, filled: 0, failed: 0, errors: ['Autofill already in progress'] };
  }

  autofillState.isFilling = true;
  autofillState.fillProgress = { filled: 0, failed: 0, total: 0 };
  const errors = [];

  try {
    // Combine user data with personalized answers
    const allData = { ...userData, ...personalizedAnswers };

    // Determine which fields to fill
    const fieldsToFill = selectedFields || Object.keys(fieldMapping);
    autofillState.fillProgress.total = fieldsToFill.length;

    // Fill fields one by one with delays
    for (const fieldType of fieldsToFill) {
      const element = fieldMapping[fieldType];
      if (!element) {
        errors.push({ field: fieldType, error: 'Element not found' });
        autofillState.fillProgress.failed++;
        continue;
      }

      const value = allData[fieldType];
      if (value === null || value === undefined || value === '') {
        errors.push({ field: fieldType, error: 'No data available' });
        autofillState.fillProgress.failed++;
        continue;
      }

      // Special handling for phone numbers
      let processedValue = value;
      if (fieldType === 'phone') {
        processedValue = formatPhoneNumber(String(value));
      }

      const result = await fillField(element, processedValue, fieldType);
      
      if (result.success) {
        autofillState.fillProgress.filled++;
      } else {
        autofillState.fillProgress.failed++;
        errors.push({ field: fieldType, error: result.error || 'Unknown error' });
      }

      // Add delay between fields (human-like pace)
      await sleep(randomDelay(100, 300));
    }

    return {
      success: autofillState.fillProgress.filled > 0,
      filled: autofillState.fillProgress.filled,
      failed: autofillState.fillProgress.failed,
      errors: errors
    };
  } finally {
    autofillState.isFilling = false;
  }
}

// ============================================================================
// 5.1.5: FILE UPLOAD HANDLING
// ============================================================================

/**
 * Attempt to upload file to file input
 * @param {HTMLInputElement} fileInput - File input element
 * @param {Blob} fileBlob - File blob to upload
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function uploadFileToInput(fileInput, fileBlob) {
  if (!fileInput || fileInput.type !== 'file') {
    return { success: false, error: 'Invalid file input' };
  }

  try {
    // Approach 1: Try DataTransfer API (may not work due to browser security)
    const dataTransfer = new DataTransfer();
    // Use the fileBlob's name if it's a File, otherwise use a generic name
    // If fileBlob is already a File, use it directly; otherwise create a new File
    const file = fileBlob instanceof File 
      ? fileBlob 
      : new File([fileBlob], fileBlob.name || 'document', { type: fileBlob.type || 'application/octet-stream' });
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    // Trigger change event
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Check if file was set
    if (fileInput.files && fileInput.files.length > 0) {
      return { success: true };
    }

    return { success: false, error: 'File could not be set programmatically' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle resume/cover letter file upload
 * @param {HTMLElement} fileInput - File input element
 * @param {Object} fileData - File data from storage { name, fileData (base64) }
 * @returns {Promise<{success: boolean, error?: string, needsManualUpload?: boolean}>}
 */
async function handleFileUpload(fileInput, fileData) {
  if (!fileData || !fileData.fileData) {
    return { success: false, error: 'No file data available' };
  }

  try {
    // Convert base64 to blob
    let blob;
    if (typeof fileData.fileData === 'string') {
      const byteCharacters = atob(fileData.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Determine MIME type based on file extension
      const fileName = fileData.name || '';
      let mimeType = 'application/octet-stream'; // default
      const lowerName = fileName.toLowerCase();
      
      if (lowerName.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (lowerName.endsWith('.docx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (lowerName.endsWith('.doc')) {
        mimeType = 'application/msword';
      } else if (lowerName.endsWith('.txt')) {
        mimeType = 'text/plain';
      } else if (lowerName.endsWith('.rtf')) {
        mimeType = 'application/rtf';
      }
      
      // Create File object instead of Blob to preserve name
      const file = new File([byteArray], fileName || 'document', { type: mimeType });
      blob = file; // File extends Blob, so this works
    } else {
      return { success: false, error: 'Invalid file data format' };
    }

    // Try to upload programmatically
    const result = await uploadFileToInput(fileInput, blob);
    
    if (result.success) {
      return { success: true };
    } else {
      // Fallback: show notification for manual upload
      return { 
        success: false, 
        error: result.error,
        needsManualUpload: true,
        downloadUrl: URL.createObjectURL(blob),
        fileName: fileData.name
      };
    }
  } catch (error) {
    return { success: false, error: error.message, needsManualUpload: true };
  }
}

// ============================================================================
// 5.1.6: PERSONALIZED QUESTION ANSWERING
// ============================================================================

/**
 * Detect personalized questions from form fields
 * @param {Object} fieldMapping - Detected fields
 * @returns {Array<string>} - Array of personalized questions
 */
function detectPersonalizedQuestions(fieldMapping) {
  const personalizedFieldTypes = ['whyWorkHere', 'whyYou'];
  const questions = [];

  for (const fieldType of personalizedFieldTypes) {
    if (fieldMapping[fieldType]) {
      const element = fieldMapping[fieldType];
      const label = findAssociatedLabel(element);
      const questionText = label ? label.textContent.trim() : 
                          element.placeholder || 
                          element.getAttribute('aria-label') || 
                          fieldType;
      questions.push(questionText);
    }
  }

  // Also check for textareas that might contain personalized questions
  const textareas = document.querySelectorAll('textarea');
  for (const textarea of textareas) {
    const label = findAssociatedLabel(textarea);
    const labelText = label ? label.textContent.toLowerCase() : '';
    const placeholder = (textarea.placeholder || '').toLowerCase();
    
    if (labelText.includes('why') || placeholder.includes('why') ||
        labelText.includes('interested') || placeholder.includes('interested') ||
        labelText.includes('fit') || placeholder.includes('fit') ||
        labelText.includes('qualified') || placeholder.includes('qualified')) {
      const questionText = label ? label.textContent.trim() : textarea.placeholder || 'Question';
      if (!questions.includes(questionText)) {
        questions.push(questionText);
      }
    }
  }

  return questions;
}

/**
 * Generate a cache key from resume data and questions
 * @param {Object} resumeData - Resume data
 * @param {Array<string>} questions - Questions array
 * @returns {string} - Cache key (hash)
 */
function generateCacheKey(resumeData, questions) {
  // Create a simple hash from resume data and questions
  const resumeHash = resumeData?.data?.full_name || 'no_name';
  const questionsHash = questions.sort().join('|');
  return `${resumeHash}_${questionsHash}`.substring(0, 100); // Limit length
}

/**
 * Get cached answers if available and not expired
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} - Cached answers or null
 */
async function getCachedAnswers(cacheKey) {
  try {
    const cacheData = await new Promise((resolve) => {
      chrome.storage.local.get([ANSWER_CACHE_CONFIG.STORAGE_KEY], (result) => {
        resolve(result[ANSWER_CACHE_CONFIG.STORAGE_KEY] || {});
      });
    });

    const cached = cacheData[cacheKey];
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const now = Date.now();
    const cacheAge = now - cached.timestamp;
    
    if (cacheAge > ANSWER_CACHE_CONFIG.EXPIRATION_TIME_MS) {
      // Cache expired, remove it
      delete cacheData[cacheKey];
      await new Promise((resolve) => {
        chrome.storage.local.set({ [ANSWER_CACHE_CONFIG.STORAGE_KEY]: cacheData }, resolve);
      });
      return null;
    }

    return cached.answers;
  } catch (error) {
    console.error('Error getting cached answers:', error);
    return null;
  }
}

/**
 * Store answers in cache
 * @param {string} cacheKey - Cache key
 * @param {Object} answers - Answers to cache
 */
async function setCachedAnswers(cacheKey, answers) {
  try {
    const cacheData = await new Promise((resolve) => {
      chrome.storage.local.get([ANSWER_CACHE_CONFIG.STORAGE_KEY], (result) => {
        resolve(result[ANSWER_CACHE_CONFIG.STORAGE_KEY] || {});
      });
    });

    // Add new cache entry
    cacheData[cacheKey] = {
      answers: answers,
      timestamp: Date.now()
    };

    // Limit cache size - remove oldest entries if over limit
    const entries = Object.entries(cacheData);
    if (entries.length > ANSWER_CACHE_CONFIG.MAX_CACHE_SIZE) {
      // Sort by timestamp (oldest first) and remove excess
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.length - ANSWER_CACHE_CONFIG.MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        delete cacheData[entries[i][0]];
      }
    }

    await new Promise((resolve) => {
      chrome.storage.local.set({ [ANSWER_CACHE_CONFIG.STORAGE_KEY]: cacheData }, resolve);
    });
  } catch (error) {
    console.error('Error caching answers:', error);
  }
}

/**
 * Check if we should skip LLM call based on time constraints
 * @param {number} sessionStartTime - Timestamp when session started
 * @returns {boolean} - True if we should skip (too much time has passed)
 */
function shouldSkipLLMCall(sessionStartTime) {
  if (!sessionStartTime) {
    return false; // No session tracking, allow call
  }

  const sessionDuration = Date.now() - sessionStartTime;

  if (sessionDuration > ANSWER_CACHE_CONFIG.MAX_SESSION_TIME_MS) {
    return true;
  }

  return false;
}

/**
 * Generate personalized answers using LLM (called only when cache miss)
 * Note: Cache checking is done in handleFillFormClick before calling this function
 * @param {Object} resumeData - Resume data
 * @param {string} coverLetterText - Cover letter text
 * @param {Object} qaAnswers - Stored QA answers
 * @param {Array<string>} questions - Detected questions
 * @param {string} jobContext - Optional job description/context
 * @param {number} sessionStartTime - Optional session start time for budget control
 * @returns {Promise<Object>} - Answers object { question: answer }
 */
async function generatePersonalizedAnswers(resumeData, coverLetterText, qaAnswers, questions, jobContext = '', sessionStartTime = null) {
  if (!questions || questions.length === 0) {
    return {};
  }

  // Check if we should skip LLM call due to time constraints
  if (shouldSkipLLMCall(sessionStartTime)) {
    return {}; // Return empty to avoid costs
  }

  // Generate cache key for storing the result
  const cacheKey = generateCacheKey(resumeData, questions);

  // Make LLM call (cache was already checked by caller)
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-personalized-answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resume_data: resumeData?.data || null,
        cover_letter_text: coverLetterText || '',
        qa_answers: qaAnswers?.answers || {},
        questions: questions,
        job_context: jobContext
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const answers = result.answers || {};

    // Cache the answers for future use
    if (Object.keys(answers).length > 0) {
      await setCachedAnswers(cacheKey, answers);
    }

    return answers;
  } catch (error) {
    console.error('Error generating personalized answers:', error);
    return {}; // Return empty object on error
  }
}

// ============================================================================
// 5.1.4 & 5.1.9: USER CONTROL & UI INTEGRATION
// ============================================================================

/**
 * Show autofill preview dialog
 * @param {Object} fieldMapping - Detected fields
 * @param {Object} userData - Mapped user data
 * @returns {Promise<{confirmed: boolean, selectedFields?: Array<string>}>}
 */
function showAutofillPreview(fieldMapping, userData) {
  return new Promise((resolve) => {
    // Create preview modal
    const modal = document.createElement('div');
    modal.id = 'autoaapply-preview-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
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
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    const fieldsList = Object.keys(fieldMapping).filter(fieldType => userData[fieldType] !== undefined);
    
    let previewHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Autofill Preview</h2>
      <p style="margin: 0 0 16px 0; color: #666;">Review what will be filled:</p>
      <div style="max-height: 400px; overflow-y: auto; margin-bottom: 16px;">
    `;

    const selectedFields = new Set(fieldsList);

    for (const fieldType of fieldsList) {
      const element = fieldMapping[fieldType];
      const value = userData[fieldType];
      const label = findAssociatedLabel(element)?.textContent?.trim() || 
                   element.placeholder || 
                   fieldType;
      
      const displayValue = String(value).length > 50 
        ? String(value).substring(0, 50) + '...' 
        : String(value);

      previewHTML += `
        <label style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
          <input type="checkbox" checked style="margin-right: 12px;" data-field="${fieldType}">
          <div style="flex: 1;">
            <strong>${label}</strong>
            <div style="color: #666; font-size: 14px; margin-top: 4px;">${displayValue}</div>
          </div>
        </label>
      `;
    }

    previewHTML += `</div>`;

    previewHTML += `
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="autoaapply-preview-cancel" style="
          padding: 10px 20px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        ">Cancel</button>
        <button id="autoaapply-preview-confirm" style="
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          background: #4CAF50;
          color: white;
          cursor: pointer;
        ">Fill Selected Fields</button>
      </div>
    `;

    modalContent.innerHTML = previewHTML;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Handle checkbox changes
    modalContent.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const fieldType = e.target.dataset.field;
        if (e.target.checked) {
          selectedFields.add(fieldType);
        } else {
          selectedFields.delete(fieldType);
        }
      });
    });

    // Handle cancel
    modalContent.querySelector('#autoaapply-preview-cancel').addEventListener('click', () => {
      modal.remove();
      resolve({ confirmed: false });
    });

    // Handle confirm
    modalContent.querySelector('#autoaapply-preview-confirm').addEventListener('click', () => {
      modal.remove();
      resolve({ confirmed: true, selectedFields: Array.from(selectedFields) });
    });
  });
}

/**
 * Show fill status notification
 * @param {Object} result - Fill result { filled, failed, errors }
 */
function showFillStatus(result) {
  const indicator = document.getElementById('autoaapply-indicator');
  if (!indicator) return;

  // Update indicator with status
  const statusDiv = indicator.querySelector('.autoaapply-status') || document.createElement('div');
  statusDiv.className = 'autoaapply-status';
  statusDiv.style.cssText = `
    margin-top: 12px;
    padding: 12px;
    border-radius: 6px;
    background: ${result.failed === 0 ? '#d4edda' : '#fff3cd'};
    color: ${result.failed === 0 ? '#155724' : '#856404'};
    font-size: 13px;
  `;

  let statusText = `✓ Filled ${result.filled} field(s)`;
  if (result.failed > 0) {
    statusText += `, ✗ ${result.failed} failed`;
  }

  statusDiv.textContent = statusText;
  
  if (!indicator.querySelector('.autoaapply-status')) {
    indicator.appendChild(statusDiv);
  }

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (statusDiv.parentNode) {
      statusDiv.remove();
    }
  }, 5000);
}

/**
 * Update visual indicator to include Fill Form button
 */
function updateVisualIndicatorWithAutofill() {
  const indicator = document.getElementById('autoaapply-indicator');
  if (!indicator || !detectionState.isJobForm) return;

  // Check if Fill Form button already exists
  if (indicator.querySelector('#autoaapply-fill-form')) return;

  const buttonContainer = indicator.querySelector('div:last-child');
  if (!buttonContainer) return;

  // Create Fill Form button
  const fillButton = document.createElement('button');
  fillButton.id = 'autoaapply-fill-form';
  fillButton.textContent = 'Fill Form';
  fillButton.style.cssText = `
    background: #4CAF50;
    border: none;
    color: white;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    width: 100%;
    margin-top: 8px;
  `;

  fillButton.addEventListener('click', async () => {
    await handleFillFormClick();
  });

  buttonContainer.appendChild(fillButton);
}

/**
 * Handle Fill Form button click
 */
async function handleFillFormClick() {
  try {
    // Get or create session start time for budget control (tracks across multipage forms)
    const sessionStartTime = await getSessionStartTime();
    
    // Clean up expired cache entries periodically
    await cleanupExpiredCache();
    
    // Get stored data
    const resumeData = await getStoredData('resume');
    const coverLetterData = await getStoredData('coverLetter');
    const qaData = await getStoredData('qa');

    if (!resumeData && !coverLetterData && !qaData) {
      alert('No stored data found. Please upload your resume, cover letter, or QA sheet first.');
      return;
    }

    // Map data to fields
    const userData = combineMappedData(resumeData, coverLetterData, qaData);
    console.log('AutoApply.AI: Combined user data:', userData);
    console.log('AutoApply.AI: Detection state fields:', Object.keys(detectionState.fields));

    // Detect personalized questions
    const questions = detectPersonalizedQuestions(detectionState.fields);
    
    // Generate personalized answers if needed (with session time tracking)
    let personalizedAnswers = {};
    let usedCache = false;
    if (questions.length > 0) {
      const jobContext = extractJobContext();
      
      // Check cache first
      const cacheKey = generateCacheKey(resumeData, questions);
      const cachedAnswers = await getCachedAnswers(cacheKey);
      
      if (cachedAnswers) {
        personalizedAnswers = cachedAnswers;
      } else {
        // Check session time limit before making LLM call
        if (shouldSkipLLMCall(sessionStartTime)) {
          // Show user notification
          showBudgetProtectionNotification();
        } else {
          personalizedAnswers = await generatePersonalizedAnswers(
            resumeData,
            coverLetterData?.text,
            qaData,
            questions,
            jobContext,
            sessionStartTime // Pass session start time for budget control
          );
        }
      }
    }

    // Check if we have any fields detected
    if (Object.keys(detectionState.fields).length === 0) {
      alert('No form fields detected! Please make sure you are on a job application form page.');
      return;
    }
    
    // Check if we have any data
    if (Object.keys(userData).length === 0) {
      alert('No user data available! Please upload your resume first.');
      return;
    }

    // Show preview and get confirmation
    const preview = await showAutofillPreview(detectionState.fields, { ...userData, ...personalizedAnswers });
    
    if (!preview.confirmed) {
      return;
    }

    // Perform autofill
    const result = await autofillForm(
      detectionState.fields,
      userData,
      personalizedAnswers,
      preview.selectedFields
    );

    // Show status
    showFillStatus(result);

    // Handle file uploads for resume/cover letter
    if (detectionState.fields.resume && resumeData?.originalFile) {
      const fileInput = detectionState.fields.resume;
      const uploadResult = await handleFileUpload(fileInput, resumeData.originalFile);
      if (uploadResult.needsManualUpload) {
        showManualUploadNotification('resume', uploadResult.downloadUrl, uploadResult.fileName);
      }
    }

    if (detectionState.fields.coverLetter && coverLetterData?.originalFile) {
      const fileInput = detectionState.fields.coverLetter;
      const uploadResult = await handleFileUpload(fileInput, coverLetterData.originalFile);
      if (uploadResult.needsManualUpload) {
        showManualUploadNotification('cover letter', uploadResult.downloadUrl, uploadResult.fileName);
      }
    }

  } catch (error) {
    console.error('Error in handleFillFormClick:', error);
    alert(`Error filling form: ${error.message}`);
  }
}

/**
 * Get stored data from Chrome storage
 * @param {string} type - 'resume', 'coverLetter', or 'qa'
 * @returns {Promise<Object|null>}
 */
function getStoredData(type) {
  return new Promise((resolve) => {
    chrome.storage.local.get([type], (result) => {
      resolve(result[type] || null);
    });
  });
}

/**
 * Extract job context from page (job description, company info)
 * @returns {string} - Job context text
 */
function extractJobContext() {
  // Try to find job description on page
  const selectors = [
    '[data-job-description]',
    '.job-description',
    '#job-description',
    '[class*="description"]',
    '[id*="description"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim().substring(0, 1000); // Limit to 1000 chars
    }
  }

  return '';
}

/**
 * Show budget protection notification (when session time limit exceeded)
 */
function showBudgetProtectionNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 6px;
    padding: 16px;
    max-width: 300px;
    z-index: 100001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  notification.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: 600; color: #856404;">Budget Protection Active</div>
    <div style="margin-bottom: 12px; font-size: 13px; color: #666;">
      Session time limit reached (1 hour). LLM calls are disabled to protect your budget.
      <br><br>
      <strong>Tip:</strong> Cached answers are still available for previously seen questions.
    </div>
    <button id="autoaapply-budget-notification-close" style="
      width: 100%;
      padding: 6px;
      border: none;
      border-radius: 4px;
      background: #ffc107;
      color: #000;
      cursor: pointer;
      font-size: 12px;
    ">Close</button>
  `;

  document.body.appendChild(notification);

  notification.querySelector('#autoaapply-budget-notification-close').addEventListener('click', () => {
    notification.remove();
  });

  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 8000);
}

/**
 * Show manual upload notification
 * @param {string} fileType - 'resume' or 'cover letter'
 * @param {string} downloadUrl - URL to download file
 * @param {string} fileName - File name
 */
function showManualUploadNotification(fileType, downloadUrl, fileName) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 6px;
    padding: 16px;
    max-width: 300px;
    z-index: 100001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  notification.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: 600;">Manual Upload Required</div>
    <div style="margin-bottom: 12px; font-size: 13px; color: #666;">
      Please manually upload your ${fileType}. 
      <a href="${downloadUrl}" download="${fileName}" style="color: #0066cc;">Click here to download</a>.
    </div>
    <button id="autoaapply-notification-close" style="
      width: 100%;
      padding: 6px;
      border: none;
      border-radius: 4px;
      background: #ffc107;
      color: #000;
      cursor: pointer;
      font-size: 12px;
    ">Close</button>
  `;

  document.body.appendChild(notification);

  notification.querySelector('#autoaapply-notification-close').addEventListener('click', () => {
    notification.remove();
    if (downloadUrl.startsWith('blob:')) {
      URL.revokeObjectURL(downloadUrl);
    }
  });

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
      if (downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl);
      }
    }
  }, 10000);
}

// ============================================================================
// 5.1.8: SAFETY & VALIDATION
// ============================================================================

/**
 * Undo autofill - restore original field values
 */
function undoAutofill() {
  let restored = 0;
  for (const [element, originalValue] of autofillState.originalValues.entries()) {
    try {
      if (element.tagName.toLowerCase() === 'input' && element.type === 'checkbox') {
        element.checked = Boolean(originalValue);
      } else {
        element.value = originalValue;
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
      restored++;
    } catch (error) {
      console.error('Error restoring field value:', error);
    }
  }
  
  autofillState.originalValues.clear();
  return restored;
}

// Update visual indicator when form is detected to include Fill Form button
const originalShowVisualIndicator = showVisualIndicator;
showVisualIndicator = function() {
  originalShowVisualIndicator();
  setTimeout(() => {
    updateVisualIndicatorWithAutofill();
  }, 100);
};

// Listen for autofill requests from popup/background
try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autofillForm') {
      handleFillFormClick().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response
    }
    
    if (request.action === 'undoAutofill') {
      const restored = undoAutofill();
      sendResponse({ success: true, restored });
      return true;
    }
  });
} catch (error) {
  console.warn('Could not set up autofill message listener:', error);
}
