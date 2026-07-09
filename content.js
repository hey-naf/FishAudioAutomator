// Inject CSS to hide Radix dropdown menus during background scans
(function() {
  const style = document.createElement('style');
  style.textContent = `
    html.fish-automator-scanning [data-radix-popper-content-wrapper],
    html.fish-automator-scanning [role="menu"],
    html.fish-automator-scanning [class*="dashboard-user-menu-panel"] {
      opacity: 0 !important;
      pointer-events: none !important;
      transform: scale(0) !important;
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
})();

// Fish Audio selectors
const SELECTORS = {
  textInput: '.tiptap.ProseMirror',
  downloadBtn: 'button[aria-label="Download"]',
  closePopup: 'button[aria-label="Close upgrade dialog"]'
};

let chunks = [];
let currentChunkIndex = 0;
let isPaused = false;
let isStopped = false;

// Helper function to find element by text
function findElementByText(selector, text) {
  const elements = document.querySelectorAll(selector);
  const lowerText = text.toLowerCase();
  for (let el of elements) {
    if (el.textContent.toLowerCase().includes(lowerText)) {
      return el;
    }
  }
  return null;
}

// Simulate click with a full suite of pointer, mouse, and click events for modern UI framework compatibility (React/Vue/Radix)
function simulateClick(element) {
  if (!element) return;
  
  const eventTypes = [
    { type: 'pointerdown', bubbles: true, cancelable: true, pointerId: 1, isPrimary: true },
    { type: 'mousedown', bubbles: true, cancelable: true, button: 0 },
    { type: 'pointerup', bubbles: true, cancelable: true, pointerId: 1, isPrimary: true },
    { type: 'mouseup', bubbles: true, cancelable: true, button: 0 }
  ];
  
  eventTypes.forEach(evtData => {
    try {
      let event;
      if (evtData.type.startsWith('pointer')) {
        event = new PointerEvent(evtData.type, evtData);
      } else {
        event = new MouseEvent(evtData.type, evtData);
      }
      element.dispatchEvent(event);
    } catch (err) {
      console.error(`[Fish Automator] Failed to dispatch ${evtData.type}:`, err);
    }
  });

  // Call the native click method once to trigger downloads
  try {
    element.click();
  } catch (e) {
    console.error('[Fish Automator] Standard click failed:', e);
  }
}

// Find download buttons dynamically and robustly across languages/formats
function findDownloadButtons() {
  const list = [];
  
  const selectors = [
    'button[aria-label*="download" i]',
    'a[aria-label*="download" i]',
    'button[title*="download" i]',
    'a[title*="download" i]',
    'a[download]',
    'button.download',
    'a.download',
    'button[aria-label="Download"]'
  ];
  
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!list.includes(el)) list.push(el);
    });
  });

  // Fallback: search all buttons containing SVG with download keywords or text content
  document.querySelectorAll('button, a').forEach(el => {
    if (list.includes(el)) return;
    
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const text = (el.textContent || '').toLowerCase();
    
    if (label.includes('download') || title.includes('download') || text.includes('download')) {
      list.push(el);
      return;
    }

    const svgs = el.querySelectorAll('svg');
    for (let svg of svgs) {
      const svgHtml = svg.innerHTML.toLowerCase();
      if (svgHtml.includes('download') || svgHtml.includes('arrow-down') || svgHtml.includes('arrowdown')) {
        list.push(el);
        break;
      }
    }
  });

  return list;
}

// Find editor element dynamically
function findEditor() {
  return document.querySelector('.tiptap.ProseMirror') || 
         document.querySelector('.ProseMirror') ||
         document.querySelector('[contenteditable="true"]') ||
         document.querySelector('textarea');
}

// Fill text into the editor
function fillText(text) {
  const editor = findEditor();
  if (!editor) {
    throw new Error('Text input editor not found. Please make sure you are on the fish.audio text-to-speech generation page.');
  }
  
  editor.focus();
  
  // Try to set content via selection & execCommand for rich-text editor state sync (ProseMirror/TipTap)
  try {
    if (editor.tagName === 'TEXTAREA') {
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Clear contents first
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      
      document.execCommand('delete', false, null);
      
      // Insert new text
      document.execCommand('insertText', false, text);
      
      // Dispatch input events to trigger React/Vue update
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch (e) {
    // Fallback to DOM manipulation if selection fails
    editor.innerHTML = '<p></p>';
    const paragraph = editor.querySelector('p') || editor;
    paragraph.textContent = text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Click generate button
function clickGenerate() {
  let btn = findElementByText('button', 'Generate') || 
            findElementByText('button', 'Synthesize') ||
            findElementByText('button', 'Create') ||
            document.querySelector('button[type="submit"]') ||
            document.querySelector('.generate-button');
            
  if (!btn) {
    btn = findElementByText('[role="button"]', 'Generate') ||
          findElementByText('[role="button"]', 'Synthesize') ||
          findElementByText('[role="button"]', 'Create');
  }
  
  if (!btn) {
    throw new Error('Generate button not found');
  }
  btn.click();
}

// Check if popup is open
function isPopupOpen() {
  return document.querySelector(SELECTORS.closePopup) !== null;
}

// Close popup
function closePopup() {
  const closeBtn = document.querySelector(SELECTORS.closePopup);
  if (closeBtn) {
    closeBtn.click();
    return true;
  }
  return false;
}

// Check and update credits balance from DOM
function checkCredits(isSecondAttempt = false) {
  try {
    // 1. Target specific team-switcher span
    const targetSpans = document.querySelectorAll('span');
    for (let span of targetSpans) {
      const text = (span.textContent || '').trim();
      const title = span.getAttribute('title') || '';
      
      // Look for a fraction pattern in text or title attribute
      const textMatch = text.match(/(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)/);
      const titleMatch = title.match(/(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)/);
      
      if (textMatch || titleMatch) {
        const match = textMatch || titleMatch;
        const className = span.className || '';
        const parentHtml = span.parentElement ? span.parentElement.innerHTML : '';
        const parentText = span.parentElement ? (span.parentElement.innerText || '') : '';
        
        if (className.includes('team-switcher') || 
            className.includes('team') || 
            parentHtml.toLowerCase().includes('credit') ||
            parentText.toLowerCase().includes('credit') ||
            parentText.toLowerCase().includes('remaining') ||
            span.closest('[class*="team"]') ||
            span.closest('[class*="menu"]')) {
          const credits = parseInt(match[1].replace(/,/g, ''), 10);
          console.log(`[Fish Automator] Detected team-switcher credits: ${credits}`);
          chrome.runtime.sendMessage({ action: 'creditsUpdate', credits: credits });
          return true; // Successfully found credits
        }
      }
    }

    // 2. Generic fallback matching on body text
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/(\d+[\d,]*)\s*(?:\/\s*\d+[\d,]*)\s*Credits\s+Remaining/i) ||
                  bodyText.match(/(\d+[\d,]*)\s*Credits\s+Remaining/i) ||
                  bodyText.match(/credits\s*remaining\s*:\s*(\d+[\d,]*)/i) ||
                  bodyText.match(/credits\s*:\s*(\d+[\d,]*)/i);
                  
    if (match) {
      const credits = parseInt(match[1].replace(/,/g, ''), 10);
      console.log(`[Fish Automator] Detected remaining credits via text: ${credits}`);
      chrome.runtime.sendMessage({ action: 'creditsUpdate', credits: credits });
      return true; // Successfully found credits
    }
  } catch (e) {
    console.error('[Fish Automator] Error parsing credits from page:', e);
  }

  // If not found and this is the first attempt, trigger a background click-scan
  if (!isSecondAttempt) {
    autoScanCredits();
  }
  return false;
}

// Simulates user mouse/pointer sequence to satisfy React/Radix listeners for credits switcher
function simulateDropdownClick(el) {
  if (!el) return;
  try {
    const opts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  } catch (err) {
    console.error('[Fish Automator] Error simulating click events:', err);
  }
}

// Helper to locate the team/profile avatar dropdown trigger
function getProfileTrigger() {
  // 1. Try to find the avatar image
  const avatarImg = document.querySelector('img[src*="avatars"], img[class*="avatar"]');
  if (avatarImg) {
    let parent = avatarImg.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName === 'DIV' && 
          (parent.className.includes('items-center') || parent.className.includes('cursor')) && 
          (parent.className.includes('max-w-') || parent.className.includes('border') || parent.className.includes('topbar'))) {
        return parent;
      }
      parent = parent.parentElement;
    }
  }
  
  // 2. Fallback to direct selectors matching max-w-[140px]
  const selectors = [
    'div[class*="max-w-[140px]"]',
    'div[class*="fish-topbar-control-border"]',
    'div[class*="topbar-control"]'
  ];
  for (let sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  
  return null;
}

// Automatically click and scan credits from page dropdown
function autoScanCredits() {
  try {
    const dropdown = document.querySelector('[role="menu"], [class*="dashboard-user-menu-panel"]');
    if (dropdown) {
      // Menu is already open, just scan it directly
      checkCredits(true);
      return;
    }

    const trigger = getProfileTrigger();
    if (!trigger) {
      console.log('[Fish Automator] Profile trigger button not found for autoScan');
      return;
    }

    console.log('[Fish Automator] Triggering background scan of credits...');
    
    // Inject class to hide dropdown popup visually
    document.documentElement.classList.add('fish-automator-scanning');
    
    simulateDropdownClick(trigger); // Open menu via simulated mousedown sequences

    // Wait 250ms for menu to render, scan, and close
    setTimeout(() => {
      checkCredits(true); // Extract the credits value (second attempt to avoid recursion)
      
      // Close it by clicking the trigger again
      simulateDropdownClick(trigger);
      
      // Clean up scanning class after menu completes closing animation
      setTimeout(() => {
        document.documentElement.classList.remove('fish-automator-scanning');
      }, 50);
    }, 250);
  } catch (e) {
    console.error('[Fish Automator] Error in autoScanCredits:', e);
    document.documentElement.classList.remove('fish-automator-scanning');
  }
}

// Auto-scan credits on content script load after a brief hydration delay
setTimeout(() => {
  checkCredits();
}, 2500);

// Monitor DOM changes to automatically scan credits if dropdown is opened or changed
const observer = new MutationObserver(() => {
  const dropdown = document.querySelector('[role="menu"], [class*="dashboard-user-menu-panel"], [class*="team-switcher"]');
  if (dropdown) {
    checkCredits(true); // Scan directly without triggering clicks
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Check for credit warnings or page-level errors
function checkPageErrorMessages() {
  const bodyText = document.body.innerText || '';
  const lowercaseText = bodyText.toLowerCase();
  
  if (lowercaseText.includes('insufficient credits') || 
      lowercaseText.includes('no credits') || 
      lowercaseText.includes('credits exhausted') ||
      lowercaseText.includes('out of credits') ||
      lowercaseText.includes('credits finished')) {
    throw new Error('Insufficient credits remaining on fish.audio');
  }
}

// Poll for generation completion dynamically
async function waitForNewDownloadButton(existingButtons, disabledExistingButtons, timeoutMs = 60000) {
  const intervalTime = 1500; // Increased interval to reduce CPU load and site flagging
  let elapsed = 0;
  let clickedRegenerateOnPopup = false;

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      if (isStopped) {
        clearInterval(timer);
        reject(new Error('Automation stopped by user'));
        return;
      }

      // Check for popup dialogs that block generation (e.g. upgrade notices)
      if (isPopupOpen()) {
        const popupText = (document.body.innerText || '').toLowerCase();
        if (popupText.includes('credit') || popupText.includes('upgrade') || popupText.includes('limit') || popupText.includes('exhaust')) {
          clearInterval(timer);
          reject(new Error('Generation blocked: insufficient credits or plan limit reached on fish.audio.'));
          return;
        }

        console.log('Popup detected, attempting to close it...');
        closePopup();
        
        // Retry click generate once if blocked
        if (!clickedRegenerateOnPopup) {
          clickedRegenerateOnPopup = true;
          setTimeout(() => {
            try {
              clickGenerate();
              console.log('Retried click generate after closing popup');
            } catch (e) {
              console.error('Failed to click generate after popup:', e);
            }
          }, 1500);
        }
      }

      // Check for low credits or account plan exhaust errors
      try {
        checkPageErrorMessages();
      } catch (err) {
        clearInterval(timer);
        reject(err);
        return;
      }

      // Read credits if open (do not simulate clicks during active generation loop)
      checkCredits(true);

      // Find all current download buttons using our robust finder
      const currentButtons = findDownloadButtons();
      
      // Look for a target button that is enabled and is either new or was previously disabled
      const targetButton = currentButtons.find(btn => {
        const isEnabled = !btn.disabled && !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true';
        if (!isEnabled) return false;
        
        const isNew = !existingButtons.includes(btn);
        const wasDisabled = disabledExistingButtons.includes(btn);
        
        return isNew || wasDisabled;
      });
      
      if (targetButton) {
        clearInterval(timer);
        resolve(targetButton);
        return;
      }

      elapsed += intervalTime;
      if (elapsed >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Generation timed out after ${timeoutMs / 1000} seconds`));
      }
    }, intervalTime);
  });
}

