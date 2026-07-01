import { CONFIG } from '../utils/config.js';

let LIBRARY_DATA = [];
let songsDb = [];
let activeTab = "all";
let searchQuery = "";
let sortMode = "recent"; // "recent" | "az"
let activeAlbum = null;
let wasLibraryOpenBeforeAlbum = false;
let albumSearchQuery = "";
let albumSortMode = "trackno"; // "trackno" | "az"

if (!window.userPlaylists) {
  try {
    window.userPlaylists = JSON.parse(localStorage.getItem("gramola_user_playlists")) || [];
  } catch {
    window.userPlaylists = [];
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomArtUrl() {
  return `assets/playlist_art/playlist_art_${randInt(1, 501)}.png`;
}

function buildLibraryData() {
  LIBRARY_DATA = [];
  
  // (Playlists removed by request)

  // 2. Add albums
  const albumsMap = new Map();
  songsDb.forEach(song => {
    if (song.album && song.album !== "Unknown Album") {
      if (!albumsMap.has(song.album)) {
        albumsMap.set(song.album, []);
      }
      albumsMap.get(song.album).push(song);
    }
  });

  let albumIdx = 0;
  albumsMap.forEach((albumSongs, albumName) => {
    const albumArtist = albumSongs[0].artist;
    const albumCover = albumSongs[0].cover;
    LIBRARY_DATA.push({
      id: `album-${albumIdx++}`,
      title: albumName,
      artist: albumArtist,
      type: "album",
      subtitle: `Album | ${albumArtist}`,
      cover: albumCover,
      isFavorite: false,
      isRecent: false,
      inLibrary: false,
      albumSongs: albumSongs
    });
  });

  // 3. Add individual songs
  songsDb.forEach((song, idx) => {
    LIBRARY_DATA.push({
      id: `song-${idx}`,
      title: song.title,
      artist: song.artist,
      type: "song",
      subtitle: song.artist,
      cover: song.cover,
      isFavorite: false,
      isRecent: false,
      rawSong: song
    });
  });
}

function isItemPlaying(item) {
  const currentTrack = window.Player && typeof window.Player.getCurrentTrack === "function" ? window.Player.getCurrentTrack() : null;
  const isPlayerPlaying = window.Player && typeof window.Player.getIsPlaying === "function" ? window.Player.getIsPlaying() : false;
  if (!currentTrack || !isPlayerPlaying) return false;

  if (item.type === "song" && item.rawSong) {
    return currentTrack.file === item.rawSong.file;
  }
  
  const songs = item.albumSongs || item.playlistSongs || [];
  return songs.some(s => s.file === currentTrack.file);
}

function renderGrid(items) {
  const grid = document.getElementById("libraryGrid");
  if (!grid) return;
  grid.innerHTML = "";

  items.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "lib-item";
    
    const isPlaying = isItemPlaying(item);
    const playIconSrc = isPlaying ? "assets/icons/pause.svg" : "assets/icons/play.svg";
    
    itemEl.innerHTML = `
      <div class="lib-art-container">
        <img src="${item.cover}" alt="${item.title}" loading="lazy">
        <div class="lib-play-overlay">
          <img src="${playIconSrc}" alt="${isPlaying ? 'Pause' : 'Play'}">
        </div>
      </div>
      <h4 class="lib-title" title="${item.title}">${item.title}</h4>
      <p class="lib-subtitle" title="${item.subtitle}">${item.subtitle}</p>
    `;

    // Click on play button overlay plays directly
    const playOverlay = itemEl.querySelector(".lib-play-overlay");
    if (playOverlay) {
      playOverlay.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentlyPlaying = isItemPlaying(item);
        if (currentlyPlaying) {
          if (window.Player && typeof window.Player.togglePlay === "function") {
            window.Player.togglePlay();
          }
        } else {
          if (window.Player && typeof window.Player.loadTrack === "function") {
            if (item.type === "song") {
              window.Player.loadTrack(item.rawSong, [item.rawSong], 0, item.title);
            } else {
              const songs = item.albumSongs || item.playlistSongs || [];
              if (songs.length > 0) {
                window.Player.loadTrack(songs[0], songs, 0, item.title);
              }
            }
          }
        }
      });
    }

    // Click on cover art container navigates (if album/playlist) or plays (if song)
    const artContainer = itemEl.querySelector(".lib-art-container");
    if (artContainer) {
      artContainer.addEventListener("click", (e) => {
        if (item.type === "album" || item.type === "playlist") {
          e.stopPropagation();
          wasLibraryOpenBeforeAlbum = true;
          openAlbumDetail(item);
        } else if (item.type === "song") {
          if (window.Player && typeof window.Player.loadTrack === "function") {
            window.Player.loadTrack(item.rawSong, [item.rawSong], 0);
          }
        }
      });
    }

    // Titles click navigates (if album/playlist) or plays (if song)
    itemEl.addEventListener("click", (e) => {
      if (e.target.closest(".lib-art-container")) return;
      if (item.type === "album" || item.type === "playlist") {
        wasLibraryOpenBeforeAlbum = true;
        openAlbumDetail(item);
      } else if (item.type === "song") {
        if (window.Player && typeof window.Player.loadTrack === "function") {
          window.Player.loadTrack(item.rawSong, [item.rawSong], 0);
        }
      }
    });

    grid.appendChild(itemEl);
  });
}

// --- ALBUM DETAIL VIEW LOGIC ---
function openAlbumDetail(album) {
  activeAlbum = album;

  const libraryHeader = document.getElementById("libraryHeader");
  const albumHeader = document.getElementById("albumHeader");
  const libraryGrid = document.getElementById("libraryGrid");
  const albumDetailView = document.getElementById("albumDetailView");

  if (libraryHeader) libraryHeader.style.display = "none";
  if (libraryGrid) libraryGrid.style.display = "none";
  if (albumHeader) albumHeader.style.display = "flex";
  if (albumDetailView) albumDetailView.style.display = ""; // Let CSS display flex take effect

  renderAlbumDetailContent(album);

  // Recalculate columns to fit
  requestAnimationFrame(() => {
    adjustAlbumColumnsToFit();
  });
}

function closeAlbumDetail() {
  activeAlbum = null;
  albumSearchQuery = "";
  albumSortMode = "trackno";

  const searchWrapper = document.getElementById("albumSearchWrapper");
  if (searchWrapper) {
    searchWrapper.classList.remove("active");
  }
  const searchInput = document.getElementById("albumSearchInput");
  if (searchInput) {
    searchInput.value = "";
  }
  const clearBtn = document.getElementById("albumClearBtn");
  if (clearBtn) {
    clearBtn.style.display = "none";
  }
  const sortBtn = document.getElementById("albumSortBtn");
  if (sortBtn) {
    const sortText = sortBtn.querySelector("span");
    if (sortText) sortText.textContent = "Track No";
  }

  const libraryHeader = document.getElementById("libraryHeader");
  const albumHeader = document.getElementById("albumHeader");
  const libraryGrid = document.getElementById("libraryGrid");
  const albumDetailView = document.getElementById("albumDetailView");

  // Back navigation: if library wasn't open before entering, close library overlay entirely
  if (!wasLibraryOpenBeforeAlbum) {
    const libraryView = document.getElementById("libraryView");
    if (libraryView) {
      libraryView.classList.remove("show");
    }
    const libraryBtn = document.querySelector(".nav-btn.btn-2");
    if (libraryBtn) {
      libraryBtn.classList.remove("active");
    }

    // Hide album views immediately but defer library grid restore to avoid flashing it to the user
    if (albumHeader) albumHeader.style.display = "none";
    if (albumDetailView) albumDetailView.style.display = "none";

    setTimeout(() => {
      if (libraryHeader) libraryHeader.style.display = "flex";
      if (libraryGrid) libraryGrid.style.display = "grid";
    }, 300);
  } else {
    // Normal immediate restore inside library
    if (libraryHeader) libraryHeader.style.display = "flex";
    if (libraryGrid) libraryGrid.style.display = "grid";
    if (albumHeader) albumHeader.style.display = "none";
    if (albumDetailView) albumDetailView.style.display = "none";
  }
}

function formatTotalDuration(songs) {
  const totalSecs = songs.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = Math.floor(totalSecs % 60);
  
  if (hrs > 0) {
    if (mins > 0) {
      return `${hrs} hr ${mins} min`;
    }
    return `${hrs} hr`;
  }
  return `${mins} min ${secs} sec`;
}

