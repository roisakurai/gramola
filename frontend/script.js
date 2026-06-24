const vinyl = document.getElementById("vinylContainer");
const video = document.getElementById("bgVideo");

let isMouseDown = false;
let isDragging = false;

let startX = 0;
let startY = 0;
let startLeft = 0;
let startTop = 0;

const dragThreshold = 5;

const getEventTarget = (e) => (e.touches ? e.touches[0] : e);

function dragStart(e) {
  if (e.target.classList.contains("nav-btn")) return;

  isMouseDown = true;
  isDragging = false;

  const point = getEventTarget(e);
  startX = point.clientX;
  startY = point.clientY;

  // BARIS INI SUDAH DIHAPUS agar posisi top tidak melorot saat pertama kali diklik
  // vinyl.style.transform = "none"; 

  startLeft = vinyl.offsetLeft;
  startTop = vinyl.offsetTop;

  document.body.style.userSelect = "none";
}

function dragMove(e) {
  if (!isMouseDown) return;

  const point = getEventTarget(e);
  const deltaX = point.clientX - startX;
  const deltaY = point.clientY - startY;

  if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
    isDragging = true;
    vinyl.classList.add("dragging");
    vinyl.classList.add("active");
    video.classList.add("blurred");
  }

  if (!isDragging) return;

  let currentLeft = startLeft + deltaX;
  let currentTop = startTop + deltaY;

  // --- DETEKSI UKURAN DINAMIS ---
  const width = vinyl.offsetWidth;
  const height = vinyl.offsetHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const margin = vw <= 768 ? 80 : 115;
  const maxLimitX = vw - margin - width; 
  const maxLimitY = vh - margin - height;

  const centerX = currentLeft + halfWidth;
  const centerY = currentTop + halfHeight;

  const distanceToLeft = centerX;
  const distanceToRight = vw - centerX;
  const distanceToTop = centerY;
  
  // UBAH DARI const MENJADI let AGAR NILAINYA BISA DIMANIPULASI
  let distanceToBottom = vh - centerY;

  // ====================================================
  // --- ZONA PENGECUALIAN MUSIC PLAYER ---
  // ====================================================
  const player = document.querySelector(".music-player-wrapper");
  if (player) {
    const playerRect = player.getBoundingClientRect();
    const buffer = 50; // Jarak ekstra 50px agar vinyl tidak terlalu mepet dengan ujung player
    
    // Jika titik tengah vinyl masuk ke dalam rentang sumbu-X music player
    if (centerX > (playerRect.left - buffer) && centerX < (playerRect.right + buffer)) {
      distanceToBottom = Infinity; // Matikan opsi magnet snap ke bawah
    }
  }
  // ====================================================

  const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);

  vinyl.classList.remove("snap-left", "snap-right", "snap-top", "snap-bottom");

  // --- ZONA BATAS AMAN RESPONSIVE ---
  if (minDistance === distanceToLeft) {
    vinyl.classList.add("snap-left");
    currentTop = Math.max(margin, Math.min(currentTop, maxLimitY));
  } else if (minDistance === distanceToRight) {
    vinyl.classList.add("snap-right");
    currentTop = Math.max(margin, Math.min(currentTop, maxLimitY));
  } else if (minDistance === distanceToTop) {
    vinyl.classList.add("snap-top");
    currentLeft = Math.max(margin, Math.min(currentLeft, maxLimitX));
  } else {
    vinyl.classList.add("snap-bottom");
    currentLeft = Math.max(margin, Math.min(currentLeft, maxLimitX));
  }

  vinyl.style.left = currentLeft + "px";
  vinyl.style.top = currentTop + "px";
}

