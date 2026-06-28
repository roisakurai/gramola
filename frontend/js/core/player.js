// player.js
import { CONFIG, UI } from '../utils/config.js';
import { setRandomVideo } from '../utils/randomAssets.js';
import { initFullscreen } from '../ui/fullscreen.js';
import { initResizableColumns } from '../ui/queueDragDrop.js';

export function initPlayer() {
  const handle = document.querySelector('.player-handle');
  
  if (handle && UI.playerWrapper) {
    handle.addEventListener('click', () => {
      // Menambah/mencabut class 'expanded' setiap kali handle (tombol panah) diklik
      UI.playerWrapper.classList.toggle('expanded');
      
      // Recalculate marquee multiple times during the transition to bind to final dimensions
      setTimeout(recalculateAllMarquees, 100);
      setTimeout(recalculateAllMarquees, 200);
      setTimeout(recalculateAllMarquees, 350);
    });
  }

  initFullscreen(recalculateAllMarquees);


  // --- DYNAMIC ALBUM ART WRAPPER & HOVER PLAY OVERLAY ---
  const queueItems = Array.from(document.querySelectorAll('.queue-item'));
  queueItems.forEach(item => {
    const img = item.querySelector(':scope > img');
    if (img && img.parentElement === item) {
      const container = document.createElement('div');
      container.className = 'queue-art-container';
      item.insertBefore(container, img);
      container.appendChild(img);
      
      const overlay = document.createElement('div');
      overlay.className = 'queue-play-overlay';
      overlay.innerHTML = '<img src="assets/icons/play.svg" alt="Play">';
      container.appendChild(overlay);
    }
  });

  // --- SHIFT-CLICK SELECTION FOR QUEUE ITEMS ---
  let lastSelectedIndex = -1;
  queueItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
      if (e.shiftKey) {
        e.preventDefault();
      }

      if (e.shiftKey && lastSelectedIndex !== -1) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        queueItems.forEach(i => i.classList.remove('active'));
        
        for (let i = start; i <= end; i++) {
          queueItems[i].classList.add('active');
        }
      } else {
        queueItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        lastSelectedIndex = index;
      }
    });
  });

  // Toggle status love/like saat tombol diklik
  const loveButtons = document.querySelectorAll('.queue-item .love-btn');
  loveButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Mencegah baris lagu menjadi aktif/terpilih
      const isLiked = btn.classList.toggle('liked');
      const img = btn.querySelector('img');
      if (isLiked) {
        img.src = 'assets/icons/love.svg';
      } else {
        img.src = 'assets/icons/love_outline.svg';
      }
    });
  });

  // --- SHUFFLE & REPEAT TOGGLES ---
  const shuffleButtons = document.querySelectorAll('.shuffle-btn');
  const repeatButtons = document.querySelectorAll('.repeat-btn');
  let isShuffle = false;
  let isRepeat = false;
  let isPlayingStarted = false;

  function toggleShuffleState(enableShuffle) {
    if (currentQueue.length === 0) return;
    if (enableShuffle) {
      originalQueue = [...currentQueue];
      const currentTrack = currentQueue[currentIndex];
      const otherTracks = currentQueue.filter((_, idx) => idx !== currentIndex);
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }
      currentQueue = [currentTrack, ...otherTracks];
      currentIndex = 0;
    } else {
      if (originalQueue.length > 0) {
        const currentTrack = currentQueue[currentIndex];
        currentQueue = [...originalQueue];
        currentIndex = currentQueue.findIndex(t => t.file === currentTrack.file);
        originalQueue = [];
      }
    }
    renderQueue();
  }

  shuffleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isShuffle = !isShuffle;
      shuffleButtons.forEach(b => b.classList.toggle('active', isShuffle));
      toggleShuffleState(isShuffle);
    });
  });

  repeatButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isRepeat = !isRepeat;
      repeatButtons.forEach(b => b.classList.toggle('active', isRepeat));
      audio.loop = isRepeat;
      renderQueue();
    });
  });
  // --- PLAY/PAUSE TOGGLE ---
  const playButtons = document.querySelectorAll('.play-btn');
  const loaderDivs = document.querySelectorAll('.loader div');
  const vinylImg = document.getElementById('vinyl');
  let isPlaying = false;
  let loaderTimeout = null;
  
  const audio = new Audio();
  let allTracks = [];
  let currentQueue = [];
  let currentIndex = -1;
  let originalQueue = [];
  let userQueue = [];
  let isUserQueuePlaying = false;
  let currentSourceName = "in peace (or anxious)";

  // Set initial volume from DOM
  const volCurrent = document.getElementById('volCurrent');
  if (volCurrent) {
    const volVal = parseInt(volCurrent.textContent, 10);
    audio.volume = isNaN(volVal) ? 1.0 : volVal / 100;
  } else {
    audio.volume = 1.0;
  }

  function updateLoaderState(playing) {
    if (loaderTimeout) {
      clearTimeout(loaderTimeout);
      loaderTimeout = null;
    }

    const targetHeights = ['16px', '34px', '22px', '34px', '16px'];

    loaderDivs.forEach((div, index) => {
      // Clear any transform scaleY properties so we rely on layout height
      div.style.transform = '';

      if (playing) {
        // Active: restore animation settings and primary background
        div.style.transition = 'background 0.4s ease';
        div.style.animation = ''; // clear inline style to let stylesheet animation take over
        div.style.animationPlayState = 'running';
        div.style.background = 'var(--primary)';
        div.style.height = ''; // clear inline height
      } else {
        // Paused: freeze current wiggling height
        const currentHeight = window.getComputedStyle(div).height;
        div.style.height = currentHeight;
        div.style.animation = 'none';

        // Trigger reflow to apply frozen height before transition
        void div.offsetHeight;

        // Transition to symmetrical centered heights and white background
        div.style.transition = 'height 0.8s cubic-bezier(0.25, 1, 0.5, 1), background 0.8s ease';
        div.style.height = targetHeights[index];
        div.style.background = '#fff';
      }
    });

    if (!playing) {
      loaderTimeout = setTimeout(() => {
        loaderDivs.forEach(div => {
          div.style.animationPlayState = 'paused';
        });
      }, 800);
    }
  }

  // Initial loader state (paused by default until play is clicked)
  updateLoaderState(isPlaying);

  function updateUIPlayState(playing) {
    isPlaying = playing;
    playButtons.forEach(b => {
      const img = b.querySelector('img');
      if (img) {
        img.src = playing ? 'assets/icons/pause.svg' : 'assets/icons/play.svg';
        img.alt = playing ? 'Pause' : 'Play';
        img.style.transform = playing ? 'none' : 'translateX(1px)';
      }
    });

    updateLoaderState(playing);

    if (vinylImg) {
      vinylImg.style.animationPlayState = playing ? 'running' : 'paused';
    }
  }

  function togglePlayPause() {
    if (!audio.src && allTracks.length > 0) {
      loadTrack(allTracks[0], allTracks, 0);
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => console.log("Audio play failed:", err));
    }
  }

  audio.addEventListener('play', () => {
    isPlayingStarted = true;
    updateUIPlayState(true);
    const duration = audio.duration || 0;
    const percentage = duration ? (audio.currentTime / duration) * 100 : 0;
    updateProgressUI(percentage, audio.currentTime, duration);
  });
  audio.addEventListener('pause', () => updateUIPlayState(false));

  playButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayPause();
    });
  });

  // Spacebar hotkey
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      togglePlayPause();
    }
  });

  // --- SYNCED PROGRESS BAR / SEEKBAR SLIDE LOGIC ---
  const compactProgressContainer = document.querySelector('.progress-container');
  const compactProgressCurrent = document.querySelector('.progress-current');
  const compactTimeCurrent = document.querySelector('.time-info .time:first-child');
  const compactTimeDuration = document.querySelector('.time-info .time:last-child');

  const exProgressBar = document.querySelector('.ex-progress-bar');
  const exProgressCurrent = document.querySelector('.ex-progress-current');
  const exTimeCurrent = document.querySelector('.ex-time-row .ex-time:first-child');
  const exTimeDuration = document.querySelector('.ex-time-row .ex-time:last-child');

  let isDragging = false;
  let dragPercentage = 0;

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function updateProgressUI(percentage, currentTime, duration) {
    if (compactProgressCurrent) {
      compactProgressCurrent.style.width = `${percentage}%`;
      compactProgressCurrent.style.backgroundColor = percentage === 0 ? 'transparent' : 'var(--primary)';
    }
    if (exProgressCurrent) {
      exProgressCurrent.style.width = `${percentage}%`;
      exProgressCurrent.style.backgroundColor = percentage === 0 ? 'transparent' : 'var(--primary)';
    }

    const timeStr = formatTime(currentTime);
    if (compactTimeCurrent) compactTimeCurrent.textContent = timeStr;
    if (exTimeCurrent) exTimeCurrent.textContent = timeStr;

    if (duration) {
      const durStr = formatTime(duration);
      if (compactTimeDuration) compactTimeDuration.textContent = durStr;
      if (exTimeDuration) exTimeDuration.textContent = durStr;
    }
  }

  audio.addEventListener('timeupdate', () => {
    if (isDragging) return;
    if (!isPlayingStarted) return;
    if (!audio.duration) return;
    const percentage = (audio.currentTime / audio.duration) * 100;
    updateProgressUI(percentage, audio.currentTime, audio.duration);
  });

  audio.addEventListener('durationchange', () => {
    if (!isPlayingStarted) return;
    if (!audio.duration) return;
    const durStr = formatTime(audio.duration);
    if (compactTimeDuration) compactTimeDuration.textContent = durStr;
    if (exTimeDuration) exTimeDuration.textContent = durStr;
  });

  audio.addEventListener('loadedmetadata', () => {
    if (!isPlayingStarted) return;
    if (!audio.duration) return;
    const durStr = formatTime(audio.duration);
    if (compactTimeDuration) compactTimeDuration.textContent = durStr;
    if (exTimeDuration) exTimeDuration.textContent = durStr;
  });

  function handleSeekStart(e, container) {
    // Only allow left-clicks (button 0) for mousedown events.
    if (e.type === 'mousedown' && e.button !== 0) {
      return;
    }
    isDragging = true;
    handleSeekMove(e, container);
  }

  function handleSeekMove(e, container) {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    
    dragPercentage = percentage;
    const duration = audio.duration || 249;
    const currentSecs = (percentage / 100) * duration;
    updateProgressUI(percentage, currentSecs, duration);
  }

  function handleSeekEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (audio.duration) {
      audio.currentTime = (dragPercentage / 100) * audio.duration;
    }
  }

  // Compact view seek listeners
  if (compactProgressContainer) {
    compactProgressContainer.addEventListener('mousedown', (e) => handleSeekStart(e, compactProgressContainer));
    compactProgressContainer.addEventListener('touchstart', (e) => handleSeekStart(e, compactProgressContainer), { passive: true });
  }

  // Expanded view seek listeners
  if (exProgressBar) {
    exProgressBar.addEventListener('mousedown', (e) => handleSeekStart(e, exProgressBar));
    exProgressBar.addEventListener('touchstart', (e) => handleSeekStart(e, exProgressBar), { passive: true });
  }

  // Global mouse move & touch move for dragging outside seekbars
  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const isExpanded = UI.playerWrapper && UI.playerWrapper.classList.contains('expanded');
      const activeContainer = isExpanded ? exProgressBar : compactProgressContainer;
      if (activeContainer) handleSeekMove(e, activeContainer);
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging) {
      const isExpanded = UI.playerWrapper && UI.playerWrapper.classList.contains('expanded');
      const activeContainer = isExpanded ? exProgressBar : compactProgressContainer;
      if (activeContainer) handleSeekMove(e, activeContainer);
    }
  }, { passive: false });

  window.addEventListener('mouseup', handleSeekEnd);
  window.addEventListener('touchend', handleSeekEnd);

  // --- SEEKBAR HOVER TOOLTIP & PREVIEW HIGHLIGHT LOGIC ---
  if (compactProgressContainer) {
    compactProgressContainer.addEventListener('mousemove', (e) => {
      const rect = compactProgressContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const HP = Math.max(0, Math.min(100, (x / rect.width) * 100));
      
      const duration = audio.duration || 249;
      const hoverSecs = Math.round((HP / 100) * duration);
      const hoverTimeStr = formatTime(hoverSecs);
      const tooltip = compactProgressContainer.querySelector('.progress-tooltip');
      if (tooltip) {
        tooltip.textContent = hoverTimeStr;
        tooltip.style.left = `${x}px`;
      }

      const currentPercent = parseFloat(compactProgressCurrent.style.width || '0');
      const preview = compactProgressContainer.querySelector('.progress-hover-preview');
      if (preview) {
        if (HP > currentPercent) {
          preview.style.left = `${currentPercent}%`;
          preview.style.width = `${HP - currentPercent}%`;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
      }
    });

    compactProgressContainer.addEventListener('mouseleave', () => {
      const preview = compactProgressContainer.querySelector('.progress-hover-preview');
      if (preview) preview.style.display = 'none';
    });
  }

  if (exProgressBar) {
    exProgressBar.addEventListener('mousemove', (e) => {
      const rect = exProgressBar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const HP = Math.max(0, Math.min(100, (x / rect.width) * 100));

      const duration = audio.duration || 249;
      const hoverSecs = Math.round((HP / 100) * duration);
      const hoverTimeStr = formatTime(hoverSecs);
      const tooltip = exProgressBar.querySelector('.ex-progress-tooltip');
      if (tooltip) {
        tooltip.textContent = hoverTimeStr;
        tooltip.style.left = `${x}px`;
      }

      const currentPercent = parseFloat(exProgressCurrent.style.width || '0');
      const preview = exProgressBar.querySelector('.ex-progress-hover-preview');
      if (preview) {
        if (HP > currentPercent) {
          preview.style.left = `${currentPercent}%`;
          preview.style.width = `${HP - currentPercent}%`;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
      }
    });

    exProgressBar.addEventListener('mouseleave', () => {
      const preview = exProgressBar.querySelector('.ex-progress-hover-preview');
      if (preview) preview.style.display = 'none';
    });
  }

  // --- PLAYBACK QUEUE & NEXT/PREV NAVIGATION ---
  const prevButtons = document.querySelectorAll('.prev-btn');
  const nextButtons = document.querySelectorAll('.next-btn');

  function playNext() {
    if (userQueue.length > 0) {
      const nextTrack = userQueue.shift();
      loadTrack(nextTrack, currentQueue, currentIndex, true, true);
      return;
    }

    if (currentQueue.length === 0) return;
    if (!isRepeat) {
      currentIndex = (currentIndex + 1) % currentQueue.length;
    }
    loadTrack(currentQueue[currentIndex], currentQueue, currentIndex, true, false);
  }

  function playPrev() {
    if (isUserQueuePlaying) {
      isUserQueuePlaying = false;
      loadTrack(currentQueue[currentIndex], currentQueue, currentIndex, true, false);
      return;
    }

    if (currentQueue.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    
    if (!isRepeat) {
      currentIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
    }
    loadTrack(currentQueue[currentIndex], currentQueue, currentIndex, true, false);
  }

  prevButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPrev();
    });
  });

  nextButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playNext();
    });
  });

  audio.addEventListener('ended', playNext);

  // --- DYNAMIC QUEUE LIST RENDERING & EVENTS ---

  function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "queue-toast";
    toast.textContent = message;
    container.appendChild(toast);

    // Force repaint to trigger entrance animation
    void toast.offsetWidth;
    toast.classList.add("show");

    // Phase 1: Slide out after 2 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      
      // Phase 2: Remove from DOM after transition completes (300ms)
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2000);
  }

  function addToQueue(track) {
    if (!track) return;
    userQueue.push(track);
    showToast("Added to queue");
    renderQueue();
  }

  function playUserQueueTrack(userIndex) {
    const track = userQueue[userIndex];
    userQueue.splice(userIndex, 1);
    loadTrack(track, currentQueue, currentIndex, true, true);
  }

  function createQueueItemDOM(track, index, displayNum, isFromUserQueue, userIndex = -1) {
    const item = document.createElement('div');
    item.className = 'queue-item';
    if (index === currentIndex && !isUserQueuePlaying && !isFromUserQueue) {
      item.classList.add('playing');
    }
    
    const durationStr = formatTime(track.duration || 0);
    
    item.innerHTML = `
      <span class="queue-number">${displayNum}</span>
      <div class="queue-art-container">
        <img src="${track.cover}" alt="Art">
        <div class="queue-play-overlay">
          <img src="assets/icons/play.svg" alt="Play">
        </div>
      </div>
      <div class="queue-info">
        <h4>${track.title}</h4>
        <p>${track.artist}</p>
      </div>
      <span class="queue-album">${track.album || ''}</span>
      <span class="queue-time">${durationStr}</span>
      <div class="queue-actions">
        <button class="action-btn love-btn"><img src="assets/icons/love_outline.svg" alt="Love"></button>
        <button class="action-btn add-btn"><img src="assets/icons/add_to_queue.svg" alt="Add"></button>
        <button class="action-btn more-btn"><img src="assets/icons/more.svg" alt="More"></button>
      </div>
    `;
    
    const playOverlay = item.querySelector('.queue-play-overlay');
    if (playOverlay) {
      playOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isFromUserQueue) {
          playUserQueueTrack(userIndex);
        } else {
          loadTrack(track, currentQueue, index, true, false);
        }
      });
    }
    
    item.addEventListener('click', (e) => {
      if (e.shiftKey) {
        e.preventDefault();
      }
      
      const queueListContainer = document.querySelector('.queue-list');
      if (!queueListContainer) return;
      const allItems = Array.from(queueListContainer.querySelectorAll('.queue-item'));
      const itemIndex = allItems.indexOf(item);
      
      if (e.shiftKey && lastSelectedIndex !== -1) {
        const start = Math.min(lastSelectedIndex, itemIndex);
        const end = Math.max(lastSelectedIndex, itemIndex);
        
        allItems.forEach(i => i.classList.remove('active'));
        for (let i = start; i <= end; i++) {
          allItems[i].classList.add('active');
        }
      } else {
        allItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        lastSelectedIndex = itemIndex;
      }
    });

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (isFromUserQueue) {
        playUserQueueTrack(userIndex);
      } else {
        loadTrack(track, currentQueue, index, true, false);
      }
    });
    
    const loveBtn = item.querySelector('.love-btn');
    if (loveBtn) {
      loveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isLiked = loveBtn.classList.toggle('liked');
        const img = loveBtn.querySelector('img');
        if (isLiked) {
          img.src = 'assets/icons/love.svg';
          showToast("Added to Favorite Songs");
        } else {
          img.src = 'assets/icons/love_outline.svg';
        }
      });
    }

    const addBtn = item.querySelector('.add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addToQueue(track);
      });
    }
    
    return item;
  }

  function renderQueue() {
    const queueListContainer = document.querySelector('.queue-list');
    if (!queueListContainer) return;
    
    queueListContainer.innerHTML = '';
    
    const headerTitle = document.getElementById("queueHeaderTitle");
    
    if (userQueue.length > 0) {
      // Header shows "Next in queue"
      if (headerTitle) headerTitle.textContent = "Next in queue";
      
      // Render user queue items directly (no section label inside list)
      let userDisplayNum = 1;
      userQueue.forEach((track, index) => {
        const item = createQueueItemDOM(track, index, userDisplayNum, true, index);
        queueListContainer.appendChild(item);
        userDisplayNum++;
      });
      
      // Divider before original playlist
      const dividerHeader = document.createElement("div");
      dividerHeader.className = "queue-section-header";
      dividerHeader.textContent = `Next from : ${currentSourceName}`;
      queueListContainer.appendChild(dividerHeader);
    } else {
      // No user queue — header shows source name
      if (headerTitle) headerTitle.textContent = `Next from : ${currentSourceName}`;
    }
    
    // Render normal playlist queue
    let displayNum = 1;
    currentQueue.forEach((track, index) => {
      if (isRepeat) {
        if (index !== currentIndex) return;
      } else {
        if (index <= currentIndex) return;
      }
      
      const item = createQueueItemDOM(track, index, displayNum, false);
      queueListContainer.appendChild(item);
      displayNum++;
    });
  }

  function loadTrack(track, queue = [], index = -1, shouldPlay = true, isUserQueue = false) {
    if (!track) return;
    
    audio.src = (track.file.startsWith('http://') || track.file.startsWith('https://')) ? track.file : `assets/songs/${track.file}`;
    audio.load();
    
    isUserQueuePlaying = isUserQueue;
    
    if (!isUserQueue) {
      const isNewQueue = queue.length > 0 && queue !== currentQueue;
      
      if (queue.length > 0) {
        currentQueue = queue;
        currentIndex = index >= 0 ? index : queue.findIndex(t => t.file === track.file);
      } else {
        currentQueue = [track];
        currentIndex = 0;
      }

      if (isNewQueue) {
        originalQueue = [];
        
        if (isShuffle && currentQueue.length > 0) {
          originalQueue = [...currentQueue];
          const currentTrack = currentQueue[currentIndex];
          const otherTracks = currentQueue.filter((_, idx) => idx !== currentIndex);
          for (let i = otherTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
          }
          currentQueue = [currentTrack, ...otherTracks];
          currentIndex = 0;
        }
      }
      
      if (currentQueue[currentIndex]) {
        currentSourceName = currentQueue[currentIndex].album || "Local Library";
      }
    }

    setupTrackUI(track);
    renderQueue();

    if (shouldPlay) {
      isPlayingStarted = true;
      setRandomVideo();
      audio.play().catch(err => console.log("Audio autoplay failed:", err));
    } else {
      isPlayingStarted = false;
      updateProgressUI(0, 0, 0);
      if (compactTimeDuration) compactTimeDuration.textContent = "0:00";
      if (exTimeDuration) exTimeDuration.textContent = "0:00";
    }
  }

  function pauseMarquee(element, wrapperElement) {
    if (element && element._marqueeAnim) {
      element._marqueeAnim.pause();
      if (element._marqueeTimeout) {
        clearTimeout(element._marqueeTimeout);
        element._marqueeTimeout = null;
      }
      if (element._marqueeAnim.currentTime < 1000) {
        wrapperElement.classList.add('marquee-at-start');
      }
    }
  }

  function playMarquee(element, wrapperElement) {
    if (element && element._marqueeAnim) {
      element._marqueeAnim.play();
      const curr = element._marqueeAnim.currentTime || 0;
      const tPause = 1000;
      if (curr < tPause) {
        wrapperElement.classList.add('marquee-at-start');
        
        if (element._marqueeTimeout) {
          clearTimeout(element._marqueeTimeout);
        }
        
        element._marqueeTimeout = setTimeout(() => {
          element._marqueeTimeout = null;
          wrapperElement.classList.remove('marquee-at-start');
        }, tPause - curr);
      }
    }
  }

  function applyMarquee(element, wrapperElement) {
    if (!element || !wrapperElement) return;
    
    // Stop any existing animation and timeouts
    if (element._marqueeAnim) {
      element._marqueeAnim.cancel();
      element._marqueeAnim = null;
    }
    if (element._marqueeTimeout) {
      clearTimeout(element._marqueeTimeout);
      element._marqueeTimeout = null;
    }
    element.style.transform = 'translateX(0)';
    element.style.textOverflow = '';
    element.style.maxWidth = '';
    element.style.width = '';
    wrapperElement.classList.add('marquee-at-start');

    // Measure after browser layout update
    requestAnimationFrame(() => {
      const overflow = element.scrollWidth - wrapperElement.clientWidth;
      if (overflow > 2) {
        wrapperElement.classList.add('has-marquee');
        element.style.textOverflow = 'clip';
        element.style.maxWidth = 'none';
        element.style.width = 'max-content';

        const speed = 25; // 25 px/s
        const tScroll = overflow / speed;
        const tPause = 1.0;
        const tTotal = 2 * tScroll + 2 * tPause;
        
        const p1 = tPause / tTotal;
        const p2 = (tPause + tScroll) / tTotal;
        const p3 = (2 * tPause + tScroll) / tTotal;

        function runAnimLoop() {
          wrapperElement.classList.add('marquee-at-start');
          
          element._marqueeAnim = element.animate(
            [
              { transform: 'translateX(0)', offset: 0 },
              { transform: 'translateX(0)', offset: p1 },
              { transform: `translateX(-${overflow}px)`, offset: p2 },
              { transform: `translateX(-${overflow}px)`, offset: p3 },
              { transform: 'translateX(0)', offset: 1 }
            ],
            {
              duration: tTotal * 1000,
              iterations: 1,
              easing: 'linear'
            }
          );

          if (element._marqueeTimeout) {
            clearTimeout(element._marqueeTimeout);
          }

          element._marqueeTimeout = setTimeout(() => {
            element._marqueeTimeout = null;
            wrapperElement.classList.remove('marquee-at-start');
          }, tPause * 1000);

          element._marqueeAnim.onfinish = () => {
            runAnimLoop();
          };
        }

        runAnimLoop();
      } else {
        wrapperElement.classList.remove('has-marquee');
        wrapperElement.classList.add('marquee-at-start');
      }
    });
  }

  function recalculateAllMarquees() {
    const compactTitle = document.querySelector('.compact-view .track-title');
    const compactTitleWrapper = document.querySelector('.compact-view .track-title-wrapper');
    const compactArtist = document.querySelector('.compact-view .track-artist');
    const compactArtistWrapper = document.querySelector('.compact-view .track-artist-wrapper');

    const exTitle = document.querySelector('.large-track-info h3');
    const exTitleWrapper = document.querySelector('.large-title-wrapper');
    const exArtist = document.querySelector('.large-track-info p');
    const exArtistWrapper = document.querySelector('.large-artist-wrapper');

    applyMarquee(compactTitle, compactTitleWrapper);
    applyMarquee(compactArtist, compactArtistWrapper);
    applyMarquee(exTitle, exTitleWrapper);
    applyMarquee(exArtist, exArtistWrapper);
  }

  // Hover bindings to play/pause marquee scroll dynamically
  const compactTextContainer = document.querySelector('.compact-view .track-text');
  if (compactTextContainer) {
    compactTextContainer.addEventListener('mouseenter', () => {
      const title = compactTextContainer.querySelector('.track-title');
      const titleWrapper = compactTextContainer.querySelector('.track-title-wrapper');
      const artist = compactTextContainer.querySelector('.track-artist');
      const artistWrapper = compactTextContainer.querySelector('.track-artist-wrapper');
      pauseMarquee(title, titleWrapper);
      pauseMarquee(artist, artistWrapper);
    });
    compactTextContainer.addEventListener('mouseleave', () => {
      const title = compactTextContainer.querySelector('.track-title');
      const titleWrapper = compactTextContainer.querySelector('.track-title-wrapper');
      const artist = compactTextContainer.querySelector('.track-artist');
      const artistWrapper = compactTextContainer.querySelector('.track-artist-wrapper');
      playMarquee(title, titleWrapper);
      playMarquee(artist, artistWrapper);
    });
  }

  const exTextContainer = document.querySelector('.large-track-info');
  if (exTextContainer) {
    exTextContainer.addEventListener('mouseenter', () => {
      const title = exTextContainer.querySelector('h3');
      const titleWrapper = exTextContainer.querySelector('.large-title-wrapper');
      const artist = exTextContainer.querySelector('p');
      const artistWrapper = exTextContainer.querySelector('.large-artist-wrapper');
      pauseMarquee(title, titleWrapper);
      pauseMarquee(artist, artistWrapper);
    });
    exTextContainer.addEventListener('mouseleave', () => {
      const title = exTextContainer.querySelector('h3');
      const titleWrapper = exTextContainer.querySelector('.large-title-wrapper');
      const artist = exTextContainer.querySelector('p');
      const artistWrapper = exTextContainer.querySelector('.large-artist-wrapper');
      playMarquee(title, titleWrapper);
      playMarquee(artist, artistWrapper);
    });
  }

  function setupTrackUI(track) {
    if (!track) return;

    const compactTitle = document.querySelector('.compact-view .track-title');
    const compactArtist = document.querySelector('.compact-view .track-artist');
    const compactArt = document.querySelector('.compact-view .album-art');
    if (compactTitle) compactTitle.textContent = track.title;
    if (compactArtist) {
      compactArtist.textContent = track.artist;
    }
    if (compactArt) compactArt.src = track.cover;

    const exTitle = document.querySelector('.large-track-info h3');
    const exArtist = document.querySelector('.large-track-info p');
    const exArt = document.querySelector('.large-album-art');
    if (exTitle) exTitle.textContent = track.title;
    if (exArtist) {
      exArtist.textContent = track.artist;
    }
    if (exArt) exArt.src = track.cover;

    // Apply marquee checks after browser layout update
    setTimeout(recalculateAllMarquees, 50);

    if (isPlayingStarted) {
      const durStr = formatTime(track.duration || 0);
      if (compactTimeDuration) compactTimeDuration.textContent = durStr;
      if (exTimeDuration) exTimeDuration.textContent = durStr;
    } else {
      if (compactTimeDuration) compactTimeDuration.textContent = "0:00";
      if (exTimeDuration) exTimeDuration.textContent = "0:00";
    }
  }

  // --- SELECTION CLEARING ---
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const allItems = document.querySelectorAll('.queue-item');
      allItems.forEach(i => i.classList.remove('active'));
      lastSelectedIndex = -1;
    }
  });

  window.addEventListener('click', (e) => {
    const clickedQueueItem = e.target.closest('.queue-item');
    if (!clickedQueueItem) {
      const allItems = document.querySelectorAll('.queue-item');
      allItems.forEach(i => i.classList.remove('active'));
      lastSelectedIndex = -1;
    }
  });

  initResizableColumns();

  // --- ASYNC SONGS LOADING ---
  function loadPlayerSongs() {
    return fetch(`${CONFIG.apiBaseUrl}/songs`)
      .then(res => {
        if (!res.ok) throw new Error("Backend response not ok");
        return res.json();
      })
      .then(data => {
        console.log("Loaded songs from backend database successfully!");
        
        const currentTrack = currentQueue[currentIndex];
        
        // Sort songs by ID ascending so new uploads are appended at the end of the queue
        data.sort((a, b) => a.id - b.id);
        
        allTracks = data.map(song => ({
          file: song.audio_url || song.file,
          title: song.title,
          artist: song.artist,
          album: song.album || "Unknown Album",
          duration: song.duration,
          cover: song.cover_url || song.cover || "assets/vinyl/default_vinyl.png"
        }));

        if (allTracks.length > 0) {
          currentQueue = allTracks;
          if (currentTrack) {
            const newIndex = currentQueue.findIndex(t => t.file === currentTrack.file);
            if (newIndex !== -1) {
              currentIndex = newIndex;
            }
          } else {
            currentIndex = 0;
            loadTrack(allTracks[0], allTracks, 0, false);
          }
        }
        renderQueue();
      })
      .catch(backendErr => {
        console.warn("Could not connect to backend, falling back to local songs.json:", backendErr);
        return fetch('songs.json')
          .then(res => res.json())
          .then(data => {
            const currentTrack = currentQueue[currentIndex];
            allTracks = data.map(song => ({
              file: song.audio_url || song.file,
              title: song.title,
              artist: song.artist,
              album: song.album || "Unknown Album",
              duration: song.duration,
              cover: song.cover_url || song.cover || "assets/vinyl/default_vinyl.png"
            }));
            if (allTracks.length > 0) {
              currentQueue = allTracks;
              if (currentTrack) {
                const newIndex = currentQueue.findIndex(t => t.file === currentTrack.file);
                if (newIndex !== -1) currentIndex = newIndex;
              } else {
                currentIndex = 0;
                loadTrack(allTracks[0], allTracks, 0, false);
              }
            }
            renderQueue();
          });
      });
  }

  // Load initially
  loadPlayerSongs();

  // --- EXPOSE GLOBALLY ---
  window.Player = {
    audio: audio,
    showToast: (message) => {
      showToast(message);
    },
    addToQueue: (track) => {
      addToQueue(track);
    },
    addMultipleToQueue: (tracks) => {
      userQueue.push(...tracks);
      renderQueue();
    },
    loadPlayerSongs: () => {
      return loadPlayerSongs();
    },
    loadTrack: (titleOrTrack, artistOrQueue, coverOrIndex, filePath) => {
      if (typeof titleOrTrack === 'object') {
        loadTrack(titleOrTrack, artistOrQueue || [], typeof coverOrIndex === 'number' ? coverOrIndex : -1);
      } else {
        const matched = allTracks.find(t => t.title === titleOrTrack);
        if (matched) {
          loadTrack(matched, allTracks, allTracks.indexOf(matched));
        } else {
          const track = {
            title: titleOrTrack,
            artist: artistOrQueue || 'Unknown Artist',
            cover: coverOrIndex || 'assets/albums/blonde-frank ocean.jpg',
            file: filePath || `${titleOrTrack}_spotdown.org.mp3`
          };
          loadTrack(track);
        }
      }
    },
    setQueue: (queue, index) => {
      currentQueue = queue;
      currentIndex = index;
      renderQueue();
    }
  };
}
