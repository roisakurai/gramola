import { UI } from '../utils/config.js';

export function initFullscreen(recalculateAllMarquees) {
  // --- FULL SCREEN VIEW MODE LOGIC ---
  const exFsToggleBtn = document.getElementById('exFsToggleBtn');
  const exitFsBtn = document.getElementById('exitFsBtn');
  const collapseFsBtn = document.getElementById('collapseFsBtn');
  
  let wasLibraryOpen = false;
  let wasLibraryBtnActive = false;

  const collapseImg = collapseFsBtn ? collapseFsBtn.querySelector('img') : null;

  function adjustColumnsToFit() {
    const container = document.querySelector('#fullscreenView .ex-right');
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;
    
    let titleWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-title-width') || '250');
    let totalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--col-total-width') || '450');
    
    // Reserve at least 280px for gaps, number, art, and min duration width (100px)
    const maxTotal = containerWidth - 280;
    
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
    const fsView = document.getElementById('fullscreenView');
    if (fsView && fsView.classList.contains('show')) {
      adjustColumnsToFit();
    }
  });

  function setFullscreenMode(active) {
    const fsView = document.getElementById('fullscreenView');
    if (!fsView) return;
    
    if (active) {
      fsView.classList.add('transitioning-fullscreen');
      fsView.classList.add('show');
      setTimeout(() => {
        fsView.classList.remove('transitioning-fullscreen');
      }, 500);
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
 
      // Save state and close library view if open
      const libraryView = document.getElementById("libraryView");
      const libraryBtn = document.querySelector(".nav-btn.btn-2");
      wasLibraryOpen = libraryView && libraryView.classList.contains("show");
      wasLibraryBtnActive = libraryBtn && libraryBtn.classList.contains("active");

      if (libraryView) {
        libraryView.classList.remove("show");
        libraryView.classList.remove("blurred-library");
      }
      if (libraryBtn) {
        libraryBtn.classList.remove("active");
      }
 
      // Close vinyl active state if open
      const vinylContainer = document.getElementById("vinylContainer");
      if (vinylContainer) {
        vinylContainer.classList.remove("active");
      }
      const bgVideo = document.getElementById("bgVideo");
      if (bgVideo) {
        bgVideo.classList.remove("blurred");
      }
      if (UI.playerWrapper) UI.playerWrapper.classList.remove("blurred-player");
    } else {
      fsView.classList.add('transitioning-fullscreen');
      fsView.classList.remove('show');
      setTimeout(() => {
        fsView.classList.remove('transitioning-fullscreen');
      }, 500);
      document.body.classList.remove('fullscreen-body-active');
      fsView.classList.remove('hide-queue');
      
      // Restore library view state if it was previously open
      if (wasLibraryOpen) {
        const libraryView = document.getElementById("libraryView");
        const libraryBtn = document.querySelector(".nav-btn.btn-2");
        if (libraryView) {
          libraryView.classList.add("show");
        }
        if (libraryBtn) {
          libraryBtn.classList.add("active");
        }
      }

      // Reset collapse icon back to arrow_down.svg
      if (collapseImg) {
        collapseImg.src = 'assets/icons/arrow_down.svg';
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
      const fsView = document.getElementById('fullscreenView');
      const isHidden = fsView ? fsView.classList.toggle('hide-queue') : false;
      
      if (collapseImg) {
        collapseImg.src = isHidden ? 'assets/icons/arrow_up.svg' : 'assets/icons/arrow_down.svg';
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
      const fsView = document.getElementById('fullscreenView');
      if (fsView && fsView.classList.contains('show')) {
        e.stopPropagation();
        setFullscreenMode(false);
      }
    } else if (key === 't') {
      e.preventDefault();
      const fsView = document.getElementById('fullscreenView');
      const isFs = fsView && fsView.classList.contains('show');
      if (UI.playerWrapper && !isFs) {
        UI.playerWrapper.classList.toggle('expanded');
        if (typeof recalculateAllMarquees === 'function') {
          setTimeout(recalculateAllMarquees, 100);
          setTimeout(recalculateAllMarquees, 200);
          setTimeout(recalculateAllMarquees, 350);
        }
      }
    } else if (key === 'f') {
      e.preventDefault();
      const fsView = document.getElementById('fullscreenView');
      const isFs = fsView && fsView.classList.contains('show');
      if (isFs) {
        setFullscreenMode(false);
      } else {
        // Enter fullscreen only if currently in expanded view
        if (UI.playerWrapper && UI.playerWrapper.classList.contains('expanded')) {
          setFullscreenMode(true);
        }
      }
    }
  });
}
