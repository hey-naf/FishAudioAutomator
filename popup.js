let scriptChunks = [];
let fileChunks = [];
let textChunks = [];
let loadedFileName = '';
let isRunning = false;
let isPausedState = false;
let activeTab = 'text'; // 'text' or 'file'
let runningTabId = null;
let splitMode = 'smart'; // 'smart' or 'triple'

// Credits and completed state tracking variables
let totalBatchChars = 0;
let currentCredits = null;
let isCompletedState = false;

// DOM Elements
const scriptFileInput = document.getElementById('scriptFile');
const fileInfoBar = document.getElementById('fileInfoBar');
const fileNameEl = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFile');

const tabFileBtn = document.getElementById('tabFileBtn');
const tabTextBtn = document.getElementById('tabTextBtn');
const fileTabContent = document.getElementById('fileTabContent');
const textTabContent = document.getElementById('textTabContent');
const directTextArea = document.getElementById('directTextArea');
const clearTextBtn = document.getElementById('clearTextBtn');

const configHeader = document.getElementById('configHeader');
const configArrow = document.getElementById('configArrow');
const configContent = document.getElementById('configContent');
const renameToggle = document.getElementById('renameToggle');
const renamePrefixInput = document.getElementById('renamePrefix');
const splitModeSelect = document.getElementById('splitMode');

const chunkListContainer = document.getElementById('chunkList');

const progressSection = document.getElementById('progressSection');
const progressStatus = document.getElementById('progressStatus');
const progressPercent = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');
const statusSpinner = document.getElementById('statusSpinner');
const statusMessage = document.getElementById('statusMessage');

const startBtn = document.getElementById('startBtn');
const runningControls = document.getElementById('runningControls');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');

const errorCard = document.getElementById('errorCard');
const errorMessage = document.getElementById('errorMessage');
const connectionStatusBadge = document.getElementById('connectionStatus');

