/**
 * FluxVid — Production Frontend Core
 * Universal Video & Audio Media Downloader
 * Created By Shiv Yogi
 */

const CONFIG = {
  // Backend API URL: local test or deployed backend URL
  API_BASE: window.FLUXVID_API_BASE || 'http://127.0.0.1:8000',
  CREATOR_NAME: 'shiv yogi'
};

// Application State
const state = {
  currentUrl: '',
  mediaData: null,
  selectedType: 'video', // 'video' | 'audio'
  selectedFormatId: null,
  isDownloading: false
};

// DOM References
const elements = {
  introOverlay: document.getElementById('intro-overlay'),
  stageFluxvid: document.getElementById('stage-fluxvid'),
  stageCreator: document.getElementById('stage-creator'),
  appContainer: document.getElementById('app'),
  
  urlForm: document.getElementById('url-form'),
  urlInput: document.getElementById('media-url-input'),
  pasteBtn: document.getElementById('paste-btn'),
  analyzeBtn: document.getElementById('analyze-btn'),
  
  loadingState: document.getElementById('state-loading'),
  errorState: document.getElementById('state-error'),
  errorTitle: document.getElementById('error-title'),
  errorMessage: document.getElementById('error-message'),
  errorRetryBtn: document.getElementById('error-retry-btn'),
  
  mediaCard: document.getElementById('media-card'),
  mediaThumb: document.getElementById('media-thumb'),
  mediaTitle: document.getElementById('media-title'),
  mediaDurationText: document.getElementById('media-duration-text'),
  mediaDurationBadge: document.getElementById('media-duration-badge'),
  mediaSourceText: document.getElementById('media-source-text'),
  
  tabIndicator: document.getElementById('tab-indicator'),
  tabVideo: document.getElementById('tab-video'),
  tabAudio: document.getElementById('tab-audio'),
  qualityChipsGrid: document.getElementById('quality-chips-grid'),
  
  downloadCtaBtn: document.getElementById('download-trigger-btn'),
  ctaIcon: document.getElementById('cta-icon'),
  ctaLabel: document.getElementById('cta-label'),
  ctaProgressBar: document.getElementById('cta-progress-bar'),
  successBanner: document.getElementById('download-success-banner'),
  successFilename: document.getElementById('success-filename'),
  
  historyList: document.getElementById('history-list'),
  clearHistoryBtn: document.getElementById('clear-history-btn')
};

