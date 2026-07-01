// vinyl.js
import { CONFIG, UI } from '../utils/config.js';

let dragState = { isMouseDown: false, isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };

const getEventTarget = (e) => (e.touches ? e.touches[0] : e);

function closeMenu() {
  if (UI.vinyl.classList.contains("active")) {
    UI.vinyl.classList.remove("active");
    UI.video.classList.remove("blurred");
    if (UI.playerWrapper) UI.playerWrapper.classList.remove("blurred-player");
    const libraryView = document.getElementById("libraryView");
    if (libraryView) libraryView.classList.remove("blurred-library");
  }
}

function handleDragStart(e) {
  if (e.target.classList.contains("nav-btn")) return;
  dragState.isMouseDown = true;
  dragState.isDragging = false;
  
  const point = getEventTarget(e);
  dragState.startX = point.clientX;
  dragState.startY = point.clientY;
  dragState.startLeft = UI.vinyl.offsetLeft;
  dragState.startTop = UI.vinyl.offsetTop;
  
  document.body.style.userSelect = "none";
}

function handleDragMove(e) {
  if (!dragState.isMouseDown) return;

  const point = getEventTarget(e);
  const deltaX = point.clientX - dragState.startX;
  const deltaY = point.clientY - dragState.startY;

  if (Math.abs(deltaX) > CONFIG.dragThreshold || Math.abs(deltaY) > CONFIG.dragThreshold) {
    dragState.isDragging = true;
    UI.vinyl.classList.add("dragging");
    UI.vinyl.classList.remove("active");
    UI.video.classList.remove("blurred");
    if (UI.playerWrapper) UI.playerWrapper.classList.remove("blurred-player");
  }

  if (!dragState.isDragging) return;
  UI.vinyl.style.left = (dragState.startLeft + deltaX) + "px";
  UI.vinyl.style.top = (dragState.startTop + deltaY) + "px";
}

function handleDragEnd() {
  if (!dragState.isMouseDown) return;
  dragState.isMouseDown = false;
  document.body.style.userSelect = "";

  if (!dragState.isDragging) {
    const isActive = UI.vinyl.classList.toggle("active");
    const libraryView = document.getElementById("libraryView");
    if (isActive) {
      UI.video.classList.add("blurred");
      if (UI.playerWrapper) UI.playerWrapper.classList.add("blurred-player");
      if (libraryView) libraryView.classList.add("blurred-library");
    } else {
      UI.video.classList.remove("blurred");
      if (UI.playerWrapper) UI.playerWrapper.classList.remove("blurred-player");
      if (libraryView) libraryView.classList.remove("blurred-library");
    }
    return;
  }

  dragState.isDragging = false;
  UI.vinyl.classList.remove("dragging", "active");
  UI.video.classList.remove("blurred");
  if (UI.playerWrapper) UI.playerWrapper.classList.remove("blurred-player");
  const libraryView = document.getElementById("libraryView");
  if (libraryView) libraryView.classList.remove("blurred-library");

  calculateSnapPosition();
}

function calculateSnapPosition() {
  const width = UI.vinyl.offsetWidth;
  const height = UI.vinyl.offsetHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const margin = vw <= 768 ? CONFIG.marginMobile : CONFIG.marginDesktop;
  const maxLimitX = vw - margin - width;
  const maxLimitY = vh - margin - height;

  const currentLeft = UI.vinyl.offsetLeft;
  const currentTop = UI.vinyl.offsetTop;
  const centerX = currentLeft + halfWidth;
  const centerY = currentTop + halfHeight;

  const dist = {
    left: centerX,
    right: vw - centerX,
    top: centerY,
    bottom: vh - centerY
  };
  
  const minDistance = Math.min(dist.left, dist.right, dist.top, dist.bottom);
  let finalLeft = currentLeft, finalTop = currentTop;

  UI.vinyl.classList.remove("snap-left", "snap-right", "snap-top", "snap-bottom");

  if (minDistance === dist.left) {
    finalLeft = -halfWidth;
    finalTop = Math.max(margin, Math.min(currentTop, maxLimitY));
    UI.vinyl.classList.add("snap-left");
  } else if (minDistance === dist.right) {
    finalLeft = vw - halfWidth;
    finalTop = Math.max(margin, Math.min(currentTop, maxLimitY));
    UI.vinyl.classList.add("snap-right");
  } else if (minDistance === dist.top) {
    finalLeft = Math.max(margin, Math.min(currentLeft, maxLimitX));
    finalTop = -halfHeight;
    UI.vinyl.classList.add("snap-top");
  } else {
    finalLeft = Math.max(margin, Math.min(currentLeft, maxLimitX));
    finalTop = vh - halfHeight;
    UI.vinyl.classList.add("snap-bottom");

    if (UI.playerWrapper) {
      let rect = UI.playerWrapper.getBoundingClientRect();
      const buffer = vw <= 768 ? CONFIG.bufferMobile : CONFIG.bufferDesktop;
      
      let playerWidth = rect.width;
      let playerLeft = rect.left;
      
      // Fallback if player is hidden (e.g., in fullscreen mode)
      if (playerWidth === 0) {
        playerWidth = Math.min(650, vw * 0.9);
        playerLeft = (vw - playerWidth) / 2;
      }

      const playerRight = playerLeft + playerWidth;
      const safeLeftX = playerLeft - buffer;
      const safeRightX = playerRight + buffer;
      let currentCenterX = finalLeft + halfWidth;
      const playerCenterX = playerLeft + (playerWidth / 2);

      if (currentCenterX > safeLeftX && currentCenterX < safeRightX) {
        finalLeft = (currentCenterX < playerCenterX ? safeLeftX : safeRightX) - halfWidth;
        finalLeft = Math.max(margin, Math.min(finalLeft, maxLimitX));
      }
    }
  }

  UI.vinyl.style.left = `${finalLeft}px`;
  UI.vinyl.style.top = `${finalTop}px`;
}

// Mengekspor fungsi inisialisasi agar bisa dijalankan dari main.js
export function initVinyl() {
  UI.vinyl.addEventListener("mousedown", handleDragStart);
  window.addEventListener("mousemove", handleDragMove);
  window.addEventListener("mouseup", handleDragEnd);

  UI.vinyl.addEventListener("touchstart", handleDragStart, { passive: true });
  window.addEventListener("touchmove", handleDragMove, { passive: false });
  window.addEventListener("touchend", handleDragEnd);

  window.addEventListener("click", (e) => {
    if (UI.vinyl.classList.contains("active") && !UI.vinyl.contains(e.target)) closeMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Esc") closeMenu();
  });
}