function adjustPlaylistNameFontSize(nameEl, name) {
  if (!nameEl) return;
  if (name.length > 60) {
    nameEl.style.fontSize = '18px';
  } else if (name.length > 30) {
    nameEl.style.fontSize = '21px';
  } else {
    nameEl.style.fontSize = '24px';
  }
}

function renderAlbumDetailContent(album) {
  const albumDetailView = document.getElementById("albumDetailView");
  if (!albumDetailView) return;

  const songs = album.albumSongs || album.playlistSongs || [];
  const totalDurationText = formatTotalDuration(songs);
  const songCount = songs.length;
  const year = album.title.toLowerCase() === "blonde" ? "2016" : "2024";

  // Check if album is playing
  const currentTrack = window.Player && typeof window.Player.getCurrentTrack === "function" ? window.Player.getCurrentTrack() : null;
  const isPlayingCurrentAlbum = currentTrack && songs.some(s => s.file === currentTrack.file);
  const isPlayerPlaying = window.Player && typeof window.Player.getIsPlaying === "function" ? window.Player.getIsPlaying() : false;
  const isPlaying = isPlayingCurrentAlbum && isPlayerPlaying;

  const isPlaylist = album.type === "playlist";
  const yearText = isPlaylist ? "" : `${year} | `;
  const artistText = isPlaylist ? "Gramola" : album.artist;

  const playBtnIcon = isPlaying ? "assets/icons/pause.svg" : "assets/icons/play.svg";
  const playBtnClass = isPlaying ? "" : "play-icon-svg";

  // Check if saved to library
  const isSaved = album.inLibrary !== false;

  let leftPanelHTML = "";
  if (isPlaylist) {
    // Editable left panel structure for playlists
    leftPanelHTML = `
      <div class="cp-left">
        <div class="cp-art-wrapper" id="adArtWrapper">
          <img src="${album.cover}" alt="${album.title}" class="cp-art-img" id="adArtImg" onclick="if(window.openFullscreenArt) window.openFullscreenArt('${album.cover}')">
          <div class="cp-art-overlay">
            <img src="assets/icons/photo_art.svg" alt="Choose Photo" class="cp-photo-icon">
            <span>Choose photo</span>
          </div>
          <button class="cp-art-more-btn" id="adArtMoreBtn" title="More options">
            <img src="assets/icons/more.svg" alt="More">
          </button>
          <input type="file" id="adPlaylistArtInput" accept="image/*" style="display: none;">
        </div>
        
        <div class="cp-playlist-name-container" id="adPlaylistNameContainer">
          <h3 class="ad-title" id="adPlaylistName" style="margin: 0; cursor: pointer;">${album.title}</h3>
          <button class="cp-name-more-btn" id="adNameMoreBtn" title="Edit name">
            <img src="assets/icons/more.svg" alt="Edit">
          </button>
          <div id="adNameEditPopup" class="cp-name-edit-popup" style="display: none;">
            <input type="text" id="adNameInput" class="cp-name-input" placeholder="Enter playlist name" maxlength="100">
            <div class="cp-name-edit-actions">
              <button class="cp-name-btn cancel" id="adNameCancelBtn">Cancel</button>
              <button class="cp-name-btn save" id="adNameSaveBtn">Save</button>
            </div>
          </div>
        </div>
        
        <p class="ad-artist">${artistText}</p>
        <p class="ad-details" id="adDetailsText" style="margin-top: 4px;">${yearText}${songCount} songs, ${totalDurationText}</p>
        
        <!-- Action Row -->
        <div class="ad-action-buttons" style="margin-top: 16px;">
          <button class="ad-btn-play" id="adPlayBtn" title="${isPlaying ? 'Pause' : 'Play'}">
            <img class="${playBtnClass}" src="${playBtnIcon}" alt="Play/Pause">
          </button>
          <button class="ad-btn-secondary" id="adShuffleBtn" title="Shuffle Play">
            <img src="assets/icons/shuffle.svg" alt="Shuffle">
          </button>
          <button class="ad-btn-secondary" id="adMoreBtn" title="More">
            <img src="assets/icons/more.svg" alt="More">
          </button>
        </div>
      </div>
    `;
  } else {
    // Normal static left panel structure for albums
    leftPanelHTML = `
      <div class="ad-left">
        <div class="ad-art-wrapper">
          <img class="ad-art-img" src="${album.cover}" alt="${album.title}" onclick="if(window.openFullscreenArt) window.openFullscreenArt('${album.cover}')">
        </div>
        <h3 class="ad-title">${album.title}</h3>
        <p class="ad-artist">${artistText}</p>
        <p class="ad-details" id="adDetailsText">${yearText}${songCount} songs, ${totalDurationText}</p>
        
        <!-- Album Actions Buttons Row -->
        <div class="ad-action-buttons">
          <button class="ad-btn-play" id="adPlayBtn" title="${isPlaying ? 'Pause' : 'Play'}">
            <img class="${playBtnClass}" src="${playBtnIcon}" alt="Play/Pause">
          </button>
          <button class="ad-btn-secondary" id="adShuffleBtn" title="Shuffle Play">
            <img src="assets/icons/shuffle.svg" alt="Shuffle">
          </button>
          <button class="ad-btn-secondary ${isSaved ? 'active' : ''}" id="adLibraryBtn" title="Add to Library">
            <img src="assets/icons/library.svg" alt="Library">
          </button>
          <button class="ad-btn-secondary" id="adMoreBtn" title="More">
            <img src="assets/icons/more.svg" alt="More">
          </button>
        </div>
      </div>
    `;
  }

  // Reset and clone header elements to clear old listeners
  const oldHeaderRow = document.querySelector("#albumHeader .ad-right-header-row");
  if (oldHeaderRow) {
    const newHeaderRow = oldHeaderRow.cloneNode(true);
    oldHeaderRow.parentNode.replaceChild(newHeaderRow, oldHeaderRow);
  }

  // Clear query and reset defaults
  albumSearchQuery = "";
  albumSortMode = "trackno";
  const searchInputPlaceholder = isPlaylist ? "Search in this playlist" : "Search in this album";
  const sInput = document.getElementById("albumSearchInput");
  if (sInput) {
    sInput.value = "";
    sInput.placeholder = searchInputPlaceholder;
  }
  const cBtn = document.getElementById("albumClearBtn");
  if (cBtn) cBtn.style.display = "none";
  const sBtn = document.getElementById("albumSortBtn");
  if (sBtn) {
    const sortText = sBtn.querySelector("span");
    if (sortText) sortText.textContent = "Track No";
  }

  albumDetailView.innerHTML = `
    ${leftPanelHTML}
    <div class="ad-right">
      <div class="ad-headers">
        <div class="ad-sub-col ad-sub-col-title">Title</div>
        <div class="ad-sub-divider" id="adDividerArtist">|</div>
        <div class="ad-sub-col ad-sub-col-artist">Album</div>
        <div class="ad-sub-divider" id="adDividerTime">|</div>
        <div class="ad-sub-col ad-sub-col-time">Time</div>
      </div>
      <div class="ad-track-list" id="adTrackList"></div>
    </div>
  `;

  // Render tracks
  renderAlbumTracksOnly();

  // Play/Pause Album button click
  const adPlayBtn = document.getElementById("adPlayBtn");
  if (adPlayBtn) {
    adPlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isPlayingCurrentAlbum) {
        if (window.Player && typeof window.Player.togglePlay === "function") {
          window.Player.togglePlay();
        }
      } else {
        if (songs.length > 0 && window.Player && typeof window.Player.loadTrack === "function") {
          window.Player.loadTrack(songs[0], songs, 0, album.title);
        }
      }
    });
  }

  // Shuffle button click - loads a random track and triggers player controls shuffle state sync
  const adShuffleBtn = document.getElementById("adShuffleBtn");
  if (adShuffleBtn) {
    adShuffleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (songs.length > 0) {
        if (window.Player && typeof window.Player.setShuffle === "function") {
          window.Player.setShuffle(true);
        }
        const randIdx = Math.floor(Math.random() * songs.length);
        if (window.Player && typeof window.Player.loadTrack === "function") {
          window.Player.loadTrack(songs[randIdx], songs, randIdx, album.title);
        }
      }
    });
  }

  // Library button click (for albums)
  const adLibraryBtn = document.getElementById("adLibraryBtn");
  if (adLibraryBtn) {
    adLibraryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      album.inLibrary = album.inLibrary === false ? true : false;
      const isSavedNow = album.inLibrary !== false;
      
      if (isSavedNow) {
        adLibraryBtn.classList.add("active");
        if (window.Player && typeof window.Player.showToast === "function") {
          window.Player.showToast("Added to your Library");
        }
      } else {
        adLibraryBtn.classList.remove("active");
        if (window.Player && typeof window.Player.showToast === "function") {
          window.Player.showToast("Removed from your Library");
        }
      }
      updateLibrary();
    });
  }

  // Bind local search listeners inside details view
  const searchInput = document.getElementById("albumSearchInput");
  const clearBtn = document.getElementById("albumClearBtn");
  const searchBtn = document.getElementById("albumSearchBtn");
  
  if (searchInput) {
    searchInput.value = albumSearchQuery;
    searchInput.addEventListener("input", (e) => {
      albumSearchQuery = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = albumSearchQuery.length > 0 ? "flex" : "none";
      }
      renderAlbumTracksOnly();
    });
    searchInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
  
  if (clearBtn) {
    clearBtn.style.display = albumSearchQuery.length > 0 ? "flex" : "none";
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      albumSearchQuery = "";
      if (searchInput) searchInput.value = "";
      clearBtn.style.display = "none";
      renderAlbumTracksOnly();
      if (searchInput) searchInput.focus();
    });
  }
  
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      searchInput.focus();
    });
  }

  // Bind local sort button click inside details view
  const albumSortBtn = document.getElementById("albumSortBtn");
  if (albumSortBtn) {
    const sortText = albumSortBtn.querySelector("span");
    albumSortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (albumSortMode === "trackno") {
        albumSortMode = "az";
        if (sortText) sortText.textContent = "A-Z";
      } else {
        albumSortMode = "trackno";
        if (sortText) sortText.textContent = "Track No";
      }
      renderAlbumTracksOnly();
    });
  }

  // Bind playlist editing handlers (name edit triggers, choose photo, etc.)
  if (isPlaylist) {
    const adArtWrapper = document.getElementById("adArtWrapper");
    const adPlaylistArtInput = document.getElementById("adPlaylistArtInput");
    const adArtMoreBtn = document.getElementById("adArtMoreBtn");
    
    const adPlaylistNameContainer = document.getElementById("adPlaylistNameContainer");
    const adPlaylistName = document.getElementById("adPlaylistName");
    const adNameMoreBtn = document.getElementById("adNameMoreBtn");
    const adNameEditPopup = document.getElementById("adNameEditPopup");
    const adNameInput = document.getElementById("adNameInput");
    const adNameCancelBtn = document.getElementById("adNameCancelBtn");
    const adNameSaveBtn = document.getElementById("adNameSaveBtn");
    
    const adArtist = albumDetailView.querySelector(".ad-artist");
    const adDetailsText = document.getElementById("adDetailsText");
    const adActionButtons = albumDetailView.querySelector(".ad-action-buttons");

    adjustPlaylistNameFontSize(adPlaylistName, album.title);

    // Helper: save playlist edits to database
    const savePlaylistChanges = (newTitle, newCover) => {
      const pIdx = (window.userPlaylists || []).findIndex(p => p.id === album.id);
      if (pIdx !== -1) {
        if (newTitle) window.userPlaylists[pIdx].title = newTitle;
        if (newCover) window.userPlaylists[pIdx].cover = newCover;
        localStorage.setItem("gramola_user_playlists", JSON.stringify(window.userPlaylists));
      } else if (album.id === "playlist-favorite-songs") {
        if (newTitle) album.title = newTitle;
        if (newCover) album.cover = newCover;
      }
      
      // Update local object representation
      if (newTitle) album.title = newTitle;
      if (newCover) album.cover = newCover;

      updateLibrary();
      renderAlbumDetailContent(album);
    };

    // 1. Choose photo
    if (adArtWrapper && adPlaylistArtInput) {
      adArtWrapper.addEventListener("click", (e) => {
        if (e.target.closest("#adArtMoreBtn")) return;
        adPlaylistArtInput.click();
      });
      
      adPlaylistArtInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          savePlaylistChanges(null, url);
        }
      });
    }
    
    // 2. Art options (randomizer)
    if (adArtMoreBtn) {
      adArtMoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const randArt = randomArtUrl();
        savePlaylistChanges(null, randArt);
      });
    }

    // 3. Name edit trigger
    const showEditPopup = (e) => {
      e.stopPropagation();
      if (!adNameEditPopup) return;
      adNameInput.value = adPlaylistName.textContent.trim();
      adNameEditPopup.style.display = "flex";
      adPlaylistNameContainer.classList.add("edit-active");
      adPlaylistName.classList.add("blurred");
      if (adArtist) adArtist.classList.add("blurred");
      if (adDetailsText) adDetailsText.classList.add("blurred");
      if (adActionButtons) adActionButtons.classList.add("blurred");
      adNameInput.focus();
      adNameInput.select();
    };

    const hideEditPopup = () => {
      if (adNameEditPopup) adNameEditPopup.style.display = "none";
      if (adPlaylistNameContainer) adPlaylistNameContainer.classList.remove("edit-active");
      if (adPlaylistName) adPlaylistName.classList.remove("blurred");
      if (adArtist) adArtist.classList.remove("blurred");
      if (adDetailsText) adDetailsText.classList.remove("blurred");
      if (adActionButtons) adActionButtons.classList.remove("blurred");
    };

    if (adPlaylistName) adPlaylistName.addEventListener("click", showEditPopup);
    if (adNameMoreBtn) adNameMoreBtn.addEventListener("click", showEditPopup);

    if (adNameCancelBtn) {
      adNameCancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        hideEditPopup();
      });
    }

    if (adNameSaveBtn) {
      adNameSaveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newName = adNameInput.value.trim();
        if (newName) {
          savePlaylistChanges(newName, null);
        } else {
          if (window.Player && typeof window.Player.showToast === "function") {
            window.Player.showToast("Playlist name cannot be empty");
          }
        }
        hideEditPopup();
      });
    }
  }

  initAlbumResizableColumns();
}

