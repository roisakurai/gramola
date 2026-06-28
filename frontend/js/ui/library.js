import { CONFIG } from '../utils/config.js';

let LIBRARY_DATA = [];
let songsDb = [];
let activeTab = "all";
let searchQuery = "";
let sortMode = "recent"; // "recent" | "az"

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
      isFavorite: albumIdx % 5 === 0,
      isRecent: albumIdx % 7 === 0,
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
      isFavorite: idx % 8 === 0,
      isRecent: idx % 12 === 0,
      rawSong: song
    });
  });
}

function renderGrid(items) {
  const grid = document.getElementById("libraryGrid");
  if (!grid) return;
  grid.innerHTML = "";

  items.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "lib-item";
    
    itemEl.innerHTML = `
      <div class="lib-art-container">
        <img src="${item.cover}" alt="${item.title}" loading="lazy">
        <div class="lib-play-overlay">
          <img src="assets/icons/play.svg" alt="Play">
        </div>
      </div>
      <h4 class="lib-title" title="${item.title}">${item.title}</h4>
      <p class="lib-subtitle" title="${item.subtitle}">${item.subtitle}</p>
    `;

    // Click to play track
    itemEl.addEventListener("click", () => {
      if (window.Player && typeof window.Player.loadTrack === "function") {
        if (item.type === "song") {
          window.Player.loadTrack(item.rawSong, [item.rawSong], 0);
        } else if (item.type === "album") {
          if (item.albumSongs && item.albumSongs.length > 0) {
            window.Player.loadTrack(item.albumSongs[0], item.albumSongs, 0);
          }
        } else if (item.type === "playlist") {
          if (item.playlistSongs && item.playlistSongs.length > 0) {
            window.Player.loadTrack(item.playlistSongs[0], item.playlistSongs, 0);
          }
        }
      }
    });

    grid.appendChild(itemEl);
  });
}

function getFilteredAndSortedItems() {
  let result = [...LIBRARY_DATA];

  // 1. Tab filter
  if (activeTab === "playlists") {
    result = result.filter(item => item.type === "playlist");
  } else if (activeTab === "favorites") {
    result = result.filter(item => item.isFavorite);
  } else if (activeTab === "recent") {
    result = result.filter(item => item.isRecent);
  }

  // 2. Search filter & sorting
  if (searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase();
    result = result.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.artist.toLowerCase().includes(q)
    );

    // Sort by search relevance priority (same as global search)
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
      const isShown = libraryView.classList.toggle("show");
      libraryBtn.classList.toggle("active", isShown);
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
      const isActive = searchWrapper.classList.contains("active");
      if (isActive) {
        // Collapse search bar
        searchWrapper.classList.remove("active");
        searchInput.value = "";
        searchQuery = "";
        if (clearBtn) {
          clearBtn.style.display = "none";
        }
        updateLibrary();
      } else {
        // Expand search bar
        searchWrapper.classList.add("active");
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
        } else {
          // Close library view
          libraryView.classList.remove("show");
          const libraryBtn = document.querySelector(".nav-btn.btn-2");
          if (libraryBtn) {
            libraryBtn.classList.remove("active");
          }
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
            globalSearchInput.focus();
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
      if (isOpen) {
        closeGlobalSearch();
      } else {
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
        globalSearchInput.focus();
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
              <img src="assets/icons/play.svg" alt="Play">
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
            const img = loveBtn.querySelector("img");
            if (img) {
              img.src = liked ? "assets/icons/love.svg" : "assets/icons/love_outline.svg";
            }
            if (liked && window.Player && typeof window.Player.showToast === "function") {
              window.Player.showToast("Added to Favorite Songs");
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
                item.albumSongs.forEach(song => window.Player.addToQueue(song));
              } else if (item.type === "playlist" && item.playlistSongs) {
                item.playlistSongs.forEach(song => window.Player.addToQueue(song));
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