function dragEnd() {
  if (!isMouseDown) return;

  isMouseDown = false;

  if (!isDragging) {
    document.body.style.userSelect = "";
    const isActive = vinyl.classList.toggle("active");
    if (isActive) {
      video.classList.add("blurred");
    } else {
      video.classList.remove("blurred");
    }
    return;
  }

  isDragging = false;
  vinyl.classList.remove("dragging");
  vinyl.classList.remove("active");
  video.classList.remove("blurred");

  // --- DETEKSI UKURAN DINAMIS ---
  const width = vinyl.offsetWidth;
  const height = vinyl.offsetHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const margin = vw <= 768 ? 80 : 115;
  const maxLimitX = vw - margin - width;
  const maxLimitY = vh - margin - height;

  const currentLeft = vinyl.offsetLeft;
  const currentTop = vinyl.offsetTop;

  const centerX = currentLeft + halfWidth;
  const centerY = currentTop + halfHeight;

  const distanceToLeft = centerX;
  const distanceToRight = vw - centerX;
  const distanceToTop = centerY;
  
  // UBAH DARI const MENJADI let
  let distanceToBottom = vh - centerY;

  // ====================================================
  // --- ZONA PENGECUALIAN MUSIC PLAYER (SAAT DILEPAS) ---
  // ====================================================
  const player = document.querySelector(".music-player-wrapper");
  if (player) {
    const playerRect = player.getBoundingClientRect();
    const buffer = 50; 
    
    if (centerX > (playerRect.left - buffer) && centerX < (playerRect.right + buffer)) {
      distanceToBottom = Infinity; 
    }
  }
  // ====================================================

  const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);

  let finalLeft = currentLeft;
  let finalTop = currentTop;

  vinyl.classList.remove("snap-left", "snap-right", "snap-top", "snap-bottom");

  // --- ZONA BATAS AMAN FINAL RESPONSIVE ---
  if (minDistance === distanceToLeft) {
    finalLeft = -halfWidth;
    finalTop = Math.max(margin, Math.min(currentTop, maxLimitY));
    vinyl.classList.add("snap-left");
  } else if (minDistance === distanceToRight) {
    finalLeft = vw - halfWidth;
    finalTop = Math.max(margin, Math.min(currentTop, maxLimitY));
    vinyl.classList.add("snap-right");
  } else if (minDistance === distanceToTop) {
    finalLeft = Math.max(margin, Math.min(currentLeft, maxLimitX));
    finalTop = -halfHeight;
    vinyl.classList.add("snap-top");
  } else {
    finalLeft = Math.max(margin, Math.min(currentLeft, maxLimitX));
    finalTop = vh - halfHeight;
    vinyl.classList.add("snap-bottom");
  }

  vinyl.style.left = `${finalLeft}px`;
  vinyl.style.top = `${finalTop}px`;

  document.body.style.userSelect = "";
}

// Event Listeners
vinyl.addEventListener("mousedown", dragStart);
window.addEventListener("mousemove", dragMove);
window.addEventListener("mouseup", dragEnd);

vinyl.addEventListener("touchstart", dragStart, { passive: true });
window.addEventListener("touchmove", dragMove, { passive: false });
window.addEventListener("touchend", dragEnd);

// --- LOGIKA UTK MENUTUP MENU DI LUAR TOMBOL ATAU DENGAN TOMBOL ESC ---
function closeMenu() {
  if (vinyl.classList.contains("active")) {
    vinyl.classList.remove("active");
    video.classList.remove("blurred");
  }
}

window.addEventListener("click", function (e) {
  if (!vinyl.classList.contains("active")) return;
  const isClickInside = vinyl.contains(e.target);
  if (!isClickInside) {
    closeMenu();
  }
});

window.addEventListener("keydown", function (e) {
  if (e.key === "Escape" || e.key === "Esc") {
    closeMenu();
  }
});

// --- LOGIKA UTK VOLUME WHEEL VERTICAL SLIDER ---
const playerWrapper = document.querySelector(".music-player-wrapper");
const volumeBtn = document.getElementById("volumeBtn");
const volumeWheel = document.getElementById("volumeWheel");
const volCurrent = document.getElementById("volCurrent");
const volNext2 = document.getElementById("volNext2");
const volPrev2 = document.getElementById("volPrev2");
const volumeIcon = document.getElementById("volumeIcon"); // Tambahan untuk Icon

let currentVolume = 100; // 1. Set awal menjadi 100

// Fungsi untuk mengganti Icon Volume ke 4 State
function updateVolumeIcon() {
  if (!volumeIcon) return;
  
  // Pastikan nama file SVG ini sesuai dengan yang kamu punya di folder assets/icons/
  if (currentVolume === 0) {
    volumeIcon.src = "assets/icons/volume_mute.svg"; // State 1: No Volume
  } else if (currentVolume <= 33) {
    volumeIcon.src = "assets/icons/volume_low.svg";  // State 2: Low Volume
  } else if (currentVolume <= 66) {
    volumeIcon.src = "assets/icons/volume_normal.svg"; // State 3: Normal Volume
  } else {
    volumeIcon.src = "assets/icons/volume_high.svg"; // State 4: High Volume (Bisa pakai default-mu)
  }
}