function renderAlbumTracksOnly() {
  const adTrackList = document.getElementById("adTrackList");
  if (!adTrackList || !activeAlbum) return;

  const songs = activeAlbum.albumSongs || activeAlbum.playlistSongs || [];
  adTrackList.innerHTML = "";

  const currentTrack = window.Player && typeof window.Player.getCurrentTrack === "function" ? window.Player.getCurrentTrack() : null;
  const isPlayerPlaying = window.Player && typeof window.Player.getIsPlaying === "function" ? window.Player.getIsPlaying() : false;

  let displaySongs = songs.map((track, originalIdx) => ({ track, originalIdx }));
  
  if (albumSearchQuery.trim() !== "") {
    const q = albumSearchQuery.toLowerCase();
    displaySongs = displaySongs.filter(item => 
      item.track.title.toLowerCase().includes(q) || 
      (item.track.artist && item.track.artist.toLowerCase().includes(q))
    );
  }
  
  if (albumSortMode === "az") {
    displaySongs.sort((a, b) => a.track.title.localeCompare(b.track.title));
  }

  displaySongs.forEach((item) => {
    const { track, originalIdx } = item;
    const row = document.createElement("div");
    row.className = "ad-track-row";
    const isCurrent = currentTrack && track.file === currentTrack.file;
    const isTrackPlaying = isCurrent && isPlayerPlaying;
    if (isCurrent) {
      row.classList.add("playing");
    }

    const durationFormatted = formatDuration(track.duration);

    let innerNum = `<span class="num-text">${originalIdx + 1}</span>`;
    if (isTrackPlaying) {
      innerNum = `
        <div class="loader-wrapper">
          <div class="loader">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      `;
    }

    const playIconSrc = isTrackPlaying ? "assets/icons/pause.svg" : "assets/icons/play.svg";
    const numContent = `
      <span class="ad-track-num">
        ${innerNum}
        <img src="${playIconSrc}" alt="Play" class="hover-play-btn">
      </span>
    `;

    const libItem = LIBRARY_DATA.find(i => i.type === "song" && i.rawSong && i.rawSong.file === track.file);
    const isTrackLiked = libItem ? libItem.isFavorite : false;

    if (activeAlbum && activeAlbum.type === "playlist") {
      // Playlist specific layout (matches queue-item structure)
      row.classList.add("playlist-row");
      row.innerHTML = `
        <span class="ad-track-num">
          ${innerNum}
        </span>
        <div class="ad-track-title-cell">
          <div class="queue-art-container">
            <img src="${track.cover}" alt="Art">
            <div class="queue-play-overlay hover-play-btn">
              <img src="${playIconSrc}" alt="Play">
            </div>
          </div>
          <div class="queue-info">
            <h4>${track.title}</h4>
            <p>${track.artist}</p>
          </div>
        </div>
        <span class="ad-track-artist album-link" ${track.album ? `title="Go to ${track.album}"` : ''}>${track.album || '-'}</span>
        <span class="ad-track-duration">${durationFormatted}</span>
        <div class="ad-actions">
          <button class="action-btn love-btn ${isTrackLiked ? 'liked' : ''}">
            <img src="assets/icons/${isTrackLiked ? 'love.svg' : 'love_outline.svg'}" alt="Love">
          </button>
          <button class="action-btn add-btn"><img src="assets/icons/add_to_queue.svg" alt="Add"></button>
          <button class="action-btn more-btn"><img src="assets/icons/more.svg" alt="More"></button>
        </div>
      `;
      
      const albumLink = row.querySelector('.album-link');
      if (albumLink && track.album) {
        albumLink.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof window.openAlbumByName === "function") {
            window.openAlbumByName(track.album);
          }
        });
      }
    } else {
      // Standard Album layout
      row.innerHTML = `
        ${numContent}
        <span class="ad-track-title">${track.title}</span>
        <span class="ad-track-artist">${track.artist}</span>
        <span class="ad-track-duration">${durationFormatted}</span>
        <div class="ad-actions">
          <button class="action-btn love-btn ${isTrackLiked ? 'liked' : ''}">
            <img src="assets/icons/${isTrackLiked ? 'love.svg' : 'love_outline.svg'}" alt="Love">
          </button>
          <button class="action-btn add-btn"><img src="assets/icons/add_to_queue.svg" alt="Add"></button>
          <button class="action-btn more-btn"><img src="assets/icons/more.svg" alt="More"></button>
        </div>
      `;
    }

    // Hover play button logic
    const hoverPlayBtn = row.querySelector(".hover-play-btn");
    if (hoverPlayBtn) {
      hoverPlayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isCurrent) {
          if (window.Player && typeof window.Player.togglePlay === "function") {
            window.Player.togglePlay();
          }
        } else {
          if (window.Player && typeof window.Player.loadTrack === "function") {
            window.Player.loadTrack(track, songs, originalIdx, activeAlbum.title);
          }
        }
      });
      hoverPlayBtn.addEventListener("dblclick", (e) => {
        e.stopPropagation();
      });
    }

    // Action button listeners
    const loveBtn = row.querySelector(".love-btn");
    if (loveBtn) {
      loveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isLiked = loveBtn.classList.toggle("liked");
        const img = loveBtn.querySelector("img");
        if (isLiked) {
          img.src = "assets/icons/love.svg";
          if (window.Player && typeof window.Player.showToast === "function") {
            window.Player.showToast("Added to Favorite Songs");
          }
        } else {
          img.src = "assets/icons/love_outline.svg";
          if (window.Player && typeof window.Player.showToast === "function") {
            window.Player.showToast("Removed from Favorite Songs");
          }
        }
        if (typeof window.toggleFavoriteSong === "function") {
          window.toggleFavoriteSong(track.file, isLiked);
        }
      });
    }

    const addBtn = row.querySelector(".add-btn");
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.Player && typeof window.Player.addToQueue === "function") {
          window.Player.addToQueue(track);
        }
      });
    }

    row.querySelectorAll(".action-btn").forEach(btn => {
      btn.addEventListener("dblclick", (e) => {
        e.stopPropagation();
      });
    });

    // Row Click: Selection
    row.addEventListener("click", (e) => {
      adTrackList.querySelectorAll(".ad-track-row").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
    });

    // Row Double Click: Play
    row.addEventListener("dblclick", () => {
      if (window.Player && typeof window.Player.loadTrack === "function") {
        window.Player.loadTrack(track, songs, originalIdx, activeAlbum.title);
      }
    });

    adTrackList.appendChild(row);
  });
}