// Initialize popup on load
document.addEventListener('DOMContentLoaded', async () => {
  // Setup Credits Status Button Click
  const creditsStatus = document.getElementById('creditsStatus');
  if (creditsStatus) {
    creditsStatus.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab && tab.url && tab.url.includes('fish.audio')) {
          chrome.tabs.sendMessage(tab.id, { action: 'requestCreditsUpdate' }, () => {
            if (chrome.runtime.lastError) {}
          });
          alert("To sync your credits balance, click on your profile/team icon (top-right corner) of the fish.audio page to open the credits menu.");
        }
      });
    });
  }

  // 1. Setup Accordion Settings toggle
  configHeader.addEventListener('click', toggleConfigPanel);

  // 2. Setup Auto-Rename inputs
  renameToggle.addEventListener('change', handleRenameToggle);
  renamePrefixInput.addEventListener('input', () => {
    resetToReadyState();
    chrome.storage.local.set({ renamePrefixValue: renamePrefixInput.value });
  });

  // 3. Setup Split Mode change
  splitModeSelect.addEventListener('change', handleSplitModeChange);

  // 4. Setup File Upload events
  scriptFileInput.addEventListener('change', handleFileUpload);
  clearFileBtn.addEventListener('click', handleFileClear);

  // 5. Setup Tab Switching events
  tabFileBtn.addEventListener('click', () => switchTab('file'));
  tabTextBtn.addEventListener('click', () => switchTab('text'));

  // 6. Setup Direct Textarea input handler and clear button
  directTextArea.addEventListener('input', () => {
    resetToReadyState();
    handleDirectTextInput();
  });
  clearTextBtn.addEventListener('click', handleTextClear);

  // 7. Setup Controls
  startBtn.addEventListener('click', () => {
    if (isCompletedState) {
      resetToReadyState();
      return;
    }
    startAutomation();
  });
  pauseBtn.addEventListener('click', pauseAutomation);
  resumeBtn.addEventListener('click', resumeAutomation);
  stopBtn.addEventListener('click', stopAutomation);

  // 8. Load stored state
  chrome.storage.local.get([
    'savedChunks', 
    'savedFileName', 
    'renameActive', 
    'renamePrefixValue',
    'savedDirectText',
    'savedTextChunks',
    'activeTab',
    'runningTabId',
    'splitMode',
    'cachedCredits'
  ], async (result) => {
    // Restore Split Mode
    splitMode = result.splitMode || 'smart';
    splitModeSelect.value = splitMode;

    // Restore file content
    if (result.savedChunks && result.savedChunks.length > 0) {
      fileChunks = result.savedChunks;
      loadedFileName = result.savedFileName || 'Loaded script.txt';
      renderFileList();
    }
    
    // Restore direct text content
    if (result.savedDirectText) {
      directTextArea.value = result.savedDirectText;
      if (result.savedTextChunks) {
        textChunks = result.savedTextChunks;
      } else {
        textChunks = parseTextIntoChunks(result.savedDirectText);
      }
    }
    
    // Restore active tab
    activeTab = result.activeTab || 'text';

    // Restore renaming config
    if (result.renameActive !== undefined) {
      renameToggle.checked = result.renameActive;
      renamePrefixInput.disabled = !result.renameActive;
    } else {
      renameToggle.checked = true;
      renamePrefixInput.disabled = false;
      chrome.storage.local.set({ renameActive: true });
    }
    
    if (result.renamePrefixValue) {
      renamePrefixInput.value = result.renamePrefixValue;
    }

    if (result.cachedCredits !== undefined) {
      currentCredits = result.cachedCredits;
      updateCreditsDisplay();
    }

    // Set scriptChunks based on active tab and switch UI
    switchTab(activeTab);

    // 9. Check status and restore UI if already running
    let tab = null;
    if (result.runningTabId) {
      try {
        tab = await chrome.tabs.get(result.runningTabId);
        if (tab && tab.url && tab.url.includes('fish.audio')) {
          runningTabId = result.runningTabId;
        }
      } catch (e) {
        runningTabId = null;
      }
    }

    if (runningTabId) {
      isRunning = true;
      
      const [activeTabObj] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabObj && activeTabObj.id === runningTabId) {
        connectionStatusBadge.textContent = 'Connected';
      } else {
        connectionStatusBadge.textContent = 'Connected (BG)';
      }
      connectionStatusBadge.classList.add('connected');
      hideError();

      chrome.tabs.sendMessage(runningTabId, { action: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          resetUI();
          return;
        }
        if (response && response.isRunning) {
          isPausedState = response.isPaused;
          scriptChunks = response.chunks || [];
          
          renderFileList();
          renderChunkList();
          
          directTextArea.disabled = true;
          scriptFileInput.disabled = true;

          startBtn.style.display = 'none';
          runningControls.style.display = 'flex';
          progressSection.style.display = 'block';
          
          updateChunkListStatus(response.current - 1, response.total);
          
          if (isPausedState) {
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'block';
            statusMessage.textContent = `Paused at chunk ${response.current} of ${response.total}`;
          } else {
            pauseBtn.style.display = 'block';
            resumeBtn.style.display = 'none';
            const percent = Math.round(((response.current - 1) / response.total) * 100);
            updateActiveProgressUI(percent, response.total, `Processing chunk ${response.current} of ${response.total}`);
          }
        } else {
          resetUI();
        }
      });
    } else {
      await checkTabStatus(true);
    }
  });

  // Listen to message updates from Content Script
  chrome.runtime.onMessage.addListener(handleContentMessages);

  // Monitor tab changes
  chrome.tabs.onActivated.addListener(handleTabActivation);
  chrome.tabs.onUpdated.addListener(handleTabUpdates);
});

// Accordion Panel Toggle
function toggleConfigPanel() {
  const isOpen = configContent.classList.contains('open');
  if (isOpen) {
    configContent.classList.remove('open');
    configArrow.style.transform = 'rotate(0deg)';
  } else {
    configContent.classList.add('open');
    configArrow.style.transform = 'rotate(90deg)';
  }
}

// Rename Toggle Input Change
function handleRenameToggle() {
  resetToReadyState();
  const isActive = renameToggle.checked;
  renamePrefixInput.disabled = !isActive;
  chrome.storage.local.set({ renameActive: isActive });
  
  if (isActive && (!renamePrefixInput.value || renamePrefixInput.value.trim() === '')) {
    if (activeTab === 'file' && loadedFileName) {
      const defaultPrefix = loadedFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, "");
      renamePrefixInput.value = defaultPrefix;
      chrome.storage.local.set({ renamePrefixValue: defaultPrefix });
    } else {
      renamePrefixInput.value = 'QuickScript';
      chrome.storage.local.set({ renamePrefixValue: 'QuickScript' });
    }
  }
}