// Process next chunk
async function processChunk() {
  if (isStopped) {
    chrome.runtime.sendMessage({ action: 'stopped' });
    chrome.runtime.sendMessage({ action: 'clearPrefix' });
    return;
  }

  if (isPaused) {
    chrome.runtime.sendMessage({ 
      action: 'paused', 
      current: currentChunkIndex + 1, 
      total: chunks.length 
    });
    return;
  }

  if (currentChunkIndex >= chunks.length) {
    // All chunks processed and downloaded. Wait an extra 5 seconds buffer to ensure Chrome's download manager has processed the final rename.
    setTimeout(() => {
      // Force one last credits scan at completion to get updated counts
      checkCredits(false);
      
      chrome.runtime.sendMessage({
        action: 'progress',
        current: chunks.length,
        total: chunks.length
      });
    }, 5000);
    return;
  }

  const chunk = chunks[currentChunkIndex];
  const chunkNum = currentChunkIndex + 1;

  try {
    // Update progress state in popup based on number of completed chunks (currentChunkIndex)
    chrome.runtime.sendMessage({
      action: 'progress',
      current: currentChunkIndex,
      total: chunks.length
    });

    console.log(`[Fish Automator] Processing chunk ${chunkNum}/${chunks.length}`);

    // 1. Fill Text
    fillText(chunk);
    
    // Wait for editor state to register securely (increased to 1.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (isStopped || isPaused) return;

    // 2. Scan download buttons BEFORE clicking Generate
    const existingButtons = findDownloadButtons();
    const disabledExistingButtons = existingButtons.filter(btn => btn.disabled || btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true');

    // 3. Click Generate
    clickGenerate();
    console.log('[Fish Automator] Clicked generate button');
    
    // 4. Poll for new download button (Timeout 60s)
    const newDownloadBtn = await waitForNewDownloadButton(existingButtons, disabledExistingButtons, 60000);
    
    if (isStopped || isPaused) return;

    // Wait 2 seconds (increased from 1 second) for element to stabilize and ensure any background tasks are done
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Use simulated pointer/mouse click for React compatibility
    simulateClick(newDownloadBtn);
    console.log(`[Fish Automator] Triggered download event for chunk ${chunkNum}`);
    
    // 5. Cooldown delay between chunks (increased to 5s to prevent flagging and match human pace)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update remaining credits (read-only during loops to prevent popup flashing)
    checkCredits(true);

    // Move to next chunk
    currentChunkIndex++;
    processChunk();
    
  } catch (error) {
    console.error('[Fish Automator] Error processing chunk:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      error: error.message
    });
    chrome.runtime.sendMessage({ action: 'clearPrefix' });
  }
}