function updateAlbumPlayState() {
  if (!activeAlbum) return;
  const songs = activeAlbum.albumSongs || activeAlbum.playlistSongs || [];
  const currentTrack = window.Player && typeof window.Player.getCurrentTrack === "function" ? window.Player.getCurrentTrack() : null;
  const isPlayingCurrentAlbum = currentTrack && songs.some(s => s.file === currentTrack.file);
  const isPlayerPlaying = window.Player && typeof window.Player.getIsPlaying === "function" ? window.Player.getIsPlaying() : false;
  const isPlaying = isPlayingCurrentAlbum && isPlayerPlaying;

  const playBtnIcon = isPlaying ? "assets/icons/pause.svg" : "assets/icons/play.svg";
  const playBtnClass = isPlaying ? "" : "play-icon-svg";

  const adPlayBtn = document.getElementById("adPlayBtn");
  if (adPlayBtn) {
    adPlayBtn.title = isPlaying ? "Pause" : "Play";
    const img = adPlayBtn.querySelector("img");
    if (img) {
      img.src = playBtnIcon;
      img.className = playBtnClass;
    }
  }
}

// Listen to player change notifications to update album detail UI state dynamically
window.addEventListener("playerStateChanged", () => {
  if (activeAlbum) {
    updateAlbumPlayState();
    renderAlbumTracksOnly();
  }
  updateLibrary();
});

