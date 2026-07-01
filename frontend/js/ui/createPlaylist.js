import { CONFIG } from '../utils/config.js';

const PLAYLIST_ART_COUNT = 501;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomArtUrl() {
  return `assets/playlist_art/playlist_art_${randInt(1, PLAYLIST_ART_COUNT)}.png`;
}

async function generateRandomPlaylistName() {
  try {
    const res = await fetch('../scripts/playlist-words.json');
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    const prefix = data.prefixes[randInt(0, data.prefixes.length - 1)];
    const suffix = data.suffixes[randInt(0, data.suffixes.length - 1)];
    return `${prefix} ${suffix}`;
  } catch {
    const fallbackPrefixes = ['Velvet', 'Neon', 'Amber', 'Crimson', 'Lunar', 'Arctic', 'Midnight', 'Cosmic', 'Ivory', 'Jade'];
    const fallbackSuffixes = ['Citadel', 'Cliffside', 'Dawnfall', 'Everglow', 'Glacier', 'Halcyon', 'Lakeside', 'Lullaby', 'Oasis', 'Pioneer'];
    return `${fallbackPrefixes[randInt(0, fallbackPrefixes.length - 1)]} ${fallbackSuffixes[randInt(0, fallbackSuffixes.length - 1)]}`;
  }
}

