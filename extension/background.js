// Background service worker - runs in the background
// 
// IMPORTANT: This script runs CONTINUOUSLY, not just on install!
// It's a service worker that:
// - Starts when extension loads
// - Stays running even when popup is closed
// - Can wake up when events happen
// - Handles events like installation, updates, messages, etc.

console.log('AutoApply.AI background service worker loaded');

// Listen for extension installation
// NOTE: This is just ONE event - the script itself runs continuously
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    console.log('First time installation');
    // Could open welcome page here
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Listen for messages from content scripts or popup
// NOTE: This listener is ALWAYS active - it can receive messages at ANY time
// Even when popup is closed, this is still listening!
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Background worker is alive' });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'formDetected') {
    logFormDetection(request.data);
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

/**
 * Log form detection events
 * @param {Object} data - Detection data
 */
function logFormDetection(data) {
  console.log('AutoApply.AI: Form detection logged:', {
    platform: data.platform,
    fieldCount: data.fieldCount,
    fields: data.fields,
    url: data.url,
    timestamp: data.timestamp
  });
  
  // Store detection statistics (optional)
  chrome.storage.local.get(['detectionStats'], (result) => {
    const stats = result.detectionStats || {
      totalDetections: 0,
      platforms: {},
      fieldCounts: []
    };
    
    stats.totalDetections++;
    
    // Track platform frequency
    if (!stats.platforms[data.platform]) {
      stats.platforms[data.platform] = 0;
    }
    stats.platforms[data.platform]++;
    
    // Track field count distribution
    stats.fieldCounts.push(data.fieldCount);
    if (stats.fieldCounts.length > 100) {
      stats.fieldCounts.shift(); // Keep only last 100
    }
    
    chrome.storage.local.set({ detectionStats: stats });
  });
}