// Helper to format track duration string MM:SS
function formatDuration(dur) {
  if (!dur) return '0:00';
  if (typeof dur === 'string' && dur.includes(':')) return dur;
  const secs = Math.round(Number(dur));
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function getFilteredAndSortedItems() {
  // Build dynamic "Favorite Songs" playlist
  const favoriteSongsList = LIBRARY_DATA
    .filter(item => item.type === "song" && item.isFavorite)
    .map(item => item.rawSong);

  const playlist = {
    id: "playlist-favorite-songs",
    title: "Favorite Songs",
    artist: "Gramola",
    type: "playlist",
    subtitle: `Playlist | ${favoriteSongsList.length} song${favoriteSongsList.length === 1 ? '' : 's'}`,
    cover: "assets/icons/love.svg",
    playlistSongs: favoriteSongsList
  };

  const userCreated = window.userPlaylists || [];
  const playlists = [playlist, ...userCreated];
  
  // Filter albums that are in library
  const albums = LIBRARY_DATA.filter(item => item.type === "album" && item.inLibrary !== false);

  let result = [];

  // 1. Tab filter
  if (activeTab === "playlists") {
    result = [...playlists];
  } else if (activeTab === "albums") {
    result = [...albums];
  } else if (activeTab === "recent") {
    result = LIBRARY_DATA.filter(item => item.isRecent);
  } else if (activeTab === "all") {
    result = [...playlists, ...albums];
  }

  // 2. Search filter & sorting
  if (searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase();
    result = result.filter(item => 
      item.title.toLowerCase().includes(q) || 
      (item.artist && item.artist.toLowerCase().includes(q))
    );

    // Sort by search relevance priority (same as global search)
    function getSearchScore(item, queryStr) {
      const title = item.title.toLowerCase();
      const artist = (item.artist || "").toLowerCase();
      
      if (title.startsWith(queryStr)) {
        return 1;
      }
      if (artist.startsWith(queryStr)) {
        return 2;
      }
      if (title.includes(queryStr)) {
        return 3;
      }
      if (artist.includes(queryStr)) {
        return 4;
      }
      return 5;
    }

    result.sort((a, b) => {
      const scoreA = getSearchScore(a, q);
      const scoreB = getSearchScore(b, q);
      
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      
      if (a.type !== b.type) {
        return a.type === "song" ? -1 : 1;
      }
      
      return a.title.localeCompare(b.title);
    });
  } else {
    // 3. Sorting (only when search query is empty)
    if (sortMode === "az") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  return result;
}

function updateLibrary() {
  const items = getFilteredAndSortedItems();
  renderGrid(items);
}

export function initLibrary() {
  const libraryView = document.getElementById("libraryView");
  const libraryBtn = document.querySelector(".nav-btn.btn-2"); // Library Button
  const homeBtn = document.querySelector(".nav-btn.btn-1");    // Home Button

  // --- GLOBAL SEARCH CLOSE FUNCTION ---
  function closeGlobalSearch() {
    const globalSearchOverlay = document.getElementById("globalSearchOverlay");
    const globalSearchBtn = document.querySelector(".nav-btn.btn-4");
    const globalSearchInput = document.getElementById("globalSearchInput");
    const globalSearchClearBtn = document.getElementById("globalSearchClearBtn");
    const globalSearchResults = document.getElementById("globalSearchResults");
    const globalSearchResultsWrapper = document.getElementById("globalSearchResultsWrapper");

    if (globalSearchOverlay) {
      globalSearchOverlay.classList.remove("show");
    }
    if (globalSearchBtn) {
      globalSearchBtn.classList.remove("active");
    }
    if (globalSearchInput) {
      globalSearchInput.value = "";
      globalSearchInput.blur();
    }
    if (globalSearchClearBtn) {
      globalSearchClearBtn.style.display = "none";
    }
    if (globalSearchResultsWrapper) {
      globalSearchResultsWrapper.style.display = "none";
    }
    if (globalSearchResults) {
      globalSearchResults.innerHTML = "";
    }
  }

  if (libraryBtn && libraryView) {
    libraryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!libraryView.classList.contains("show")) {
        libraryView.classList.add("show");
        libraryBtn.classList.add("active");
      }
      if (typeof closeAlbumDetail === "function" && activeAlbum) {
        closeAlbumDetail();
      }
    });
  }

  if (homeBtn && libraryView) {
    homeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      libraryView.classList.remove("show");
      if (libraryBtn) libraryBtn.classList.remove("active");
    });
  }

  const libBackBtn = document.getElementById("libBackBtn");
  if (libBackBtn && libraryView) {
    libBackBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      libraryView.classList.remove("show");
      if (libraryBtn) libraryBtn.classList.remove("active");
    });
  }

  const fsBackBtn = document.getElementById("fsBackBtn");
  if (fsBackBtn) {
    fsBackBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const exitFsBtn = document.getElementById("exitFsBtn");
      if (exitFsBtn) {
        exitFsBtn.click();
      }
    });
  }

    // Close vinyl active state when clicking any nav button
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        // Exit fullscreen player mode if active
        const exitFsBtn = document.getElementById("exitFsBtn");
        if (exitFsBtn) {
          exitFsBtn.click();
        }

        const vinylContainer = document.getElementById("vinylContainer");
        if (vinylContainer) {
          vinylContainer.classList.remove("active");
          const bgVideo = document.getElementById("bgVideo");
          if (bgVideo) bgVideo.classList.remove("blurred");
          const playerWrapper = document.querySelector(".music-player-wrapper");
          if (playerWrapper) playerWrapper.classList.remove("blurred-player");
        }
        if (libraryView) {
          libraryView.classList.remove("blurred-library");
          if (!btn.classList.contains("btn-2")) {
            libraryView.classList.remove("show");
            if (libraryBtn) libraryBtn.classList.remove("active");
          }
        }
        if (!btn.classList.contains("btn-4")) {
          closeGlobalSearch();
        }
        if (typeof window.closeUploadMenu === "function" && !btn.classList.contains("btn-6")) {
          window.closeUploadMenu();
        }
      });
    });

  // Tab switching
  const tabs = document.querySelectorAll(".lib-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      if (typeof closeAlbumDetail === "function" && activeAlbum) {
        closeAlbumDetail();
      }
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeTab = tab.dataset.tab;
      updateLibrary();
    });
  });

  // Search logic
  const searchWrapper = document.querySelector(".library-search-wrapper");
  const searchInput = document.querySelector(".library-search-input");
  const searchBtn = document.querySelector(".search-btn");

  if (searchBtn && searchWrapper && searchInput) {
    const clearBtn = document.getElementById("libraryClearBtn");

    searchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        const isActive = searchWrapper.classList.contains("active");
        if (isActive) {
          // Collapse search bar on mobile
          searchWrapper.classList.remove("active");
          searchInput.value = "";
          searchQuery = "";
          if (clearBtn) {
            clearBtn.style.display = "none";
          }
          updateLibrary();
        } else {
          // Expand search bar on mobile
          searchWrapper.classList.add("active");
          searchInput.focus();
        }
      } else {
        // Focus input on desktop instead of collapsing
        searchInput.focus();
      }
    });

    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = searchQuery.trim() !== "" ? "flex" : "none";
      }
      updateLibrary();
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        searchInput.value = "";
        searchQuery = "";
        clearBtn.style.display = "none";
        updateLibrary();
        searchInput.focus();
      });
    }

    searchInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Album Detail navigation and actions
  const albumBackBtn = document.getElementById("albumBackBtn");
  if (albumBackBtn) {
    albumBackBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAlbumDetail();
    });
  }

  // Escape key navigation logic
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Esc") {
      const globalSearchOverlay = document.getElementById("globalSearchOverlay");
      if (globalSearchOverlay && globalSearchOverlay.classList.contains("show")) {
        closeGlobalSearch();
        return;
      }

      const libraryView = document.getElementById("libraryView");
      if (libraryView && libraryView.classList.contains("show")) {
        // Check if album search wrapper is active
        const albumSearchWrapper = document.getElementById("albumSearchWrapper");
        if (albumSearchWrapper && albumSearchWrapper.classList.contains("active")) {
          albumSearchWrapper.classList.remove("active");
          const albumSearchInput = document.getElementById("albumSearchInput");
          if (albumSearchInput) {
            albumSearchInput.value = "";
          }
          albumSearchQuery = "";
          const albumClearBtn = document.getElementById("albumClearBtn");
          if (albumClearBtn) {
            albumClearBtn.style.display = "none";
          }
          if (activeAlbum) {
            renderAlbumDetailContent(activeAlbum);
          }
          return;
        }

        // Check if library search wrapper is active
        const searchWrapper = document.querySelector(".library-search-wrapper");
        if (searchWrapper && searchWrapper.classList.contains("active")) {
          // Collapse search bar
          searchWrapper.classList.remove("active");
          const searchInput = document.querySelector(".library-search-input");
          if (searchInput) {
            searchInput.value = "";
          }
          searchQuery = "";
          const clearBtn = document.getElementById("libraryClearBtn");
          if (clearBtn) {
            clearBtn.style.display = "none";
          }
          updateLibrary();
          return;
        }

        // Check if activeAlbum is open
        if (activeAlbum) {
          closeAlbumDetail();
          return;
        }

        // Close library view
        libraryView.classList.remove("show");
        const libraryBtn = document.querySelector(".nav-btn.btn-2");
        if (libraryBtn) {
          libraryBtn.classList.remove("active");
        }
      }
    }
  });

  // Shortcut for global search (pressing "/")
  window.addEventListener("keydown", (e) => {
    if (e.key === "/") {
      // Ignore if user is already typing in an input/textarea
      if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        
        // Exit fullscreen player mode if active
        const exitFsBtn = document.getElementById("exitFsBtn");
        if (exitFsBtn) {
          exitFsBtn.click();
        }

        const globalSearchOverlay = document.getElementById("globalSearchOverlay");
        if (globalSearchOverlay && !globalSearchOverlay.classList.contains("show")) {
          // Close library view
          const libraryView = document.getElementById("libraryView");
          if (libraryView) {
            libraryView.classList.remove("show");
          }
          const libraryBtn = document.querySelector(".nav-btn.btn-2");
          if (libraryBtn) {
            libraryBtn.classList.remove("active");
          }
          // Open global search
          globalSearchOverlay.classList.add("show");
          const globalSearchBtn = document.querySelector(".nav-btn.btn-4");
          if (globalSearchBtn) {
            globalSearchBtn.classList.add("active");
          }
          const globalSearchInput = document.getElementById("globalSearchInput");
          if (globalSearchInput) {
            // Defer focus to wait for CSS visibility transition (0.3s)
            // Without this, Safari/Brave won't focus a visibility:hidden element
            setTimeout(() => {
              globalSearchInput.focus();
            }, 50);
          }
        }
      }
    }
  });

  // Sort logic
  const sortBtn = document.querySelector(".lib-sort-btn");
  if (sortBtn) {
    const sortText = sortBtn.querySelector("span");
    sortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sortMode === "recent") {
        sortMode = "az";
        if (sortText) sortText.textContent = "A-Z";
      } else {
        sortMode = "recent";
        if (sortText) sortText.textContent = "Recent";
      }
      updateLibrary();
    });
  }

  // Initial render
  function initLibraryList(data) {
    songsDb = data.map(song => ({
      file: song.audio_url || song.file,
      title: song.title,
      artist: song.artist,
      album: song.album || "Unknown Album",
      duration: song.duration,
      cover: song.cover_url || song.cover || "assets/vinyl/default_vinyl.png"
    }));
    buildLibraryData();
    updateLibrary();
  }

  function loadLibrarySongs() {
    fetch(`${CONFIG.apiBaseUrl}/songs`)
      .then(res => {
        if (!res.ok) throw new Error("Backend response not ok");
        return res.json();
      })
      .then(data => {
        console.log("Loaded library songs from backend database successfully!");
        initLibraryList(data);
      })
      .catch(backendErr => {
        console.warn("Could not connect to backend, falling back to local songs.json for library:", backendErr);
        fetch('songs.json')
          .then(res => res.json())
          .then(data => {
            initLibraryList(data);
          })
          .catch(localErr => {
            console.error("Error loading local songs.json for library:", localErr);
            const hardcoded = [
              {
                "file": "Self Control_spotdown.org.mp3",
                "title": "Self Control",
                "artist": "Frank Ocean",
                "album": "Blonde",
                "duration": 249,
                "cover": "assets/albums/blonde-frank ocean.jpg"
              },
              {
                "file": "Disenchanted_spotdown.org.mp3",
                "title": "Disenchanted",
                "artist": "My Chemical Romance",
                "album": "The Black Parade",
                "duration": 289,
                "cover": "assets/covers/Disenchanted_spotdown_org_mp3.jpg"
              },
              {
                "file": "Nights_spotdown.org.mp3",
                "title": "Nights",
                "artist": "Frank Ocean",
                "album": "Blonde",
                "duration": 307,
                "cover": "assets/covers/Nights_spotdown_org_mp3.jpg"
              }
            ];
            initLibraryList(hardcoded);
          });
      });
  }

  // Load initially
  loadLibrarySongs();

  // Expose function globally to update UI after uploads
  window.loadLibrarySongs = loadLibrarySongs;

  // Expose helpers globally to sync player actions with Library
  window.toggleFavoriteSong = function(songFile, isFavorite) {
    const item = LIBRARY_DATA.find(i => i.type === "song" && i.rawSong && i.rawSong.file === songFile);
    if (item) {
      item.isFavorite = isFavorite;
      if (activeTab === "playlists" || activeTab === "all") {
        updateLibrary();
      }
    }
  };

  window.addToRecentlyPlayed = function(songFile) {
    const item = LIBRARY_DATA.find(i => i.type === "song" && i.rawSong && i.rawSong.file === songFile);
    if (item) {
      item.isRecent = true;
      if (activeTab === "recent" || activeTab === "all") {
        updateLibrary();
      }
    }
  };

  window.openAlbumByName = function(albumName) {
    if (!albumName) return;

    // Check if playlist or upload modals are open and intercept
    if (window.isPlaylistModalOpen && window.isPlaylistModalOpen()) {
      if (typeof window.requestClosePlaylistModal === "function") {
        window.requestClosePlaylistModal(() => {
          window.openAlbumByName(albumName);
        });
      }
      return;
    }
    if (window.isUploadModalOpen && window.isUploadModalOpen()) {
      if (typeof window.requestCloseUploadModal === "function") {
        window.requestCloseUploadModal(() => {
          window.openAlbumByName(albumName);
        });
      }
      return;
    }

    // Record grid state before opening
    const libraryView = document.getElementById("libraryView");
    wasLibraryOpenBeforeAlbum = libraryView && libraryView.classList.contains("show");

    // 1. Exit fullscreen mode if active and collapse expanded view
    const exitFsBtn = document.getElementById("exitFsBtn");
    const fsView = document.getElementById("fullscreenView");
    if (exitFsBtn && fsView && fsView.classList.contains("show")) {
      exitFsBtn.click();
    }
    
    // Collapse expanded view if active
    const playerWrapper = document.getElementById("musicPlayerWrapper");
    if (playerWrapper && playerWrapper.classList.contains("expanded-active")) {
      playerWrapper.classList.remove("expanded-active");
      playerWrapper.classList.remove("volume-active");
      const chevron = document.querySelector(".chevron-icon");
      if (chevron) chevron.style.transform = "rotate(0deg)";
    }

    // 2. Close active vinyl
    const vinylContainer = document.getElementById("vinylContainer");
    if (vinylContainer) {
      vinylContainer.classList.remove("active");
      const bgVideo = document.getElementById("bgVideo");
      if (bgVideo) bgVideo.classList.remove("blurred");
      if (playerWrapper) playerWrapper.classList.remove("blurred-player");
    }
    if (libraryView) {
      libraryView.classList.remove("blurred-library");
    }

    // 3. Close global search
    const globalSearchOverlay = document.getElementById("globalSearchOverlay");
    if (globalSearchOverlay) {
      globalSearchOverlay.classList.remove("show");
    }
    const globalSearchBtn = document.querySelector(".nav-btn.btn-4");
    if (globalSearchBtn) globalSearchBtn.classList.remove("active");

    // 4. Show library view overlay
    if (libraryView && !libraryView.classList.contains("show")) {
      libraryView.classList.add("show");
      const libraryBtn = document.querySelector(".nav-btn.btn-2");
      if (libraryBtn) {
        libraryBtn.classList.add("active");
      }
      // Deactivate other nav buttons
      const otherNavBtns = document.querySelectorAll(".nav-btn:not(.btn-2)");
      otherNavBtns.forEach(btn => btn.classList.remove("active"));
    }

    // 5. Find album item in LIBRARY_DATA
    const album = LIBRARY_DATA.find(i => i.type === "album" && i.title.toLowerCase() === albumName.toLowerCase());
    if (album) {
      openAlbumDetail(album);
    } else {
      // Find dynamically loaded playlists (e.g. Favorite Songs or user-created playlists)
      const favoriteSongsList = LIBRARY_DATA
        .filter(item => item.type === "song" && item.isFavorite)
        .map(item => item.rawSong);
      const favPlaylist = {
        id: "playlist-favorite-songs",
        title: "Favorite Songs",
        artist: "Gramola",
        type: "playlist",
        subtitle: `Playlist | ${favoriteSongsList.length} song${favoriteSongsList.length === 1 ? '' : 's'}`,
        cover: "assets/icons/love.svg",
        playlistSongs: favoriteSongsList
      };
      
      const playlists = [favPlaylist, ...(window.userPlaylists || [])];
      const playlist = playlists.find(p => p.title.toLowerCase() === albumName.toLowerCase());
      if (playlist) {
        openAlbumDetail(playlist);
      }
    }
  };

  // --- GLOBAL SEARCH LOGIC ---
  const globalSearchBtn = document.querySelector(".nav-btn.btn-4");
  const globalSearchOverlay = document.getElementById("globalSearchOverlay");
  const globalSearchInput = document.getElementById("globalSearchInput");
  const globalSearchClearBtn = document.getElementById("globalSearchClearBtn");
  const globalSearchResults = document.getElementById("globalSearchResults");
  const globalSearchResultsWrapper = document.getElementById("globalSearchResultsWrapper");

  if (globalSearchBtn && globalSearchOverlay && globalSearchInput) {
    globalSearchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = globalSearchOverlay.classList.contains("show");
      if (!isOpen) {
        // Close library view
        if (libraryView) {
          libraryView.classList.remove("show");
        }
        const libraryBtn = document.querySelector(".nav-btn.btn-2");
        if (libraryBtn) {
          libraryBtn.classList.remove("active");
        }
        // Open global search
        globalSearchOverlay.classList.add("show");
        globalSearchBtn.classList.add("active");
        // Defer focus to wait for visibility transition
        setTimeout(() => { globalSearchInput.focus(); }, 50);
      }
    });

    globalSearchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (globalSearchClearBtn) {
        globalSearchClearBtn.style.display = q !== "" ? "flex" : "none";
      }

      if (q === "") {
        if (globalSearchResultsWrapper) globalSearchResultsWrapper.style.display = "none";
        globalSearchResults.innerHTML = "";
        return;
      }

      // Search matches
      const matches = [];

      // 1. Search songs (from LIBRARY_DATA)
      const matchedSongs = LIBRARY_DATA.filter(item => 
        item.type === "song" && 
        (item.title.toLowerCase().includes(q) || item.artist.toLowerCase().includes(q))
      );
      matches.push(...matchedSongs);
      
      // 2. Search albums (from LIBRARY_DATA)
      const matchedAlbums = LIBRARY_DATA.filter(item => 
        item.type === "album" && 
        (item.title.toLowerCase().includes(q) || item.artist.toLowerCase().includes(q))
      );
      matches.push(...matchedAlbums);

      // Sort by alphabetical match priority
      function getSearchScore(item, queryStr) {
        const title = item.title.toLowerCase();
        const artist = item.artist.toLowerCase();
        
        if (title.startsWith(queryStr)) {
          return 1;
        }
        if (artist.startsWith(queryStr)) {
          return 2;
        }
        if (title.includes(queryStr)) {
          return 3;
        }
        if (artist.includes(queryStr)) {
          return 4;
        }
        return 5;
      }

      matches.sort((a, b) => {
        const scoreA = getSearchScore(a, q);
        const scoreB = getSearchScore(b, q);
        
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
        
        if (a.type !== b.type) {
          return a.type === "song" ? -1 : 1;
        }
        
        return a.title.localeCompare(b.title);
      });

      if (matches.length === 0) {
        globalSearchResults.innerHTML = `<div class="global-search-no-results">No matches found for "${e.target.value}"</div>`;
        if (globalSearchResultsWrapper) globalSearchResultsWrapper.style.display = "block";
        return;
      }

      globalSearchResults.innerHTML = "";
      if (globalSearchResultsWrapper) globalSearchResultsWrapper.style.display = "block";

      matches.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "queue-item";
        
        const isSong = item.type === "song";
        
        // Sync play state
        const currentTrack = window.Player && typeof window.Player.getCurrentTrack === "function" ? window.Player.getCurrentTrack() : null;
        const isPlayerPlaying = window.Player && typeof window.Player.getIsPlaying === "function" ? window.Player.getIsPlaying() : false;
        
        const isPlayingThisItem = isSong && currentTrack && item.rawSong && item.rawSong.file === currentTrack.file;
        if (isPlayingThisItem) {
          itemEl.classList.add("playing");
        }
        
        const currentIcon = (isPlayingThisItem && isPlayerPlaying) ? "assets/icons/pause.svg" : "assets/icons/play.svg";
        const currentAlt = (isPlayingThisItem && isPlayerPlaying) ? "Pause" : "Play";

        let timeStr = "";
        if (isSong && item.rawSong && item.rawSong.duration) {
          const m = Math.floor(item.rawSong.duration / 60);
          const s = Math.floor(item.rawSong.duration % 60).toString().padStart(2, "0");
          timeStr = `<span class="queue-time">${m}:${s}</span>`;
        }

        itemEl.innerHTML = `
          <div class="queue-art-container">
            <img src="${item.cover}" alt="Art">
            <div class="queue-play-overlay">
              <img src="${currentIcon}" alt="${currentAlt}">
            </div>
          </div>
          <div class="queue-info">
            <h4>${item.title}</h4>
            <p>${item.subtitle}</p>
          </div>
          ${timeStr}
          <div class="queue-actions">
            <button class="action-btn love-btn ${item.isFavorite ? 'liked' : ''}">
              <img src="assets/icons/${item.isFavorite ? 'love.svg' : 'love_outline.svg'}" alt="Love">
            </button>
            <button class="action-btn add-btn"><img src="assets/icons/add_to_queue.svg" alt="Add"></button>
            <button class="action-btn more-btn"><img src="assets/icons/more.svg" alt="More"></button>
          </div>
        `;

        // Event: Click Play Overlay
        const playOverlay = itemEl.querySelector(".queue-play-overlay");
        if (playOverlay) {
          playOverlay.addEventListener("click", (evt) => {
            evt.stopPropagation();
            if (itemEl.classList.contains("playing") && window.Player && typeof window.Player.togglePlay === "function") {
              window.Player.togglePlay();
              // Do not close global search when just pausing/playing
              return;
            }
            if (window.Player && typeof window.Player.loadTrack === "function") {
              if (isSong) {
                window.Player.loadTrack(item.rawSong, [item.rawSong], 0);
              } else if (item.type === "album" && item.albumSongs && item.albumSongs.length > 0) {
                window.Player.loadTrack(item.albumSongs[0], item.albumSongs, 0);
              }
            }
            closeGlobalSearch();
          });
        }

        // Event: Click row (excluding action buttons, play overlay) to open album details
        itemEl.addEventListener("click", (e) => {
          if (e.target.closest(".queue-actions") || e.target.closest(".queue-play-overlay")) {
            return;
          }
          e.stopPropagation();
          let albumName = "";
          if (item.type === "album") {
            albumName = item.title;
          } else if (item.type === "song" && item.rawSong) {
            albumName = item.rawSong.album;
          }
          if (albumName) {
            window.openAlbumByName(albumName);
          }
        });

        // Event: Double Click row
        itemEl.addEventListener("dblclick", () => {
          if (window.Player && typeof window.Player.loadTrack === "function") {
            if (isSong) {
              window.Player.loadTrack(item.rawSong, [item.rawSong], 0);
            } else if (item.type === "album" && item.albumSongs && item.albumSongs.length > 0) {
              window.Player.loadTrack(item.albumSongs[0], item.albumSongs, 0);
            }
          }
          closeGlobalSearch();
        });

        // Event: Love button click
        const loveBtn = itemEl.querySelector(".love-btn");
        if (loveBtn) {
          loveBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
            const liked = loveBtn.classList.toggle("liked");
            item.isFavorite = liked;
            
            // Sync to LIBRARY_DATA
            if (item.rawSong) {
              const libItem = LIBRARY_DATA.find(i => i.type === "song" && i.rawSong && i.rawSong.file === item.rawSong.file);
              if (libItem) libItem.isFavorite = liked;
            } else if (item.type === "album") {
              const libItem = LIBRARY_DATA.find(i => i.type === "album" && i.title === item.title);
              if (libItem) libItem.isFavorite = liked;
            }
            
            const img = loveBtn.querySelector("img");
            if (img) {
              img.src = liked ? "assets/icons/love.svg" : "assets/icons/love_outline.svg";
            }
            if (liked && window.Player && typeof window.Player.showToast === "function") {
              window.Player.showToast("Added to Favorite Songs");
            } else if (!liked && window.Player && typeof window.Player.showToast === "function") {
              window.Player.showToast("Removed from Favorite Songs");
            }
            
            // Rerender library grid
            if (activeTab === "favorites" || activeTab === "all") {
              renderLibraryGrid(getFilteredAndSortedItems());
            }
          });
        }

        // Event: Add to queue button click
        const addBtn = itemEl.querySelector(".add-btn");
        if (addBtn) {
          addBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
            if (window.Player && typeof window.Player.addToQueue === "function") {
              if (isSong) {
                window.Player.addToQueue(item.rawSong);
              } else if (item.type === "album" && item.albumSongs) {
                window.Player.addToQueue(item.albumSongs);
              } else if (item.type === "playlist" && item.playlistSongs) {
                window.Player.addToQueue(item.playlistSongs);
              }
            }
          });
        }

        // Stop dblclick propagation on action buttons to prevent playing the song on double click
        const actionBtns = itemEl.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
          btn.addEventListener('dblclick', (e) => {
            e.stopPropagation();
          });
        });

        globalSearchResults.appendChild(itemEl);
      });
    });

    if (globalSearchClearBtn) {
      globalSearchClearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        globalSearchInput.value = "";
        globalSearchClearBtn.style.display = "none";
        if (globalSearchResultsWrapper) globalSearchResultsWrapper.style.display = "none";
        globalSearchResults.innerHTML = "";
        globalSearchInput.focus();
      });
    }

    // Dismiss by clicking outside container
    globalSearchOverlay.addEventListener("click", (e) => {
      if (e.target === globalSearchOverlay) {
        closeGlobalSearch();
      }
    });

    // Stop propagation of clicks inside container
    const searchContainer = globalSearchOverlay.querySelector(".global-search-container");
    if (searchContainer) {
      searchContainer.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
  }
}