// Split Mode Change handler
function handleSplitModeChange() {
  resetToReadyState();
  splitMode = splitModeSelect.value;
  chrome.storage.local.set({ splitMode: splitMode });

  // Re-parse current inputs
  if (activeTab === 'file') {
    chrome.storage.local.get(['savedRawFileText'], (res) => {
      if (res.savedRawFileText) {
        processParsedText(res.savedRawFileText);
      }
    });
  } else {
    handleDirectTextInput();
  }
}

// Switch between tabs
function switchTab(tab) {
  if (isRunning) return;

  activeTab = tab;
  chrome.storage.local.set({ activeTab: activeTab });

  if (tab === 'file') {
    tabFileBtn.classList.add('active');
    tabTextBtn.classList.remove('active');
    fileTabContent.style.display = 'block';
    textTabContent.style.display = 'none';
    
    scriptChunks = fileChunks;
    
    if (renameToggle.checked && (!renamePrefixInput.value || renamePrefixInput.value === 'QuickScript')) {
      if (loadedFileName) {
        const defaultPrefix = loadedFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, "");
        renamePrefixInput.value = defaultPrefix;
        chrome.storage.local.set({ renamePrefixValue: defaultPrefix });
      }
    }
  } else {
    tabFileBtn.classList.remove('active');
    tabTextBtn.classList.add('active');
    fileTabContent.style.display = 'none';
    textTabContent.style.display = 'block';
    
    scriptChunks = textChunks;
    
    if (renameToggle.checked && (!renamePrefixInput.value || renamePrefixInput.value === '')) {
      renamePrefixInput.value = 'QuickScript';
      chrome.storage.local.set({ renamePrefixValue: 'QuickScript' });
    }
  }

  renderChunkList();
  checkTabStatus();
}

// Helper to parse text based on splitMode
function parseTextIntoChunks(text) {
  if (splitMode === 'smart') {
    return splitTextIntoSmartChunks(text);
  } else {
    // Legacy 3 blank lines split
    return text.split(/\n\s*\n\s*\n+/).map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
  }
}

// Smart split text algorithm (strictly within 300-450 characters grouped at sentences)
function splitTextIntoSmartChunks(text) {
  const segments = [];
  const paragraphs = text.split('\n');
  
  for (let para of paragraphs) {
    para = para.trim();
    if (!para) continue;
    
    // Split paragraphs into sentences
    const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+(?:\s+|$)/g) || [para];
    for (let sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed) {
        segments.push(trimmed);
      }
    }
  }

  const chunks = [];
  let currentChunk = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    if (seg.length > 450) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      
      let remaining = seg;
      while (remaining.length > 450) {
        let splitIdx = remaining.lastIndexOf(' ', 450);
        if (splitIdx === -1) {
          splitIdx = 450;
        }
        chunks.push(remaining.substring(0, splitIdx).trim());
        remaining = remaining.substring(splitIdx).trim();
      }
      if (remaining) {
        currentChunk = remaining;
      }
    } else {
      const testChunk = currentChunk ? currentChunk + " " + seg : seg;
      if (testChunk.length <= 450) {
        currentChunk = testChunk;
      } else {
        chunks.push(currentChunk);
        currentChunk = seg;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Handle quick text box input in real-time
function handleDirectTextInput() {
  const text = directTextArea.value;
  textChunks = parseTextIntoChunks(text);
  
  chrome.storage.local.set({ 
    savedDirectText: text,
    savedTextChunks: textChunks
  });

  if (activeTab === 'text') {
    scriptChunks = textChunks;
    renderChunkList();
    checkTabStatus();
  }
}

// Clear Text Input, file upload, storage, and preview list (Reset Workspace)
function handleTextClear() {
  if (isRunning) return;

  resetToReadyState();
  directTextArea.value = '';
  textChunks = [];
  
  fileChunks = [];
  loadedFileName = '';
  scriptFileInput.value = '';
  fileInfoBar.style.display = 'none';

  chrome.storage.local.remove([
    'savedDirectText', 
    'savedTextChunks',
    'savedChunks',
    'savedFileName',
    'savedRawFileText',
    'downloadCounter',
    'downloadPrefix'
  ]);

  scriptChunks = [];
  chunkListContainer.style.display = 'none';
  chunkListContainer.innerHTML = '';
  const listSummary = document.getElementById('listSummary');
  if (listSummary) listSummary.style.display = 'none';
  
  const warningCard = document.getElementById('creditWarningCard');
  if (warningCard) warningCard.style.display = 'none';
  
  startBtn.disabled = true;
  hideError();
  checkTabStatus();
}

// Check if active tab is fish.audio
async function checkTabStatus(shouldRequestCredits = false) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const creditsStatus = document.getElementById('creditsStatus');

    if (tab && tab.url && tab.url.includes('fish.audio')) {
      connectionStatusBadge.textContent = 'Connected';
      connectionStatusBadge.classList.add('connected');
      hideError();
      if (scriptChunks.length > 0 && !isRunning) {
        startBtn.disabled = false;
      } else {
        startBtn.disabled = true;
      }

      if (creditsStatus) {
        creditsStatus.style.display = 'block';
      }
      updateCreditsDisplay();

      // Trigger automatic request to scan credits from page only if requested
      if (shouldRequestCredits) {
        chrome.tabs.sendMessage(tab.id, { action: 'requestCreditsUpdate' }, () => {
          if (chrome.runtime.lastError) {}
        });
      }

      return tab;
    } else {
      if (isRunning) {
        connectionStatusBadge.textContent = 'Connected (BG)';
        connectionStatusBadge.classList.add('connected');
        hideError();
        if (creditsStatus) {
          creditsStatus.style.display = 'block';
        }
        updateCreditsDisplay();
        return null;
      } else {
        connectionStatusBadge.textContent = 'Not connected';
        connectionStatusBadge.classList.remove('connected');
        startBtn.disabled = true;
        showError('Navigate the active tab to https://fish.audio to begin');
        if (creditsStatus) {
          creditsStatus.style.display = 'none';
        }
        return null;
      }
    }
  } catch (err) {
    showError('Error connecting to active tab');
    return null;
  }
}

