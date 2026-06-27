import { UI } from '../utils/config.js';

export function initFullscreen(recalculateAllMarquees) {
  // --- FULL SCREEN VIEW MODE LOGIC ---
  const exFsToggleBtn = document.getElementById('exFsToggleBtn');
  const exitFsBtn = document.getElementById('exitFsBtn');
  const collapseFsBtn = document.getElementById('collapseFsBtn');
  
  const exLeft = document.querySelector('.ex-left');
  const exContentRow = document.querySelector('.ex-content-row');
  const exBottom = document.querySelector('.ex-bottom');
  const exSeekbarContainer = document.querySelector('.ex-seekbar-container');
  const exControls = document.querySelector('.ex-controls');
  const exVolumePanel = document.getElementById('exVolumePanel');
  const queueHeaderButtons = document.querySelector('.queue-header-buttons');
  const expandedView = document.querySelector('.expanded-view');
  const queueHeader = document.querySelector('.queue-header');

  function adjustColumnsToFit() {
    const container = document.querySelector('.ex-right');
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;
    
    // let titleWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-title-width') || '250');
    // let totalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-total-width') || '450');
    
    // Reserve at least 260px for gaps, number, art, and min duration width (100px)
    const maxTotal = containerWidth - 260;
    
    if (totalWidth > maxTotal) {
      totalWidth = Math.max(250, maxTotal);
      document.documentElement.style.setProperty('--col-total-width', `${totalWidth}px`);
    }
    
    // Ensure Album column remains at least 150px wide
    if (titleWidth > totalWidth - 150) {
      titleWidth = Math.max(100, totalWidth - 150);
      document.documentElement.style.setProperty('--col-title-width', `${titleWidth}px`);
    }
  }

  window.addEventListener('resize', () => {
    if (UI.playerWrapper && UI.playerWrapper.classList.contains('fullscreen-active')) {
      adjustColumnsToFit();
    }
  });

  function setFullscreenMode(active) {
    if (!UI.playerWrapper) return;
    
    if (active) {
      UI.playerWrapper.classList.add('fullscreen-active');
      document.body.classList.add('fullscreen-body-active');
      setTimeout(adjustColumnsToFit, 50);
      setTimeout(adjustColumnsToFit, 150);
      setTimeout(adjustColumnsToFit, 350);
      
      // Close global search overlay if open
      const globalSearchOverlay = document.getElementById("globalSearchOverlay");
      const globalSearchBtn = document.querySelector(".nav-btn.btn-4");
      const globalSearchInput = document.getElementById("globalSearchInput");
      const globalSearchClearBtn = document.getElementById("globalSearchClearBtn");
      const globalSearchResultsWrapper = document.getElementById("globalSearchResultsWrapper");

      if (globalSearchOverlay) globalSearchOverlay.classList.remove("show");
      if (globalSearchBtn) globalSearchBtn.classList.remove("active");
      if (globalSearchInput) {
        globalSearchInput.value = "";
        globalSearchInput.blur();
      }
      if (globalSearchClearBtn) globalSearchClearBtn.style.display = "none";
      if (globalSearchResultsWrapper) globalSearchResultsWrapper.style.display = "none";
      
      // Move controls and seekbar to left panel
      if (exLeft) {
        if (exSeekbarContainer) exLeft.appendChild(exSeekbarContainer);
        if (exControls) exLeft.appendChild(exControls);
        if (exVolumePanel) exLeft.appendChild(exVolumePanel);
      }

      // Move buttons out of ex-right to expanded-view wrapper so they stay visible when queue is hidden
      if (expandedView && queueHeaderButtons) {
        expandedView.appendChild(queueHeaderButtons);
      }
    } else {
      UI.playerWrapper.classList.remove('fullscreen-active');
      document.body.classList.remove('fullscreen-body-active');
      UI.playerWrapper.classList.remove('hide-queue');
      
      // Reset collapse icon back to arrow_down.svg
      if (collapseFsBtn) {
        const collapseImg = collapseFsBtn.querySelector('img');
        if (collapseImg) {
          collapseImg.src = 'assets/icons/arrow_down.svg';
        }
      }

      // Move buttons back inside queue-header
      if (queueHeader && queueHeaderButtons) {
        queueHeader.appendChild(queueHeaderButtons);
      }
      
      // Restore controls and seekbar back to bottom panel
      if (exVolumePanel && exContentRow) {
        exContentRow.appendChild(exVolumePanel);
      }
      if (exBottom) {
        if (exSeekbarContainer) exBottom.appendChild(exSeekbarContainer);
        if (exControls) exBottom.appendChild(exControls);
      }
    }
    
    // Recalculate marquees to adjust to new bounds
    if (typeof recalculateAllMarquees === 'function') {
      setTimeout(recalculateAllMarquees, 100);
      setTimeout(recalculateAllMarquees, 200);
      setTimeout(recalculateAllMarquees, 350);
    }
  }

  if (exFsToggleBtn) {
    exFsToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setFullscreenMode(true);
    });
  }

  if (exitFsBtn) {
    exitFsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setFullscreenMode(false);
    });
  }

  if (collapseFsBtn) {
    collapseFsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = UI.playerWrapper.classList.toggle('hide-queue');
      
      const collapseImg = collapseFsBtn.querySelector('img');
      if (collapseImg) {
        collapseImg.src = isHidden ? 'assets/icons/up arrow.svg' : 'assets/icons/arrow_down.svg';
      }

      if (typeof recalculateAllMarquees === 'function') {
        setTimeout(recalculateAllMarquees, 100);
        setTimeout(recalculateAllMarquees, 200);
        setTimeout(recalculateAllMarquees, 350);
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    // Ignore keydown events when focus is on text inputs/textareas
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 'escape' || key === 'esc') {
      if (UI.playerWrapper && UI.playerWrapper.classList.contains('fullscreen-active')) {
        e.stopPropagation();
        setFullscreenMode(false);
      }
    } else if (key === 't') {
      e.preventDefault();
      if (UI.playerWrapper) {
        if (!UI.playerWrapper.classList.contains('fullscreen-active')) {
          UI.playerWrapper.classList.toggle('expanded');
          if (typeof recalculateAllMarquees === 'function') {
            setTimeout(recalculateAllMarquees, 100);
            setTimeout(recalculateAllMarquees, 200);
            setTimeout(recalculateAllMarquees, 350);
          }
        }
      }
    } else if (key === 'f') {
      e.preventDefault();
      if (UI.playerWrapper) {
        const isFs = UI.playerWrapper.classList.contains('fullscreen-active');
        if (isFs) {
          setFullscreenMode(false);
        } else {
          // Enter fullscreen only if currently in expanded view
          if (UI.playerWrapper.classList.contains('expanded')) {
            setFullscreenMode(true);
          }
        }
      }
    }
  });
}