function adjustAlbumColumnsToFit() {
  const adRight = document.querySelector('.ad-right');
  if (!adRight) return;
  const containerWidth = adRight.clientWidth;
  if (containerWidth <= 0) return;
  
  let titleWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-col-title-width') || '220');
  let totalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-col-total-width') || '400');
  
  // Reserve at least 220px for gaps, number, padding and duration width (80px)
  const maxTotalWidth = containerWidth - 220;
  
  if (totalWidth > maxTotalWidth) {
    totalWidth = Math.max(300, maxTotalWidth); // Title min 150 + Artist min 150
    document.documentElement.style.setProperty('--ad-col-total-width', `${totalWidth}px`);
  }
  
  // Maintain min 150px artist width
  if (titleWidth > totalWidth - 150) {
    titleWidth = Math.max(150, totalWidth - 150);
    document.documentElement.style.setProperty('--ad-col-title-width', `${titleWidth}px`);
  }
}

function initAlbumResizableColumns() {
  const dividerArtist = document.getElementById("adDividerArtist");
  const dividerTime = document.getElementById("adDividerTime");

  window.addEventListener("resize", adjustAlbumColumnsToFit);

  if (dividerArtist) {
    const handleStart = (clientX) => {
      const startX = clientX;
      const startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-col-title-width') || '220');
      const adRight = document.querySelector('.ad-right');
      const containerWidth = adRight ? adRight.clientWidth : 500;
      const maxTotalWidth = containerWidth - 220; // Leave space for gaps, padding, number, and duration (80)
      
      function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        let newTitleWidth = startWidth + deltaX;
        newTitleWidth = Math.max(150, newTitleWidth); // absolute min title width (150)
        
        // Read live total width
        let liveTotalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-col-total-width') || '400');
        
        if (newTitleWidth > liveTotalWidth - 150) {
          // Push dividerTime to the right to maintain min 150px artist width
          let newTotalWidth = newTitleWidth + 150;
          if (newTotalWidth > maxTotalWidth) {
            newTotalWidth = maxTotalWidth;
            newTitleWidth = newTotalWidth - 150;
          }
          document.documentElement.style.setProperty('--ad-col-total-width', `${newTotalWidth}px`);
        }
        document.documentElement.style.setProperty('--ad-col-title-width', `${newTitleWidth}px`);
      }
      
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
      
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    dividerArtist.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handleStart(e.clientX);
    });

    dividerArtist.addEventListener("touchstart", (e) => {
      handleStart(e.touches[0].clientX);
    }, { passive: true });
  }

  if (dividerTime) {
    const handleStart = (clientX) => {
      const startX = clientX;
      const startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-col-total-width') || '400');
      const adRight = document.querySelector('.ad-right');
      const containerWidth = adRight ? adRight.clientWidth : 500;
      const maxTotalWidth = containerWidth - 220; // Leave space for gaps, padding, number, and duration (80)
      
      function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        let newTotalWidth = startWidth + deltaX;
        newTotalWidth = Math.max(300, Math.min(maxTotalWidth, newTotalWidth)); // Title min 150 + Artist min 150
        
        // Read live title width
        const liveTitleWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ad-col-title-width') || '220');
        
        if (newTotalWidth < liveTitleWidth + 150) {
          // Push dividerArtist to the left to maintain min 150px artist width
          let newTitleWidth = newTotalWidth - 150;
          if (newTitleWidth < 150) {
            newTitleWidth = 150;
            newTotalWidth = newTitleWidth + 150;
          }
          document.documentElement.style.setProperty('--ad-col-title-width', `${newTitleWidth}px`);
        }
        document.documentElement.style.setProperty('--ad-col-total-width', `${newTotalWidth}px`);
      }
      
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }
      
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    dividerTime.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handleStart(e.clientX);
    });

    dividerTime.addEventListener("touchstart", (e) => {
      handleStart(e.touches[0].clientX);
    }, { passive: true });
  }
}