// Handler for tab selection changes
async function handleTabActivation(activeInfo) {
  if (!isRunning) {
    await checkTabStatus(true);
  } else {
    if (activeInfo.tabId === runningTabId) {
      connectionStatusBadge.textContent = 'Connected';
    } else {
      connectionStatusBadge.textContent = 'Connected (BG)';
    }
  }
}

// Handler for tab navigation updates
async function handleTabUpdates(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    if (!isRunning) {
      await checkTabStatus(true);
    } else if (tabId === runningTabId) {
      if (tab.url && !tab.url.includes('fish.audio')) {
        resetUI();
      }
    }
  }
}

// File Upload Handler
function handleFileUpload(e) {
  resetToReadyState();
  const file = e.target.files[0];
  if (!file) return;

  loadedFileName = file.name;
  const parts = file.name.split('.');
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';

  const reader = new FileReader();

  if (extension === 'docx') {
    reader.onload = function(evt) {
      const arrayBuffer = evt.target.result;
      
      // Parse DOCX to raw text using Mammoth
      mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(function(result) {
          const text = result.value;
          chrome.storage.local.set({ savedRawFileText: text });
          processParsedText(text);
        })
        .catch(function(err) {
          showError('Failed to parse Word document: ' + err.message);
        });
    };
    reader.readAsArrayBuffer(file);
  } else {
    // Treat as standard text file (.txt, .md)
    reader.onload = function(evt) {
      const text = evt.target.result;
      chrome.storage.local.set({ savedRawFileText: text });
      processParsedText(text);
    };
    reader.readAsText(file, 'UTF-8');
  }
}

// Helper to process the extracted text and update state/UI
function processParsedText(text) {
  fileChunks = parseTextIntoChunks(text);
  
  if (fileChunks.length === 0) {
    showError('No valid chunks found in file');
    return;
  }

  const defaultPrefix = loadedFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim();
  if (!renamePrefixInput.value || renamePrefixInput.value === '' || renamePrefixInput.value === 'QuickScript') {
    renamePrefixInput.value = defaultPrefix;
  }

  chrome.storage.local.set({
    savedChunks: fileChunks,
    savedFileName: loadedFileName,
    renamePrefixValue: renamePrefixInput.value
  });

  if (activeTab === 'file') {
    scriptChunks = fileChunks;
    renderFileList();
    renderChunkList();
    checkTabStatus();
  }
}