// Format seconds into MM:SS or HH:MM:SS
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const sec = parseInt(seconds, 10);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${remSec < 10 ? '0' : ''}${remSec}`;
  }
  return `${mins}:${remSec < 10 ? '0' : ''}${remSec}`;
}

// --------------------------------------------------------------------------
// 1. Intro Animation Pipeline
// --------------------------------------------------------------------------
function runIntroPipeline() {
  setTimeout(() => {
    // Stage 1 -> Stage 2
    elements.stageFluxvid.classList.remove('active');
    setTimeout(() => {
      elements.stageCreator.classList.add('active');
    }, 250);

    // Stage 2 -> Main App
    setTimeout(() => {
      elements.introOverlay.style.opacity = '0';
      elements.introOverlay.style.pointerEvents = 'none';
      elements.appContainer.classList.remove('hidden');
      setTimeout(() => {
        elements.introOverlay.remove();
      }, 800);
    }, 2200);

  }, 1400);
}

// --------------------------------------------------------------------------
// 2. Clipboard & Form Events
// --------------------------------------------------------------------------
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      elements.urlInput.value = text.trim();
      const iconPaste = elements.pasteBtn.querySelector('.icon-paste');
      const iconCheck = elements.pasteBtn.querySelector('.icon-check');
      iconPaste.classList.add('hidden');
      iconCheck.classList.remove('hidden');
      setTimeout(() => {
        iconPaste.classList.remove('hidden');
        iconCheck.classList.add('hidden');
      }, 1500);
    }
  } catch (err) {
    elements.urlInput.focus();
  }
}

// --------------------------------------------------------------------------
// 3. Media Extraction Engine (API Communication)
// --------------------------------------------------------------------------
async function analyzeUrl(e) {
  if (e) e.preventDefault();
  const url = elements.urlInput.value.trim();
  if (!url) return;

  state.currentUrl = url;
  showLoading();

  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Unable to retrieve media from this source.');
    }

    state.mediaData = data;
    renderMediaCard(data);
  } catch (err) {
    showError(err.message);
  }
}

function showLoading() {
  elements.errorState.classList.add('hidden');
  elements.mediaCard.classList.add('hidden');
  elements.loadingState.classList.remove('hidden');
}

function showError(msg) {
  elements.loadingState.classList.add('hidden');
  elements.mediaCard.classList.add('hidden');
  elements.errorMessage.textContent = msg || 'The source may be unsupported, private, DRM-protected, restricted, or temporarily unavailable.';
  elements.errorState.classList.remove('hidden');
}

function renderMediaCard(data) {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.add('hidden');

  elements.mediaTitle.textContent = data.title || 'Untitled Media';
  elements.mediaThumb.src = data.thumbnail || 'assets/logo.svg';
  const durationStr = formatDuration(data.duration);
  elements.mediaDurationText.textContent = durationStr;
  elements.mediaDurationBadge.textContent = durationStr;
  elements.mediaSourceText.textContent = data.extractor || 'Public Source';

  // Default to Video tab
  switchTab('video');
  elements.mediaCard.classList.remove('hidden');
  elements.mediaCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --------------------------------------------------------------------------
// 4. Quality & Format Selector
// --------------------------------------------------------------------------
function switchTab(type) {
  state.selectedType = type;
  if (type === 'video') {
    elements.tabIndicator.style.transform = 'translateX(0%)';
    elements.tabVideo.classList.add('active');
    elements.tabAudio.classList.remove('active');
  } else {
    elements.tabIndicator.style.transform = 'translateX(100%)';
    elements.tabAudio.classList.add('active');
    elements.tabVideo.classList.remove('active');
  }
  populateQualityChips();
}

function populateQualityChips() {
  elements.qualityChipsGrid.innerHTML = '';
  if (!state.mediaData) return;

  const formats = state.selectedType === 'video' 
    ? state.mediaData.video_formats 
    : state.mediaData.audio_formats;

  if (!formats || formats.length === 0) {
    elements.qualityChipsGrid.innerHTML = '<p class="history-empty">No compatible formats detected.</p>';
    state.selectedFormatId = null;
    return;
  }

  // Pre-select best available format
  state.selectedFormatId = formats[0].format_id;

  formats.forEach((fmt, index) => {
    const chip = document.createElement('div');
    chip.className = `quality-chip ${index === 0 ? 'selected' : ''}`;
    chip.dataset.formatId = fmt.format_id;
    
    chip.innerHTML = `
      <span class="quality-label">${fmt.quality_label}</span>
      <span class="quality-sub">${fmt.extension.toUpperCase()}</span>
    `;

    chip.addEventListener('click', () => {
      document.querySelectorAll('.quality-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.selectedFormatId = fmt.format_id;
    });

    elements.qualityChipsGrid.appendChild(chip);
  });
}

// --------------------------------------------------------------------------
// 5. Download Execution & Required Filename Guarantee
// --------------------------------------------------------------------------
async function triggerDownload() {
  if (state.isDownloading || !state.mediaData || !state.selectedFormatId) return;

  state.isDownloading = true;
  elements.downloadCtaBtn.style.pointerEvents = 'none';
  elements.ctaLabel.textContent = 'Preparing...';
  elements.ctaProgressBar.style.width = '30%';
  elements.successBanner.classList.add('hidden');

  try {
    const payload = {
      url: state.currentUrl,
      format_id: state.selectedFormatId,
      media_type: state.selectedType,
      title: state.mediaData.title
    };

    const response = await fetch(`${CONFIG.API_BASE}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.detail || 'Download processing failed on server.');
    }

    elements.ctaLabel.textContent = 'Downloading...';
    elements.ctaProgressBar.style.width = '70%';

    // Extract exact designated filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    let filename = '';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }
    
    // Safety fallback strictly following required naming rules
    if (!filename) {
      const cleanTitle = (state.mediaData.title || 'media').replace(/[^a-zA-Z0-9_-]/g, '_');
      const ext = state.selectedType === 'audio' ? 'mp3' : 'mp4';
      filename = `${cleanTitle}_FluxVid-created by shiv yogi.${ext}`;
    }

    const blob = await response.blob();
    elements.ctaProgressBar.style.width = '100%';

    // Trigger local device download
    const blobUrl = window.URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.URL.revokeObjectURL(blobUrl);

    // Show success feedback
    elements.ctaLabel.textContent = 'Downloaded';
    elements.ctaIcon.src = 'assets/icons/check.svg';
    elements.successFilename.textContent = filename;
    elements.successBanner.classList.remove('hidden');

    saveToHistory(filename, state.selectedType);
  } catch (err) {
    showError(err.message);
  } finally {
    state.isDownloading = false;
    setTimeout(() => {
      elements.downloadCtaBtn.style.pointerEvents = 'auto';
      elements.ctaLabel.textContent = 'Download';
      elements.ctaIcon.src = 'assets/icons/download.svg';
      elements.ctaProgressBar.style.width = '0%';
    }, 2800);
  }
}

// --------------------------------------------------------------------------
// 6. Local Storage Download History
// --------------------------------------------------------------------------
function saveToHistory(filename, type) {
  let history = JSON.parse(localStorage.getItem('fluxvid_history') || '[]');
  const entry = {
    id: Date.now(),
    filename: filename,
    type: type,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  history.unshift(entry);
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem('fluxvid_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('fluxvid_history') || '[]');
  elements.historyList.innerHTML = '';

  if (history.length === 0) {
    elements.historyList.innerHTML = '<p class="history-empty">No downloads yet on this device.</p>';
    return;
  }

  history.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    itemEl.innerHTML = `
      <div class="history-meta">
        <span class="history-file-title">${item.filename}</span>
        <span class="history-file-sub">${item.type.toUpperCase()} &bull; ${item.timestamp}</span>
      </div>
      <span class="history-status-tag">Downloaded</span>
    `;
    elements.historyList.appendChild(itemEl);
  });
}

function clearHistory() {
  localStorage.removeItem('fluxvid_history');
  renderHistory();
}

// --------------------------------------------------------------------------
// 7. Event Handlers Setup
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  runIntroPipeline();
  renderHistory();

  elements.pasteBtn.addEventListener('click', handlePaste);
  elements.urlForm.addEventListener('submit', analyzeUrl);
  elements.analyzeBtn.addEventListener('click', analyzeUrl);
  elements.tabVideo.addEventListener('click', () => switchTab('video'));
  elements.tabAudio.addEventListener('click', () => switchTab('audio'));
  elements.downloadCtaBtn.addEventListener('click', triggerDownload);
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  elements.errorRetryBtn.addEventListener('click', () => {
    elements.errorState.classList.add('hidden');
    elements.urlInput.focus();
  });
});