window.openFullscreenArt = function(url) {
  const overlay = document.getElementById("fullscreenArtOverlay");
  const img = document.getElementById("fullscreenArtImg");
  if (!overlay || !img) return;

  // Ensure custom cursor exists
  let customCursor = document.getElementById("customZoomCursor");
  if (!customCursor) {
    customCursor = document.createElement("div");
    customCursor.id = "customZoomCursor";
    customCursor.style.cssText = "display: none; position: fixed; width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.7); pointer-events: none; z-index: 99999; transform: translate(-50%, -50%);";
    document.body.appendChild(customCursor);
  }

  img.src = url;
  overlay.classList.add("show");
  overlay.style.display = "flex";
  img.style.transform = "scale(1) translate(0px, 0px)";
  img.style.cursor = "zoom-in";
  
  let isZoomed = false;

  const closeFullscreen = () => {
    overlay.classList.remove("show");
    overlay.style.display = "none";
    isZoomed = false;
    img.style.transform = "scale(1) translate(0px, 0px)";
    customCursor.style.display = "none";
    overlay.style.cursor = "default";
    img.style.cursor = "zoom-in";
    document.removeEventListener("keydown", escListener);
  };

  const escListener = (e) => {
    if (e.key === "Escape") {
      closeFullscreen();
    }
  };
  document.addEventListener("keydown", escListener);

  img.onclick = (e) => {
    e.stopPropagation();
    isZoomed = !isZoomed;
    if (isZoomed) {
      img.style.cursor = "none";
      overlay.style.cursor = "none";
      customCursor.style.display = "block";
      customCursor.style.left = e.clientX + "px";
      customCursor.style.top = e.clientY + "px";

      const { innerWidth, innerHeight } = window;
      let moveX = (e.clientX / innerWidth - 0.5) * -100;
      let moveY = (e.clientY / innerHeight - 0.5) * -100;
      moveX = Math.max(-16.666, Math.min(16.666, moveX));
      moveY = Math.max(-16.666, Math.min(16.666, moveY));
      img.style.transform = `scale(1.5) translate(${moveX}%, ${moveY}%)`;
    } else {
      img.style.cursor = "zoom-in";
      overlay.style.cursor = "default";
      customCursor.style.display = "none";
      img.style.transform = "scale(1) translate(0px, 0px)";
    }
  };

  overlay.onmousemove = (e) => {
    if (isZoomed) {
      const { innerWidth, innerHeight } = window;
      let moveX = (e.clientX / innerWidth - 0.5) * -100;
      let moveY = (e.clientY / innerHeight - 0.5) * -100;
      moveX = Math.max(-16.666, Math.min(16.666, moveX));
      moveY = Math.max(-16.666, Math.min(16.666, moveY));
      img.style.transform = `scale(1.5) translate(${moveX}%, ${moveY}%)`;

      // Calculate the screen bounds of the 1.5x scaled image (1200x1200px)
      // Note: 16.666% of 800px is 133.33px, multiplied by 1.5 scale is 200px translation max.
      const imgCenterX = (innerWidth / 2) + (moveX / 100 * 1200);
      const imgCenterY = (innerHeight / 2) + (moveY / 100 * 1200);
      
      const leftEdge = imgCenterX - 550;
      const rightEdge = imgCenterX + 550;
      const topEdge = imgCenterY - 600;
      const bottomEdge = imgCenterY + 500;

      // Clamp custom cursor to image bounds
      const cursorX = Math.max(leftEdge, Math.min(rightEdge, e.clientX));
      const cursorY = Math.max(topEdge, Math.min(bottomEdge, e.clientY));

      customCursor.style.left = cursorX + "px";
      customCursor.style.top = cursorY + "px";
    }
  };

  // Close when clicking the background overlay
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      if (isZoomed) {
        // user tidak bisa keluar kecuali zoom out
        return;
      }
      closeFullscreen();
    }
  };

  const closeBtn = document.getElementById("fullscreenArtCloseBtn");
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeFullscreen();
    };
  }
};