// Clear File Handler
function handleFileClear() {
  resetToReadyState();
  fileChunks = [];
  loadedFileName = '';
  chrome.storage.local.remove(['savedChunks', 'savedFileName', 'savedRawFileText']);
  
  scriptFileInput.value = '';
  fileInfoBar.style.display = 'none';
  
  if (activeTab === 'file') {
    scriptChunks = [];
    chunkListContainer.style.display = 'none';
    chunkListContainer.innerHTML = '';
    const listSummary = document.getElementById('listSummary');
    if (listSummary) listSummary.style.display = 'none';
    startBtn.disabled = true;
  }
  hideError();
}

function renderFileList() {
  fileNameEl.innerHTML = `📄 <strong>${loadedFileName}</strong> (${fileChunks.length} chunks)`;
  fileInfoBar.style.display = 'flex';
}

// Render the interactable script chunk list with character limits and delete handles
function renderChunkList() {
  chunkListContainer.innerHTML = '';
  const listSummary = document.getElementById('listSummary');
  const chunksCount = document.getElementById('chunksCount');
  const totalCharsCount = document.getElementById('totalCharsCount');

  if (scriptChunks.length === 0) {
    chunkListContainer.style.display = 'none';
    if (listSummary) listSummary.style.display = 'none';
    totalBatchChars = 0;
    checkCreditsAlerts();
    return;
  }

  // Calculate total characters
  const totalChars = scriptChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  totalBatchChars = totalChars;
  checkCreditsAlerts();

  if (listSummary && chunksCount && totalCharsCount) {
    chunksCount.textContent = `✅ ${scriptChunks.length} chunks ready`;
    totalCharsCount.textContent = `📝 ${totalChars.toLocaleString()} total chars`;
    listSummary.style.display = 'flex';
  }

  scriptChunks.forEach((chunk, index) => {
    const item = document.createElement('div');
    item.className = 'chunk-item fade-in';
    item.id = `chunk-item-${index}`;

    const charCount = chunk.length;
    const isExceeded = charCount > 500;

    item.innerHTML = `
      <div class="chunk-left">
        <div class="chunk-status-dot pending" id="dot-${index}"></div>
        <div class="chunk-meta">
          <div class="chunk-text-preview">${escapeHtml(chunk)}</div>
          <div class="chunk-id">Chunk ${index + 1}</div>
        </div>
      </div>
      <div class="chunk-right">
        <span class="char-badge ${isExceeded ? 'warning' : ''}">${charCount} chars</span>
        <button class="delete-chunk-btn" data-index="${index}" title="Remove chunk from queue" style="background: transparent; border: none; color: var(--color-danger); cursor: pointer; font-size: 14px; padding: 0 4px; opacity: 0.6; transition: opacity 0.2s; margin-left: 6px; line-height: 1;">✕</button>
      </div>
    `;

    chunkListContainer.appendChild(item);
  });

  // Attach delete buttons listeners
  const deleteBtns = chunkListContainer.querySelectorAll('.delete-chunk-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const idxToDelete = parseInt(btn.getAttribute('data-index'), 10);
      deleteChunkAtIndex(idxToDelete);
    });
  });

  chunkListContainer.style.display = 'block';
}

// Delete chunk at a specific index handler
function deleteChunkAtIndex(idx) {
  if (isRunning) return;

  resetToReadyState();
  scriptChunks.splice(idx, 1);
  
  if (activeTab === 'file') {
    fileChunks = scriptChunks;
    chrome.storage.local.set({ savedChunks: fileChunks });
  } else {
    textChunks = scriptChunks;
    chrome.storage.local.set({ savedTextChunks: textChunks });
  }
  
  renderChunkList();
  checkTabStatus();
}

// Start Automation Message
async function startAutomation() {
  const tab = await checkTabStatus();
  if (!tab) return;

  hideError();
  isRunning = true;
  isPausedState = false;
  runningTabId = tab.id;

  // Toggle Controls
  startBtn.style.display = 'none';
  runningControls.style.display = 'flex';
  pauseBtn.style.display = 'block';
  resumeBtn.style.display = 'none';
  progressSection.style.display = 'block';
  
  // Set renaming variables in storage for the background worker
  if (renameToggle.checked && renamePrefixInput.value.trim()) {
    chrome.storage.local.set({
      downloadPrefix: renamePrefixInput.value.trim(),
      downloadCounter: 1,
      automationActive: true,
      runningTabId: runningTabId
    });
  } else {
    chrome.storage.local.set({
      downloadPrefix: '',
      downloadCounter: 1,
      automationActive: false,
      runningTabId: runningTabId
    });
  }

  // Disable text boxes / uploads while running
  directTextArea.disabled = true;
  scriptFileInput.disabled = true;

  // Update lists statuses to Pending
  resetChunkListDots();

  // Send message to content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'startAutomation',
      chunks: scriptChunks
    });
    
    updateActiveProgressUI(0, scriptChunks.length, 'Starting...');
  } catch (err) {
    showError("Could not start. Refresh the tab and try again.");
    resetUI();
  }
}