// Listen for messages from popup controls
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAutomation') {
    chunks = message.chunks;
    currentChunkIndex = 0;
    isPaused = false;
    isStopped = false;
    console.log(`[Fish Automator] Starting automation with ${chunks.length} chunks`);
    checkCredits(); // Scan initial credits balance
    processChunk();
  } else if (message.action === 'pauseAutomation') {
    isPaused = true;
    console.log('[Fish Automator] Pause requested');
  } else if (message.action === 'resumeAutomation') {
    isPaused = false;
    console.log('[Fish Automator] Resume requested');
    processChunk();
  } else if (message.action === 'stopAutomation') {
    isStopped = true;
    chunks = [];
    currentChunkIndex = 0;
    chrome.runtime.sendMessage({ action: 'clearPrefix' });
    console.log('[Fish Automator] Stop requested');
  } else if (message.action === 'getStatus') {
    const active = chunks.length > 0 && currentChunkIndex < chunks.length && !isStopped;
    sendResponse({
      isRunning: active,
      current: currentChunkIndex + 1,
      total: chunks.length,
      isPaused: isPaused,
      isStopped: isStopped,
      chunks: chunks
    });
  } else if (message.action === 'requestCreditsUpdate') {
    const active = chunks.length > 0 && currentChunkIndex < chunks.length && !isStopped;
    checkCredits(active); // Scan: if running, do not simulate clicks!
    sendResponse({ success: true });
  }
});