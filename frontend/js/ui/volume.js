// volume.js
import { CONFIG, UI } from '../utils/config.js';

let volumeState = { current: 100, interval: null, timeout: null, isHolding: false }; // Default set to 100

function updateVolumeIcon(iconElement, currentVal) {
  if (!iconElement) return;
  if (currentVal === 0) {
    iconElement.src = "assets/icons/volume_mute.svg";
  } else if (currentVal <= 33) {
    iconElement.src = "assets/icons/volume_low.svg";
  } else if (currentVal <= 66) {
    iconElement.src = "assets/icons/volume_normal.svg";
  } else {
    iconElement.src = "assets/icons/volume_high.svg";
  }
}

function updateVolumeDisplay() {
  const val = volumeState.current;

  // 1. Update Compact View
  if (UI.volCurrent) UI.volCurrent.textContent = val;
  if (UI.volNext2) UI.volNext2.innerHTML = val + 1 <= 100 ? val + 1 : "&nbsp;";
  if (UI.volPrev2) UI.volPrev2.innerHTML = val - 1 >= 0 ? val - 1 : "&nbsp;";
  
  if (UI.volCurrent) {
    UI.volCurrent.classList.remove('slide-anim');
    void UI.volCurrent.offsetWidth; 
    UI.volCurrent.classList.add('slide-anim');
  }
  updateVolumeIcon(UI.volumeIcon, val);

  // 2. Update Expanded View
  if (UI.exVolCurrent) UI.exVolCurrent.textContent = val;
  if (UI.exVolNext1) UI.exVolNext1.innerHTML = val + 1 <= 100 ? val + 1 : "&nbsp;";
  if (UI.exVolNext2) UI.exVolNext2.innerHTML = val + 2 <= 100 ? val + 2 : "&nbsp;";
  if (UI.exVolPrev1) UI.exVolPrev1.innerHTML = val - 1 >= 0 ? val - 1 : "&nbsp;";
  if (UI.exVolPrev2) UI.exVolPrev2.innerHTML = val - 2 >= 0 ? val - 2 : "&nbsp;";

  updateVolumeIcon(UI.exVolumeIcon, val);

  // Sync with audio element
  if (window.Player && window.Player.audio) {
    window.Player.audio.volume = val / 100;
  }
}

function changeVolume(amount) {
  let newVol = Math.max(0, Math.min(100, volumeState.current + amount));
  if (newVol !== volumeState.current) {
    volumeState.current = newVol;
    updateVolumeDisplay();
  }
}

let holdStartTime = 0;

function startVolumeRepeat(direction) {
  stopVolumeRepeat();
  volumeState.isHolding = true;
  changeVolume(direction);
  holdStartTime = Date.now();

  function tick() {
    const elapsed = Date.now() - holdStartTime;
    
    // next2/prev2 (Math.abs(direction) >= 2) starts faster and reaches a faster speed
    let baseInterval = Math.abs(direction) >= 2 ? 80 : 120;
    let minInterval = Math.abs(direction) >= 2 ? 15 : 30;
    
    // Accelerate interval: decrease delay by 1ms for every 20ms held
    let currentInterval = Math.max(minInterval, baseInterval - (elapsed / 20));
    
    changeVolume(direction);
    volumeState.timeout = setTimeout(tick, currentInterval);
  }

  volumeState.timeout = setTimeout(tick, CONFIG.holdDelayMs);
}

function stopVolumeRepeat() {
  if (volumeState.timeout) {
    clearTimeout(volumeState.timeout);
    volumeState.timeout = null;
  }
  if (volumeState.interval) {
    clearInterval(volumeState.interval);
    volumeState.interval = null;
  }
}

function setVolumePanelActive(isActive) {
  if (UI.volumeWheel) UI.volumeWheel.classList.toggle("show", isActive);
  if (UI.volumeBtn) UI.volumeBtn.classList.toggle("active-v", isActive);
  if (UI.exVolumePanel) UI.exVolumePanel.classList.toggle("show", isActive);
  if (UI.exVolumeBtn) UI.exVolumeBtn.classList.toggle("active-v", isActive);
  if (UI.playerWrapper) UI.playerWrapper.classList.toggle("volume-active", isActive);
}