function updateVolumeDisplay() {
  if (!volCurrent) return;
  
  volCurrent.textContent = currentVolume;
  
  // 2. Gunakan &nbsp; (Spasi Kosong HTML) agar flexbox tidak kempes/turun saat angka kosong
  volNext2.innerHTML = currentVolume + 1 <= 100 ? currentVolume + 1 : "&nbsp;";
  volPrev2.innerHTML = currentVolume - 1 >= 0 ? currentVolume - 1 : "&nbsp;";
  
  // Memicu animasi CSS ease saat angka berubah
  volCurrent.classList.remove('slide-anim');
  void volCurrent.offsetWidth; // Memicu reflow browser
  volCurrent.classList.add('slide-anim');

  updateVolumeIcon(); // Jalankan pengecekan icon setiap kali angka berubah
}

if (volumeBtn && volumeWheel) {
  // 3. Logika Klik Tombol Volume (Toggle ON / OFF yang sempurna)
  volumeBtn.addEventListener("click", function (e) {
    e.stopPropagation(); 
    
    // Cek apakah panel sedang terbuka
    const isShowing = volumeWheel.classList.contains("show");
    
    if (isShowing) {
      // Jika terbuka, maka TUTUP
      volumeWheel.classList.remove("show");
      volumeBtn.classList.remove("active-v");
      if (playerWrapper) playerWrapper.classList.remove("volume-active");
    } else {
      // Jika tertutup, maka BUKA
      volumeWheel.classList.add("show");
      volumeBtn.classList.add("active-v");
      if (playerWrapper) playerWrapper.classList.add("volume-active");
    }
    
    updateVolumeDisplay();
  });

  // Fungsi mengubah nilai volume berdasarkan arah
  function changeVolume(amount) {
    let newVol = currentVolume + amount;
    if (newVol > 100) newVol = 100;
    if (newVol < 0) newVol = 0;
    
    if (newVol !== currentVolume) {
      currentVolume = newVol;
      updateVolumeDisplay();
    }
  }

  if (volNext2) {
    volNext2.addEventListener("click", function(e) {
      e.stopPropagation(); // Mencegah panel tertutup gara-gara global click
      if (currentVolume < 100) {
        changeVolume(1);
      }
    });
  }

  // Klik angka bagian bawah (-1)
  if (volPrev2) {
    volPrev2.addEventListener("click", function(e) {
      e.stopPropagation(); // Mencegah panel tertutup gara-gara global click
      if (currentVolume > 0) {
        changeVolume(-1);
      }
    });
  }

  // 4. Deteksi Scroll Roda Mouse (Lebih Cepat & Sensitif)
  volumeWheel.addEventListener("wheel", function (e) {
    e.preventDefault(); 
    
    // Hitung kecepatan scroll (semakin keras scroll, stepnya semakin besar)
    let step = Math.max(1, Math.ceil(Math.abs(e.deltaY) / 15)); 
    if (step > 10) step = 10; // Batas maksimal loncatan angka
    
    const direction = e.deltaY < 0 ? 1 : -1;
    changeVolume(direction * step);
  }, { passive: false });

  // 5. Deteksi Swipe Vertikal HP (Lebih Natural 1:1)
  let touchStartY = 0;
  let lastVolumeTouch = 100;
  
  volumeWheel.addEventListener("touchstart", function (e) {
    touchStartY = e.touches[0].clientY;
    lastVolumeTouch = currentVolume; // Simpan nilai awal saat jari nempel
  }, { passive: true });

  volumeWheel.addEventListener("touchmove", function (e) {
    e.preventDefault();
    const touchEndY = e.touches[0].clientY;
    const diffY = touchStartY - touchEndY; // Positif = geser ke atas

    // Setiap geseran 3 pixel = naik 1 volume (sangat responsif & ngebut)
    const step = Math.round(diffY / 3); 
    
    let newVol = lastVolumeTouch + step;
    if (newVol > 100) newVol = 100;
    if (newVol < 0) newVol = 0;
    
    if (newVol !== currentVolume) {
      currentVolume = newVol;
      updateVolumeDisplay();
    }
  }, { passive: false });
}

// Global event: Menutup panel jika klik di luar
// window.addEventListener("click", function (e) {
//   if (volumeWheel && volumeBtn) {
//     if (!volumeWheel.contains(e.target) && !volumeBtn.contains(e.target)) {
//       volumeWheel.classList.remove("show");
//       volumeBtn.classList.remove("active-v");
//       if (playerWrapper) playerWrapper.classList.remove("volume-active");
//     }
//   }
// });

// Panggil sekali di awal untuk set icon default (Volume 100)
updateVolumeIcon();