// Pause Automation
async function pauseAutomation() {
  if (!runningTabId) return;

  statusMessage.textContent = 'Pausing after current chunk completes...';
  statusSpinner.classList.add('visible');

  try {
    await chrome.tabs.sendMessage(runningTabId, { action: 'pauseAutomation' });
  } catch (err) {
    showError("Failed to pause automation.");
  }
}

// Resume Automation
async function resumeAutomation() {
  if (!runningTabId) return;

  isPausedState = false;
  pauseBtn.style.display = 'block';
  resumeBtn.style.display = 'none';
  statusMessage.textContent = 'Resuming automation...';

  try {
    await chrome.tabs.sendMessage(runningTabId, { action: 'resumeAutomation' });
  } catch (err) {
    showError("Failed to resume automation.");
  }
}

// Stop Automation
async function stopAutomation() {
  if (runningTabId) {
    try {
      await chrome.tabs.sendMessage(runningTabId, { action: 'stopAutomation' });
    } catch (err) {
      // Tab might have closed
    }
  }
  resetUI();
}

// Handler for messages incoming from the Tab Content Script
function handleContentMessages(message) {
  if (message.action === 'progress') {
    const { current, total } = message;
    const percent = Math.round((current / total) * 100);
    
    updateActiveProgressUI(percent, total, `Processing chunk ${current} of ${total}`);
    
    // Update dots in list
    updateChunkListStatus(current - 1, total);

    if (current === total) {
      statusMessage.textContent = '✨ Automation completed successfully!';
      statusSpinner.classList.remove('visible');
      setTimeout(() => {
        isRunning = false;
        isPausedState = false;
        runningTabId = null;

        // Display Completed state
        startBtn.style.display = 'block';
        startBtn.disabled = false;
        startBtn.textContent = 'Completed!';
        startBtn.className = 'btn btn-success';
        
        isCompletedState = true;

        runningControls.style.display = 'none';
        progressSection.style.display = 'none';
        
        directTextArea.disabled = false;
        scriptFileInput.disabled = false;

        // Keep status dots green
        updateChunkListStatus(total, total);
        checkTabStatus();
      }, 3000);
    }
  } else if (message.action === 'paused') {
    const { current, total } = message;
    isPausedState = true;
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'block';
    statusSpinner.classList.remove('visible');
    statusMessage.textContent = `Paused at chunk ${current} of ${total}`;
    
    // Set dot status to paused
    const dot = document.getElementById(`dot-${current - 1}`);
    if (dot) {
      dot.className = 'chunk-status-dot';
      dot.style.backgroundColor = 'var(--color-warning)';
    }
  } else if (message.action === 'stopped') {
    resetUI();
  } else if (message.action === 'error') {
    showError(message.error);
    resetUI();
    // Alert the user immediately with a native window dialog
    alert(`[Fish Audio Automator Error]\n\n${message.error}`);
  } else if (message.action === 'creditsUpdate') {
    currentCredits = message.credits;
    chrome.storage.local.set({ cachedCredits: currentCredits });
    updateCreditsDisplay();
    checkCreditsAlerts();
  }
}

function updateActiveProgressUI(percent, total, statusText) {
  progressBarFill.style.width = percent + '%';
  progressPercent.textContent = percent + '%';
  statusMessage.textContent = statusText;
  
  if (percent < 100 && isRunning && !isPausedState) {
    statusSpinner.classList.add('visible');
  } else {
    statusSpinner.classList.remove('visible');
  }
}

function updateChunkListStatus(activeIdx, total) {
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(`dot-${i}`);
    const item = document.getElementById(`chunk-item-${i}`);
    if (!dot) continue;

    if (i < activeIdx) {
      // Completed chunks
      dot.className = 'chunk-status-dot completed';
      dot.style.backgroundColor = '';
    } else if (i === activeIdx) {
      // Active chunk
      dot.className = 'chunk-status-dot processing';
      dot.style.backgroundColor = '';
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      // Pending chunks
      dot.className = 'chunk-status-dot pending';
      dot.style.backgroundColor = '';
    }
  }
}