export function initVolume() {
  function setupDragVolume(wheelEl, isExVolume) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startVolume = 0;

    function handleStart(x, y) {
      isDragging = true;
      startX = x;
      startY = y;
      startVolume = volumeState.current;
    }

    function handleMove(x, y) {
      if (!isDragging) return;
      
      const isFullscreen = isExVolume && UI.playerWrapper && UI.playerWrapper.classList.contains('fullscreen-active');
      let step = 0;
      
      if (isFullscreen) {
        // Horizontal drag for fullscreen mode
        const deltaX = x - startX;
        step = Math.round(deltaX / 3);
      } else {
        // Vertical drag for compact/expanded mode
        const deltaY = startY - y;
        step = Math.round(deltaY / 3);
      }
      
      const newVol = Math.max(0, Math.min(100, startVolume + step));
      if (newVol !== volumeState.current) {
        volumeState.current = newVol;
        updateVolumeDisplay();
      }
    }

    function handleEnd() {
      isDragging = false;
    }

    // Touch events
    wheelEl.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    }, { passive: true });

    wheelEl.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }, { passive: false });

    wheelEl.addEventListener("touchend", handleEnd);

    // Mouse drag events
    wheelEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // Left click only
      e.stopPropagation();
      e.preventDefault();
      handleStart(e.clientX, e.clientY);

      const onMouseMove = (moveEv) => {
        handleMove(moveEv.clientX, moveEv.clientY);
      };

      const onMouseUp = () => {
        handleEnd();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // --- 1. COMPACT VIEW VOLUME WHEEL ---
  if (UI.volumeBtn && UI.volumeWheel) {
    UI.volumeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = !UI.volumeWheel.classList.contains("show");
      setVolumePanelActive(isActive);
      updateVolumeDisplay();
    });

    if (UI.volNext2) {
      UI.volNext2.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) startVolumeRepeat(1); });
      UI.volNext2.addEventListener("touchstart", (e) => { e.stopPropagation(); startVolumeRepeat(1); }, { passive: true });
      UI.volNext2.addEventListener("mouseleave", () => { if (volumeState.isHolding) stopVolumeRepeat(); });
      UI.volNext2.addEventListener("mouseenter", () => { if (volumeState.isHolding) startVolumeRepeat(1); });
    }

    if (UI.volPrev2) {
      UI.volPrev2.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) startVolumeRepeat(-1); });
      UI.volPrev2.addEventListener("touchstart", (e) => { e.stopPropagation(); startVolumeRepeat(-1); }, { passive: true });
      UI.volPrev2.addEventListener("mouseleave", () => { if (volumeState.isHolding) stopVolumeRepeat(); });
      UI.volPrev2.addEventListener("mouseenter", () => { if (volumeState.isHolding) startVolumeRepeat(-1); });
    }

    UI.volumeWheel.addEventListener("wheel", (e) => {
      e.preventDefault(); 
      let step = Math.min(10, Math.max(1, Math.ceil(Math.abs(e.deltaY) / 15))); 
      changeVolume(e.deltaY < 0 ? step : -step);
    }, { passive: false });

    setupDragVolume(UI.volumeWheel, false);
  }

  // --- 2. EXPANDED VIEW VOLUME PANEL ---
  if (UI.exVolumeBtn && UI.exVolumePanel) {
    UI.exVolumeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = !UI.exVolumePanel.classList.contains("show");
      setVolumePanelActive(isActive);
      updateVolumeDisplay();
    });

    if (UI.exVolumeWheel) {
      UI.exVolumeWheel.addEventListener("wheel", (e) => {
        e.preventDefault();
        let step = Math.min(10, Math.max(1, Math.ceil(Math.abs(e.deltaY) / 15)));
        changeVolume(e.deltaY < 0 ? step : -step);
      }, { passive: false });

      setupDragVolume(UI.exVolumeWheel, true);

      if (UI.exVolNext1) {
        UI.exVolNext1.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) startVolumeRepeat(1); });
        UI.exVolNext1.addEventListener("touchstart", (e) => { e.stopPropagation(); startVolumeRepeat(1); }, { passive: true });
        UI.exVolNext1.addEventListener("mouseleave", () => { if (volumeState.isHolding) stopVolumeRepeat(); });
        UI.exVolNext1.addEventListener("mouseenter", () => { if (volumeState.isHolding) startVolumeRepeat(1); });
      }
      if (UI.exVolNext2) {
        UI.exVolNext2.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) startVolumeRepeat(2); });
        UI.exVolNext2.addEventListener("touchstart", (e) => { e.stopPropagation(); startVolumeRepeat(2); }, { passive: true });
        UI.exVolNext2.addEventListener("mouseleave", () => { if (volumeState.isHolding) stopVolumeRepeat(); });
        UI.exVolNext2.addEventListener("mouseenter", () => { if (volumeState.isHolding) startVolumeRepeat(2); });
      }
      if (UI.exVolPrev1) {
        UI.exVolPrev1.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) startVolumeRepeat(-1); });
        UI.exVolPrev1.addEventListener("touchstart", (e) => { e.stopPropagation(); startVolumeRepeat(-1); }, { passive: true });
        UI.exVolPrev1.addEventListener("mouseleave", () => { if (volumeState.isHolding) stopVolumeRepeat(); });
        UI.exVolPrev1.addEventListener("mouseenter", () => { if (volumeState.isHolding) startVolumeRepeat(-1); });
      }
      if (UI.exVolPrev2) {
        UI.exVolPrev2.addEventListener("mousedown", (e) => { e.stopPropagation(); if (e.button === 0) startVolumeRepeat(-2); });
        UI.exVolPrev2.addEventListener("touchstart", (e) => { e.stopPropagation(); startVolumeRepeat(-2); }, { passive: true });
        UI.exVolPrev2.addEventListener("mouseleave", () => { if (volumeState.isHolding) stopVolumeRepeat(); });
        UI.exVolPrev2.addEventListener("mouseenter", () => { if (volumeState.isHolding) startVolumeRepeat(-2); });
      }
    }
  }

  // Global mouse/touch release
  window.addEventListener("mouseup", () => {
    volumeState.isHolding = false;
    stopVolumeRepeat();
  });
  window.addEventListener("touchend", () => {
    volumeState.isHolding = false;
    stopVolumeRepeat();
  });

  // Mute shortcut: 'm' key press (case-insensitive)
  let preMuteVolume = 100;
  window.addEventListener('keydown', (e) => {
    // Ignore keydown events when focus is on text inputs/textareas
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      if (volumeState.current > 0) {
        preMuteVolume = volumeState.current;
        volumeState.current = 0;
      } else {
        volumeState.current = preMuteVolume > 0 ? preMuteVolume : 100;
      }
      updateVolumeDisplay();
    }
  });

  updateVolumeDisplay();
}