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

  // --- NAVIGATE TO CURRENT TRACK ALBUM ON CLICKING ART OR ARTIST ---
  const navigateToCurrentTrackAlbum = (e) => {
    e.stopPropagation();
    const currentTrack = window.Player && typeof window.Player.getCurrentTrack === "function" ? window.Player.getCurrentTrack() : null;
    if (currentTrack && currentTrack.album) {
      if (typeof window.openAlbumByName === "function") {
        window.openAlbumByName(currentTrack.album);
      }
    }
  };

  const exArts = document.querySelectorAll('.large-album-art');
  const exTitle = document.querySelector('.large-track-info h3');
  const fsTitle = document.querySelector('.large-track-info-fullscreen h3');
  const compactArt = document.querySelector('.compact-view .album-art');
  const compactTitle = document.querySelector('.compact-view .track-title');

  exArts.forEach(art => art.addEventListener('click', navigateToCurrentTrackAlbum));
  if (exTitle) exTitle.addEventListener('click', navigateToCurrentTrackAlbum);
  if (fsTitle) fsTitle.addEventListener('click', navigateToCurrentTrackAlbum);
  if (compactArt) compactArt.addEventListener('click', navigateToCurrentTrackAlbum);
  if (compactTitle) compactTitle.addEventListener('click', navigateToCurrentTrackAlbum);


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
  let currentSongReportedRecent = false;

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
        div.style.height = targetHeights[index % targetHeights.length];
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

    const activeQueueIcons = document.querySelectorAll('.queue-item.playing .queue-play-overlay img');
    activeQueueIcons.forEach(img => {
      img.src = playing ? 'assets/icons/pause.svg' : 'assets/icons/play.svg';
      img.alt = playing ? 'Pause' : 'Play';
    });

    // const activeSearchIcons = document.querySelectorAll('#globalSearchResults .queue-item.playing .queue-play-overlay img');
    // activeSearchIcons.forEach(img => {
    //   img.src = playing ? 'assets/icons/pause.svg' : 'assets/icons/play.svg';
    //   img.alt = playing ? 'Pause' : 'Play';
    // });

    updateLoaderState(playing);

    if (vinylImg) {
      vinylImg.style.animationPlayState = playing ? 'running' : 'paused';
    }

    // Dispatch custom event to sync other modules (like the album details view)
    window.dispatchEvent(new CustomEvent('playerStateChanged'));
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

  const exProgressBars = document.querySelectorAll('.ex-progress-bar');
  const exProgressCurrents = document.querySelectorAll('.ex-progress-current');
  const exTimeCurrents = document.querySelectorAll('.ex-time-row .ex-time:first-child');
  const exTimeDurations = document.querySelectorAll('.ex-time-row .ex-time:last-child');

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
    exProgressCurrents.forEach(el => {
      el.style.width = `${percentage}%`;
      el.style.backgroundColor = percentage === 0 ? 'transparent' : 'var(--primary)';
    });

    const timeStr = formatTime(currentTime);
    if (compactTimeCurrent) compactTimeCurrent.textContent = timeStr;
    exTimeCurrents.forEach(el => el.textContent = timeStr);

    if (duration) {
      const durStr = formatTime(duration);
      if (compactTimeDuration) compactTimeDuration.textContent = durStr;
      exTimeDurations.forEach(el => el.textContent = durStr);
    }
  }

  audio.addEventListener('timeupdate', () => {
    if (isDragging) return;
    if (!isPlayingStarted) return;
    if (!audio.duration) return;
    const percentage = (audio.currentTime / audio.duration) * 100;
    updateProgressUI(percentage, audio.currentTime, audio.duration);

    // Recently played logic: minimal 30 seconds play
    if (!currentSongReportedRecent && audio.currentTime >= 30) {
      currentSongReportedRecent = true;
      const currentTrack = isUserQueuePlaying ? userQueue[currentIndex] : currentQueue[currentIndex];
      if (currentTrack && typeof window.addToRecentlyPlayed === 'function') {
        window.addToRecentlyPlayed(currentTrack.file);
      }
    }
  });

  audio.addEventListener('durationchange', () => {
    if (!isPlayingStarted) return;
    if (!audio.duration) return;
    const durStr = formatTime(audio.duration);
    if (compactTimeDuration) compactTimeDuration.textContent = durStr;
    exTimeDurations.forEach(el => el.textContent = durStr);
  });

  audio.addEventListener('loadedmetadata', () => {
    if (!isPlayingStarted) return;
    if (!audio.duration) return;
    const durStr = formatTime(audio.duration);
    if (compactTimeDuration) compactTimeDuration.textContent = durStr;
    exTimeDurations.forEach(el => el.textContent = durStr);
  });

  let activeDragContainer = null;

  function handleSeekStart(e, container) {
    // Only allow left-clicks (button 0) for mousedown events.
    if (e.type === 'mousedown' && e.button !== 0) {
      return;
    }
    isDragging = true;
    activeDragContainer = container;
    handleSeekMove(e, container);
  }

  function handleSeekMove(e, container) {
    if (!isDragging || !container) return;
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
    activeDragContainer = null;
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
  exProgressBars.forEach(bar => {
    bar.addEventListener('mousedown', (e) => handleSeekStart(e, bar));
    bar.addEventListener('touchstart', (e) => handleSeekStart(e, bar), { passive: true });
  });

  // Global mouse move & touch move for dragging outside seekbars
  window.addEventListener('mousemove', (e) => {
    if (isDragging && activeDragContainer) {
      handleSeekMove(e, activeDragContainer);
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && activeDragContainer) {
      handleSeekMove(e, activeDragContainer);
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

  exProgressBars.forEach(bar => {
    bar.addEventListener('mousemove', (e) => {
      const rect = bar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const HP = Math.max(0, Math.min(100, (x / rect.width) * 100));

      const duration = audio.duration || 249;
      const hoverSecs = Math.round((HP / 100) * duration);
      const hoverTimeStr = formatTime(hoverSecs);
      const tooltip = bar.querySelector('.ex-progress-tooltip');
      if (tooltip) {
        tooltip.textContent = hoverTimeStr;
        tooltip.style.left = `${x}px`;
      }

      const pCurrent = bar.querySelector('.ex-progress-current');
      const currentPercent = pCurrent ? parseFloat(pCurrent.style.width || '0') : 0;
      const preview = bar.querySelector('.ex-progress-hover-preview');
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

    bar.addEventListener('mouseleave', () => {
      const preview = bar.querySelector('.ex-progress-hover-preview');
      if (preview) preview.style.display = 'none';
    });
  });

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
    if (audio.currentTime > 2) {
      audio.currentTime = 0;
      if (audio.duration) {
        updateProgressUI(0, 0, audio.duration);
      }
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

  function addToQueue(trackOrTracks) {
    if (!trackOrTracks) return;
    if (Array.isArray(trackOrTracks)) {
      if (trackOrTracks.length === 0) return;
      userQueue.push(...trackOrTracks);
      if (trackOrTracks.length === 1) {
        showToast("Added to queue");
      } else {
        showToast(`${trackOrTracks.length} songs are added to queue`);
      }
    } else {
      userQueue.push(trackOrTracks);
      showToast("Added to queue");
    }
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
    
    const isPlayingThisTrack = (index === currentIndex && !isUserQueuePlaying && !isFromUserQueue) || 
                               (index === currentIndex && isUserQueuePlaying && isFromUserQueue);

    if (isPlayingThisTrack) {
      item.classList.add('playing');
    }
    
    const durationStr = formatTime(track.duration || 0);
    
    let isTrackLiked = false;
    if (typeof LIBRARY_DATA !== 'undefined') {
      const libItem = LIBRARY_DATA.find(i => i.type === "song" && i.rawSong && i.rawSong.file === track.file);
      if (libItem) {
        isTrackLiked = libItem.isFavorite;
      }
    }

    const currentIcon = (isPlayingThisTrack && isPlaying) ? 'assets/icons/pause.svg' : 'assets/icons/play.svg';
    const currentAlt = (isPlayingThisTrack && isPlaying) ? 'Pause' : 'Play';

    item.innerHTML = `
      <span class="queue-number">${displayNum}</span>
      <div class="queue-art-container">
        <img src="${track.cover}" alt="Art">
        <div class="queue-play-overlay">
          <img src="${currentIcon}" alt="${currentAlt}">
        </div>
      </div>
      <div class="queue-info">
        <h4>${track.title}</h4>
        <p>${track.artist}</p>
      </div>
      <span class="queue-album" ${track.album ? 'style="cursor: pointer;" title="Go to Album"' : ''}>${track.album || ''}</span>
      <span class="queue-time">${durationStr}</span>
      <div class="queue-actions">
        <button class="action-btn love-btn ${isTrackLiked ? 'liked' : ''}"><img src="assets/icons/${isTrackLiked ? 'love.svg' : 'love_outline.svg'}" alt="Love"></button>
        <button class="action-btn add-btn"><img src="assets/icons/add_to_queue.svg" alt="Add"></button>
        <button class="action-btn more-btn"><img src="assets/icons/more.svg" alt="More"></button>
      </div>
    `;
    
    const albumEl = item.querySelector('.queue-album');
    if (albumEl && track.album) {
      albumEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.openAlbumByName === "function") {
          window.openAlbumByName(track.album);
        }
      });
      // Add hover effect
      albumEl.addEventListener('mouseover', () => albumEl.style.textDecoration = 'underline');
      albumEl.addEventListener('mouseout', () => albumEl.style.textDecoration = 'none');
    }

    const playOverlay = item.querySelector('.queue-play-overlay');
    if (playOverlay) {
      playOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.classList.contains('playing')) {
          togglePlayPause();
        } else {
          if (isFromUserQueue) {
            playUserQueueTrack(userIndex);
          } else {
            loadTrack(track, currentQueue, index, true, false);
          }
        }
      });
    }
    
    item.addEventListener('click', (e) => {
      if (e.shiftKey) {
        e.preventDefault();
      }
      
      const queueListContainer = item.closest('.queue-list');
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
          showToast("Removed from Favorite Songs");
        }
        if (typeof window.toggleFavoriteSong === 'function') {
          window.toggleFavoriteSong(track.file, isLiked);
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

    // Stop dblclick propagation on action buttons to prevent playing the song on double click
    const actionBtns = item.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('dblclick', (e) => {
        e.stopPropagation();
      });
    });

    // --- HTML5 DRAG-TO-REORDER (all queue items) ---
    item.dataset.source = isFromUserQueue ? 'user' : 'current';
    item.dataset.sourceIndex = String(isFromUserQueue ? userIndex : index);
    item.draggable = true;

    item.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'queue-drag');

      const queueList = item.closest('.queue-list');
      // If this item is part of an active multi-selection, drag all active items
      let dragGroup;
      if (queueList && item.classList.contains('active')) {
        dragGroup = Array.from(queueList.querySelectorAll('.queue-item.active'));
      } else if (queueList) {
        // Single item drag — clear other active highlights
        queueList.querySelectorAll('.queue-item').forEach(el => el.classList.remove('active'));
        dragGroup = [item];
      } else {
        dragGroup = [item];
      }
      // Mark all as dragging (deferred so ghost image is captured first)
      setTimeout(() => dragGroup.forEach(el => el.classList.add('dragging')), 0);
    });

    item.addEventListener('dragend', () => {
      document.querySelectorAll('.queue-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
      });
    });

    item.addEventListener('dragover', (e) => {
      if (item.classList.contains('dragging')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      // Clear all indicators then set the right one
      document.querySelectorAll('.queue-item').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      item.classList.add(e.clientY < midY ? 'drag-over-top' : 'drag-over-bottom');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drag-over-top', 'drag-over-bottom');

      const queueList = item.closest('.queue-list');
      if (!queueList) return;
      const draggedEls = Array.from(queueList.querySelectorAll('.queue-item.dragging'));
      if (draggedEls.length === 0 || draggedEls.includes(item)) return;

      // Determine whether to insert before or after the target item
      const rect = item.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      // Remove dragged elements from DOM
      draggedEls.forEach(el => el.remove());

      // Insert at target position
      if (insertBefore) {
        draggedEls.forEach(el => queueList.insertBefore(el, item));
      } else {
        let anchor = item.nextSibling;
        draggedEls.forEach(el => {
          queueList.insertBefore(el, anchor);
          anchor = el.nextSibling;
        });
      }

      // Rebuild the underlying data arrays from the new DOM order
      rebuildQueuesFromDOM(queueList);
    });
    
    return item;
  }

  function renderQueue() {
    const queueListContainers = document.querySelectorAll('.queue-list');
    if (queueListContainers.length === 0) return;

    queueListContainers.forEach(queueListContainer => {
      queueListContainer.innerHTML = '';
      
      if (userQueue.length > 0) {
        let userDisplayNum = 1;
        userQueue.forEach((track, index) => {
          const item = createQueueItemDOM(track, index, userDisplayNum, true, index);
          queueListContainer.appendChild(item);
          userDisplayNum++;
        });
        
        const dividerHeader = document.createElement("div");
        dividerHeader.className = "queue-section-header";
        const prefix = isRepeat ? "Repeating track from" : "Next from";
        dividerHeader.innerHTML = `${prefix} : <span class="clickable-album-link">${currentSourceName || "Local Library"}</span>`;
        dividerHeader.setAttribute('draggable', 'false');
        dividerHeader.setAttribute('data-section-divider', 'true');
        queueListContainer.appendChild(dividerHeader);

        const albumLink = dividerHeader.querySelector(".clickable-album-link");
        if (albumLink) {
          albumLink.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof window.openAlbumByName === "function") {
              window.openAlbumByName(currentSourceName);
            }
          });
        }
      }

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
    });

    const headerTitles = document.querySelectorAll("#queueHeaderTitle, .queue-header-title");
    headerTitles.forEach(headerTitle => {
      if (userQueue.length > 0) {
        headerTitle.textContent = "Next in queue";
      } else {
        const prefix = isRepeat ? "Repeating track from" : "Next from";
        headerTitle.innerHTML = `${prefix} : <span class="clickable-album-link">${currentSourceName || "Local Library"}</span>`;
        const albumLink = headerTitle.querySelector(".clickable-album-link");
        if (albumLink) {
          albumLink.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof window.openAlbumByName === "function") {
              window.openAlbumByName(currentSourceName);
            }
          });
        }
      }
    });
  }

  // Called after DOM-based drag-drop reorder to sync both data arrays with the new visual order.
  function rebuildQueuesFromDOM(queueList) {
    const children = Array.from(queueList.children);
    const headerEl = queueList.querySelector('[data-section-divider="true"]');
    const headerIdx = headerEl ? children.indexOf(headerEl) : -1;

    const newUserQueue = [];
    const newCurrentUpcoming = [];

    children.forEach((el, i) => {
      if (!el.classList.contains('queue-item')) return;

      const source = el.dataset.source;
      const srcIdx = parseInt(el.dataset.sourceIndex, 10);

      let track;
      if (source === 'user') {
        track = userQueue[srcIdx];
      } else {
        track = currentQueue[srcIdx];
      }
      if (!track) return;

      // Items before the divider belong to userQueue; items after to currentQueue upcoming
      if (headerEl && i < headerIdx) {
        newUserQueue.push(track);
      } else {
        newCurrentUpcoming.push(track);
      }
    });

    // Update userQueue in-place
    userQueue.splice(0, userQueue.length, ...newUserQueue);

    // Update currentQueue: preserve [0..currentIndex] (played / now playing), then new upcoming order
    const playedAndCurrent = currentQueue.slice(0, currentIndex + 1);
    currentQueue.splice(0, currentQueue.length, ...playedAndCurrent, ...newCurrentUpcoming);

    renderQueue();
  }

  function loadTrack(track, queue = [], index = -1, shouldPlay = true, isUserQueue = false, sourceName = null) {
    if (!track) return;
    
    currentSongReportedRecent = false;
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
        currentSourceName = sourceName || currentQueue[currentIndex].album || "Local Library";
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
      exTimeDurations.forEach(el => el.textContent = "0:00");
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
      const clientWidth = wrapperElement.clientWidth;
      const overflow = element.scrollWidth - clientWidth;
      if (clientWidth > 0 && overflow > 2) {
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
    const exTitleWrapper = document.querySelector('.large-track-info .large-title-wrapper');
    const exArtist = document.querySelector('.large-track-info p');
    const exArtistWrapper = document.querySelector('.large-track-info .large-artist-wrapper');

    const fsTitle = document.querySelector('.large-track-info-fullscreen h3');
    const fsTitleWrapper = document.querySelector('.large-track-info-fullscreen .large-title-wrapper');
    const fsArtist = document.querySelector('.large-track-info-fullscreen p');
    const fsArtistWrapper = document.querySelector('.large-track-info-fullscreen .large-artist-wrapper');

    applyMarquee(compactTitle, compactTitleWrapper);
    applyMarquee(compactArtist, compactArtistWrapper);
    applyMarquee(exTitle, exTitleWrapper);
    applyMarquee(exArtist, exArtistWrapper);
    applyMarquee(fsTitle, fsTitleWrapper);
    applyMarquee(fsArtist, fsArtistWrapper);
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

  const fsTextContainer = document.querySelector('.large-track-info-fullscreen');
  if (fsTextContainer) {
    fsTextContainer.addEventListener('mouseenter', () => {
      const title = fsTextContainer.querySelector('h3');
      const titleWrapper = fsTextContainer.querySelector('.large-title-wrapper');
      const artist = fsTextContainer.querySelector('p');
      const artistWrapper = fsTextContainer.querySelector('.large-artist-wrapper');
      pauseMarquee(title, titleWrapper);
      pauseMarquee(artist, artistWrapper);
    });
    fsTextContainer.addEventListener('mouseleave', () => {
      const title = fsTextContainer.querySelector('h3');
      const titleWrapper = fsTextContainer.querySelector('.large-title-wrapper');
      const artist = fsTextContainer.querySelector('p');
      const artistWrapper = fsTextContainer.querySelector('.large-artist-wrapper');
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
    const fsTitle = document.querySelector('.large-track-info-fullscreen h3');
    const fsArtist = document.querySelector('.large-track-info-fullscreen p');
    const exArt = document.querySelector('.large-album-art');
    if (exTitle) exTitle.textContent = track.title;
    if (exArtist) {
      exArtist.textContent = track.artist;
    }
    if (fsTitle) fsTitle.textContent = track.title;
    if (fsArtist) {
      fsArtist.textContent = track.artist;
    }
    document.querySelectorAll('.large-album-art').forEach(el => el.src = track.cover);

    // Apply marquee checks after browser layout update
    setTimeout(recalculateAllMarquees, 50);

    if (isPlayingStarted) {
      const durStr = formatTime(track.duration || 0);
      if (compactTimeDuration) compactTimeDuration.textContent = durStr;
      exTimeDurations.forEach(el => el.textContent = durStr);
    } else {
      if (compactTimeDuration) compactTimeDuration.textContent = "0:00";
      exTimeDurations.forEach(el => el.textContent = "0:00");
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
        
        // Sort songs by ID descending so newly uploaded songs always appear first in the queue
        data.sort((a, b) => b.id - a.id);
        
        const fetchedTracks = data.map(song => ({
          file: song.audio_url || song.file,
          title: song.title,
          artist: song.artist,
          album: song.album || "Unknown Album",
          duration: song.duration,
          cover: song.cover_url || song.cover || "assets/vinyl/default_vinyl.png"
        }));

        allTracks = fetchedTracks;

        if (fetchedTracks.length > 0) {
          if (currentQueue.length === 0) {
            currentQueue = [...fetchedTracks];
            currentIndex = 0;
            loadTrack(currentQueue[0], currentQueue, 0, false);
          } else {
            // Find tracks in fetchedTracks that aren't in currentQueue
            const existingFiles = new Set(currentQueue.map(t => t.file));
            const newTracks = fetchedTracks.filter(t => !existingFiles.has(t.file));
            
            if (newTracks.length > 0) {
              // Insert new tracks immediately after currentIndex
              currentQueue.splice(currentIndex + 1, 0, ...newTracks);
            }
          }
        }
        renderQueue();
      })
      .catch(backendErr => {
        console.warn("Could not connect to backend, falling back to local songs.json:", backendErr);
        return fetch('songs.json')
          .then(res => res.json())
          .then(data => {
            const fetchedTracks = data.map(song => ({
              file: song.audio_url || song.file,
              title: song.title,
              artist: song.artist,
              album: song.album || "Unknown Album",
              duration: song.duration,
              cover: song.cover_url || song.cover || "assets/vinyl/default_vinyl.png"
            }));
            
            allTracks = fetchedTracks;

            if (allTracks.length > 0) {
              if (currentQueue.length === 0) {
                currentQueue = [...allTracks];
                currentIndex = 0;
                loadTrack(currentQueue[0], currentQueue, 0, false);
              } else {
                const existingFiles = new Set(currentQueue.map(t => t.file));
                const newTracks = allTracks.filter(t => !existingFiles.has(t.file));
                if (newTracks.length > 0) {
                  currentQueue.splice(currentIndex + 1, 0, ...newTracks);
                }
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
    loadTrack: (titleOrTrack, artistOrQueue, coverOrIndex, filePathOrSourceName, sourceName) => {
      if (typeof titleOrTrack === 'object') {
        loadTrack(titleOrTrack, artistOrQueue || [], typeof coverOrIndex === 'number' ? coverOrIndex : -1, true, false, filePathOrSourceName || sourceName);
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
    },
    getCurrentTrack: () => {
      if (currentIndex < 0) return null;
      return isUserQueuePlaying ? userQueue[currentIndex] : currentQueue[currentIndex];
    },
    getIsPlaying: () => {
      return isPlaying;
    },
    togglePlay: () => {
      togglePlayPause();
    },
    setShuffle: (enable) => {
      isShuffle = enable;
      shuffleButtons.forEach(b => b.classList.toggle('active', isShuffle));
    }
  };
}