export function initCreatePlaylist() {
  const overlay              = document.getElementById('createPlaylistOverlay');
  const createBtn            = document.querySelector('.nav-btn.btn-5');
  const doneBtn              = document.getElementById('cpDoneBtn');
  const closeBtn             = document.getElementById('cpCloseBtn');
  const artImg               = document.getElementById('cpArtImg');
  const artWrapper           = document.getElementById('cpArtWrapper');
  const nameEl               = document.getElementById('cpPlaylistName');
  const searchInput          = document.getElementById('cpSearchInput');
  const searchResultsWrapper = document.getElementById('cpSearchResultsWrapper');
  const searchResults        = document.getElementById('cpSearchResults');
  const trackList            = document.getElementById('cpTrackList');
  const clearBtn             = document.getElementById('cpSearchClearBtn');
  const confirmOverlay       = document.getElementById('cpConfirmOverlay');

  // Edit playlist name elements
  const nameContainer        = document.getElementById('cpPlaylistNameContainer');
  const nameMoreBtn          = document.getElementById('cpNameMoreBtn');
  const nameEditPopup        = document.getElementById('cpNameEditPopup');
  const nameInput            = document.getElementById('cpNameInput');
  const nameCancelBtn        = document.getElementById('cpNameCancelBtn');
  const nameSaveBtn          = document.getElementById('cpNameSaveBtn');

  if (!overlay || !createBtn) return;

  let playlistTracks      = [];
  let allSongs            = [];
  let searchTimeout       = null;

  // Track initial generation variables to detect edits
  let initialPlaylistName = '';
  let initialArtUrl       = '';

  // Helper: adjust font size dynamically based on name length
  function updatePlaylistName(name) {
    nameEl.textContent = name;
    if (name.length > 60) {
      nameEl.style.fontSize = '18px';
    } else if (name.length > 30) {
      nameEl.style.fontSize = '21px';
    } else {
      nameEl.style.fontSize = '24px';
    }
  }

  // Helper: check if playlist has been modified by the user
  function isPlaylistEdited() {
    const currentName = nameEl.textContent.trim();
    const currentArt  = artImg.src;
    const tracksAdded = playlistTracks.length > 0;

    const nameChanged = currentName !== initialPlaylistName;
    const artChanged  = currentArt.startsWith('blob:') || !currentArt.endsWith(initialArtUrl);

    return tracksAdded || nameChanged || artChanged;
  }

  // ── Fetch songs for search ──────────────────────────────────────────────────
  async function fetchSongs() {
    try {
      const res = await fetch(`${CONFIG.apiBaseUrl}/songs`);
      if (!res.ok) throw new Error('Backend not available');
      const data = await res.json();
      allSongs = data.map(s => ({
        file:     s.audio_url || s.file,
        title:    s.title,
        artist:   s.artist,
        album:    s.album || 'Unknown Album',
        duration: s.duration,
        cover:    s.cover_url || s.cover || 'assets/vinyl/default_vinyl.png',
      }));
    } catch {
      try {
        const res = await fetch('songs.json');
        const data = await res.json();
        allSongs = data.map(s => ({
          file:     s.audio_url || s.file,
          title:    s.title,
          artist:   s.artist,
          album:    s.album || 'Unknown Album',
          duration: s.duration,
          cover:    s.cover_url || s.cover || 'assets/vinyl/default_vinyl.png',
        }));
      } catch { /* leave allSongs empty */ }
    }
  }

  // ── Open / Close ────────────────────────────────────────────────────────────
  async function openModal() {
    // Dismiss other overlapping views
    document.getElementById('libraryView')?.classList.remove('show', 'blurred-library');
    document.querySelector('.nav-btn.btn-2')?.classList.remove('active');
    document.getElementById('globalSearchOverlay')?.classList.remove('show');
    document.querySelector('.nav-btn.btn-4')?.classList.remove('active');
    document.getElementById('vinylContainer')?.classList.remove('active');
    document.getElementById('bgVideo')?.classList.remove('blurred');
    // Close fullscreen if active
    document.getElementById('exitFsBtn')?.click();

    // Reset state
    playlistTracks = [];
    renderTrackList();
    searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    hideResults();

    // Random art & name
    initialArtUrl       = randomArtUrl();
    artImg.src          = initialArtUrl;
    
    initialPlaylistName = await generateRandomPlaylistName();
    updatePlaylistName(initialPlaylistName);

    // Close name edit popup if open
    hideNameEditPopup();

    // Lazy-load songs
    if (allSongs.length === 0) fetchSongs();

    overlay.classList.add('show');
    createBtn.classList.add('active');
    document.addEventListener('keydown', onEscape);
  }

  function closeModal() {
    overlay.classList.remove('show');
    createBtn.classList.remove('active');
    document.removeEventListener('keydown', onEscape);
    if (clearBtn) clearBtn.style.display = 'none';
    hideResults();
    hideNameEditPopup();
  }

  function requestCloseModal(onConfirmQuit) {
    if (isPlaylistEdited()) {
      if (confirmOverlay) {
        confirmOverlay.style.display = 'flex';

        const quitBtn = document.getElementById('cpConfirmQuitBtn');
        const cancelBtn = document.getElementById('cpConfirmCancelBtn');

        const onQuitClick = () => {
          confirmOverlay.style.display = 'none';
          closeModal();
          cleanup();
          if (typeof onConfirmQuit === 'function') {
            onConfirmQuit();
          }
        };

        const onCancelClick = () => {
          confirmOverlay.style.display = 'none';
          cleanup();
        };

        function cleanup() {
          quitBtn.removeEventListener('click', onQuitClick);
          cancelBtn.removeEventListener('click', onCancelClick);
        }

        quitBtn.addEventListener('click', onQuitClick);
        cancelBtn.addEventListener('click', onCancelClick);
      } else {
        closeModal();
        if (typeof onConfirmQuit === 'function') onConfirmQuit();
      }
    } else {
      closeModal();
      if (typeof onConfirmQuit === 'function') onConfirmQuit();
    }
  }

  function onEscape(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      // If name edit popup is open, close it first
      if (nameEditPopup && nameEditPopup.style.display === 'flex') {
        hideNameEditPopup();
        return;
      }
      
      if (searchInput.value.length > 0) {
        e.stopPropagation();
        searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        hideResults();
        searchInput.focus();
      } else {
        requestCloseModal();
      }
    }
  }

  // Intercept nav buttons click (Capture phase)
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    if (btn.classList.contains('btn-5')) return; // skip own trigger btn
    btn.addEventListener('click', (e) => {
      if (overlay.classList.contains('show')) {
        // Prevent immediate navigation
        e.preventDefault();
        e.stopPropagation();

        // Ask for confirm if edited
        requestCloseModal(() => {
          // If confirmed, re-trigger click natively
          btn.click();
        });
      }
    }, true); // true = capture phase!
  });

  createBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!overlay.classList.contains('show')) {
      openModal();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      requestCloseModal();
    });
  }

  function savePlaylist() {
    const playlistName = nameEl.textContent.trim();
    const artUrl = artImg.src;
    
    if (!playlistName) {
      if (window.Player && typeof window.Player.showToast === 'function') {
        window.Player.showToast("Playlist name cannot be empty");
      }
      return;
    }
    
    if (!window.userPlaylists) window.userPlaylists = [];
    
    const newPlaylist = {
      id: `playlist-${Date.now()}`,
      title: playlistName,
      artist: "Me",
      type: "playlist",
      subtitle: `Playlist | ${playlistTracks.length} song${playlistTracks.length === 1 ? '' : 's'}`,
      cover: artUrl,
      playlistSongs: [...playlistTracks]
    };
    
    window.userPlaylists.push(newPlaylist);
    localStorage.setItem("gramola_user_playlists", JSON.stringify(window.userPlaylists));
    
    if (window.Player && typeof window.Player.showToast === 'function') {
      window.Player.showToast(`Playlist "${playlistName}" created!`);
    }
    
    if (typeof window.updateLibrary === "function") {
      window.updateLibrary();
    }
  }

  doneBtn.addEventListener('click', () => {
    savePlaylist();
    closeModal();
  });

  // ── Edit Playlist Name Dialog ────────────────────────────────────────────────
  function showNameEditPopup(e) {
    e.stopPropagation();
    if (!nameEditPopup) return;
    nameInput.value = nameEl.textContent.trim();
    nameInput.classList.remove('invalid'); // clear invalid state initially
    nameEditPopup.style.display = 'flex';
    nameInput.focus();
    nameInput.select();

    if (nameContainer) nameContainer.classList.add('edit-active');

    // Blur playlist name and username (art is NOT blurred)
    nameEl.classList.add('blurred');
    const cpUsername = document.getElementById('cpUsername');
    if (cpUsername) cpUsername.classList.add('blurred');
  }

  function hideNameEditPopup() {
    if (nameEditPopup) nameEditPopup.style.display = 'none';
    if (nameContainer) nameContainer.classList.remove('edit-active');
    nameEl.classList.remove('blurred');
    const cpUsername = document.getElementById('cpUsername');
    if (cpUsername) cpUsername.classList.remove('blurred');
  }

  function savePlaylistName() {
    const val = nameInput.value.trim();
    if (!val) {
      nameInput.classList.add('invalid');
      
      // Trigger error shake animation
      nameEditPopup.classList.remove('shake');
      void nameEditPopup.offsetWidth; // trigger reflow
      nameEditPopup.classList.add('shake');
      nameEditPopup.addEventListener('animationend', () => {
        nameEditPopup.classList.remove('shake');
      }, { once: true });

      if (window.Player && typeof window.Player.showToast === 'function') {
        window.Player.showToast("Playlist name cannot be empty");
      }
      return;
    }
    
    if (val.length > 100) {
      if (window.Player && typeof window.Player.showToast === 'function') {
        window.Player.showToast("Playlist name cannot exceed 100 characters");
      }
      return;
    }

    updatePlaylistName(val);
    if (window.Player && typeof window.Player.showToast === 'function') {
      window.Player.showToast("Playlist name has been changed");
    }
    hideNameEditPopup();
  }

  if (nameEl) {
    nameEl.addEventListener('click', showNameEditPopup);
  }
  
  // Deactivate moreBtn function (leave it with no-op)
  if (nameMoreBtn) {
    nameMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (nameCancelBtn) {
    nameCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideNameEditPopup();
    });
  }

  if (nameSaveBtn) {
    nameSaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      savePlaylistName();
    });
  }

  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hideNameEditPopup();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        savePlaylistName();
      }
    });

    nameInput.addEventListener('input', () => {
      nameInput.classList.remove('invalid'); // clear red border on typing
    });
  }

  // Prevent clicks inside the edit name popup from propagating
  if (nameEditPopup) {
    nameEditPopup.addEventListener('click', (e) => e.stopPropagation());
  }

  // ── Change photo on art click (Custom Upload) ─────────────────────────────────
  const artInput = document.getElementById('cpPlaylistArtInput');
  if (artInput) {
    artInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (artImg.src && artImg.src.startsWith('blob:')) {
          URL.revokeObjectURL(artImg.src);
        }
        artImg.src = URL.createObjectURL(file);
      }
    });
  }

  artWrapper.addEventListener('click', (e) => {
    if (e.target.closest('.cp-art-more-btn')) return;
    if (artInput) {
      artInput.click();
    }
  });

  // ── Search ───────────────────────────────────────────────────────────────────
  function formatDuration(dur) {
    if (!dur) return '';
    if (typeof dur === 'string' && dur.includes(':')) return dur;
    const secs = Math.round(Number(dur));
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // Close dropdown when clicking outside the search wrapper
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.cp-search-wrapper')) hideResults();
  });

  // Prevent clicks inside the modal from bubbling to the overlay
  overlay.querySelector('.create-playlist-modal')
    .addEventListener('click', e => e.stopPropagation());

  // ── Track List ───────────────────────────────────────────────────────────────
  function addTrack(track) {
    playlistTracks.push(track);
    renderTrackList();
  }

  function renderTrackList() {
    trackList.innerHTML = '';
    if (playlistTracks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cp-empty-state';
      empty.textContent = 'No songs added yet. Search to add songs.';
      trackList.appendChild(empty);
      return;
    }
    playlistTracks.forEach((track, idx) => {
      const item = document.createElement('div');
      item.className = 'cp-track-item';

      // HTML5 Drag & Drop reordering (with visual indicators matching the queue list)
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx);
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend', () => {
        trackList.querySelectorAll('.cp-track-item').forEach(el => {
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
        trackList.querySelectorAll('.cp-track-item').forEach(el => {
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
        const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIdx) || sourceIdx === idx) return;

        const rect = item.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        const targetIdx = idx;
        const draggedItem = playlistTracks.splice(sourceIdx, 1)[0];
        let insertIdx = targetIdx;
        if (!insertBefore) {
          insertIdx = targetIdx + (sourceIdx < targetIdx ? 0 : 1);
        } else {
          insertIdx = targetIdx - (sourceIdx < targetIdx ? 1 : 0);
        }
        playlistTracks.splice(insertIdx, 0, draggedItem);
        renderTrackList();
      });
      item.innerHTML = `
        <span class="cp-track-num">${idx + 1}</span>
        <img class="cp-track-art" src="${track.cover}" alt="Art">
        <div class="cp-track-details">
          <span class="cp-track-title">${track.title}</span>
          <span class="cp-track-meta">${track.artist} | ${track.album}</span>
        </div>
        <span class="cp-track-time">${formatDuration(track.duration)}</span>
        <div class="cp-track-actions">
          <button class="cp-track-more-btn" title="More options">
            <img src="assets/icons/more.svg" alt="More">
          </button>
          <button class="cp-track-delete-btn" title="Delete song">
            <img src="assets/icons/minus.svg" alt="Delete">
          </button>
        </div>
      `;

      const delBtn = item.querySelector('.cp-track-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          playlistTracks.splice(idx, 1);
          renderTrackList();
          // Toast for deletion
          const playlistName = nameEl.textContent.trim() || 'Playlist';
          if (window.Player && typeof window.Player.showToast === 'function') {
            window.Player.showToast(`"${track.title}" has been removed from "${playlistName}"`);
          }
        });
      }

      const moreBtn = item.querySelector('.cp-track-more-btn');
      if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      trackList.appendChild(item);
    });
  }

  // Rest of showResults / hideResults logic
  function showResults(tracks) {
    searchResults.innerHTML = '';
    if (tracks.length === 0) {
      searchResults.innerHTML = '<div style="padding:12px 16px;color:rgba(255,255,255,0.4);font-size:13px;">No results found</div>';
    } else {
      tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'cp-search-result-item';
        item.innerHTML = `
          <div class="cp-search-result-art-container">
            <img class="cp-search-result-art" src="${track.cover}" alt="Art">
            <div class="cp-search-result-play-overlay">
              <img src="assets/icons/play.svg" alt="Play">
            </div>
          </div>
          <div class="cp-search-result-info">
            <strong>${track.title}</strong>
            <span>${track.artist} | ${track.album}</span>
          </div>
          <span class="cp-search-result-time">${formatDuration(track.duration)}</span>
          <div class="cp-search-result-actions">
            <button class="cp-item-more-btn" title="More options">
              <img src="assets/icons/more.svg" alt="More">
            </button>
            <button class="cp-add-track-btn" title="Add to playlist">
              <img src="assets/icons/add.svg" alt="Add">
            </button>
          </div>
        `;

        item.addEventListener('click', () => {
          const selected = searchResults.querySelector('.cp-search-result-item.selected');
          if (selected) selected.classList.remove('selected');
          item.classList.add('selected');
        });

        item.addEventListener('dblclick', () => {
          if (window.Player && typeof window.Player.loadTrack === 'function') {
            window.Player.loadTrack(track, [track], 0);
          }
        });

        const playOverlay = item.querySelector('.cp-search-result-play-overlay');
        if (playOverlay) {
          playOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.Player && typeof window.Player.loadTrack === 'function') {
              window.Player.loadTrack(track, [track], 0);
            }
          });
        }

        const addBtn = item.querySelector('.cp-add-track-btn');
        if (addBtn) {
          addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addTrack(track);
            const playlistName = nameEl.textContent.trim() || 'Playlist';
            if (window.Player && typeof window.Player.showToast === 'function') {
              window.Player.showToast(`"${track.title}" has been added to "${playlistName}"`);
            }
          });
        }

        const moreBtn = item.querySelector('.cp-item-more-btn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        }

        searchResults.appendChild(item);
      });
    }
    searchResultsWrapper.classList.add('visible');
    const tracklistSection = overlay.querySelector('.cp-tracklist-section');
    if (tracklistSection) tracklistSection.classList.add('blurred');
  }

  function hideResults() {
    searchResultsWrapper.classList.remove('visible');
    searchResults.innerHTML = '';
    const tracklistSection = overlay.querySelector('.cp-tracklist-section');
    if (tracklistSection) tracklistSection.classList.remove('blurred');
  }

  function doSearch(query) {
    if (!query.trim()) { hideResults(); return; }
    const q = query.toLowerCase();
    const hits = allSongs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q)
    ).slice(0, 10);
    showResults(hits);
  }

  searchInput.addEventListener('input', () => {
    if (searchInput.value.length > 0) {
      if (clearBtn) clearBtn.style.display = 'flex';
    } else {
      if (clearBtn) clearBtn.style.display = 'none';
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => doSearch(searchInput.value), 180);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      hideResults();
      searchInput.focus();
    });
  }

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) doSearch(searchInput.value);
  });

  // Global helper exports for modal interception
  window.isPlaylistModalOpen = () => overlay && overlay.classList.contains('show');
  window.requestClosePlaylistModal = (onConfirmQuit) => {
    requestCloseModal(onConfirmQuit);
  };
}