// Reset dots to pending
function resetChunkListDots() {
  const dots = document.querySelectorAll('.chunk-status-dot');
  dots.forEach(dot => {
    dot.className = 'chunk-status-dot pending';
    dot.style.backgroundColor = '';
  });
}

function resetUI() {
  isRunning = false;
  isPausedState = false;
  runningTabId = null;
  isCompletedState = false;

  startBtn.style.display = 'block';
  startBtn.textContent = 'Start Automation';
  startBtn.className = 'btn btn-primary';
  startBtn.classList.remove('btn-success');
  
  runningControls.style.display = 'none';
  progressSection.style.display = 'none';
  statusSpinner.classList.remove('visible');

  directTextArea.disabled = false;
  scriptFileInput.disabled = false;

  chrome.storage.local.remove(['runningTabId']);

  if (activeTab === 'file') {
    scriptChunks = fileChunks;
  } else {
    chrome.storage.local.get(['savedDirectText', 'savedTextChunks'], (result) => {
      if (result.savedTextChunks) {
        textChunks = result.savedTextChunks;
      } else if (result.savedDirectText) {
        textChunks = parseTextIntoChunks(result.savedDirectText);
      }
      scriptChunks = textChunks;
      renderChunkList();
    });
  }

  const warningCard = document.getElementById('creditWarningCard');
  if (warningCard) warningCard.style.display = 'none';

  checkCreditsAlerts();

  renderChunkList();
  checkTabStatus();
}

function updateCreditsDisplay() {
  const creditsStatus = document.getElementById('creditsStatus');
  if (creditsStatus) {
    if (currentCredits !== null) {
      creditsStatus.textContent = `Credits: ${currentCredits.toLocaleString()}`;
    } else {
      creditsStatus.textContent = `Credits: --`;
    }
  }
}

function checkCreditsAlerts() {
  const creditsStatus = document.getElementById('creditsStatus');
  const warningCard = document.getElementById('creditWarningCard');
  const warningMsg = document.getElementById('creditWarningMessage');
  
  if (currentCredits !== null) {
    const isExceeded = totalBatchChars > currentCredits;
    
    // 1. Credits badge warning animation
    if (creditsStatus) {
      if (isExceeded) {
        creditsStatus.classList.add('alert-active');
      } else {
        creditsStatus.classList.remove('alert-active');
      }
    }
    
    // 3. Display warning card if low or exceeded
    if (warningCard && warningMsg) {
      if (isExceeded) {
        warningMsg.innerHTML = `⚠️ <strong>Batch exceeds credits!</strong> Batch needs <strong>${totalBatchChars.toLocaleString()}</strong> chars, but you only have <strong>${currentCredits.toLocaleString()}</strong> credits.`;
        warningCard.style.display = 'flex';
        warningCard.style.background = 'rgba(255, 69, 58, 0.15)';
        warningCard.style.borderColor = 'rgba(255, 69, 58, 0.3)';
        warningCard.style.color = 'var(--color-danger)';
      } else if (currentCredits <= 500) {
        warningMsg.innerHTML = `Low credits remaining! Only <strong>${currentCredits.toLocaleString()}</strong> remaining.`;
        warningCard.style.display = 'flex';
        warningCard.style.background = 'rgba(255, 214, 10, 0.15)';
        warningCard.style.borderColor = 'rgba(255, 214, 10, 0.3)';
        warningCard.style.color = 'var(--color-warning)';
      } else {
        warningCard.style.display = 'none';
      }
    }
  } else {
    if (creditsStatus) creditsStatus.classList.remove('alert-active');
    if (warningCard) warningCard.style.display = 'none';
  }
}

function resetToReadyState() {
  if (!isCompletedState) return;
  isCompletedState = false;
  
  // Revert button text and class
  startBtn.textContent = 'Start Automation';
  startBtn.className = 'btn btn-primary';
  startBtn.classList.remove('btn-success');
  
  // Reset all dots to pending (grey)
  resetChunkListDots();
  
  // Rerender chunk list to make sure everything matches
  renderChunkList();
  checkTabStatus();
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorCard.style.display = 'flex';
}

function hideError() {
  errorCard.style.display = 'none';
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}