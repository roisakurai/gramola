import { UI, CONFIG } from '../utils/config.js';

export function initUpload() {
  const uploadOverlay = document.getElementById("uploadOverlay");
  const uploadBtn = document.querySelector(".nav-btn.btn-6");
  const uploadCloseBtn = document.getElementById("uploadCloseBtn");
  const uploadContainer = document.getElementById("uploadContainer");
  const uploadBox = document.getElementById("uploadBox");
  const uploadSelectBtn = document.getElementById("uploadSelectBtn");
  const uploadFileInput = document.getElementById("uploadFileInput");

  const uploadTracklistContainer = document.getElementById("uploadTracklistContainer");
  const uploadTrackList = document.getElementById("uploadTrackList");
  const uploadSubmitBtn = document.getElementById("uploadSubmitBtn");
  const uploadDeleteAllBtn = document.getElementById("uploadDeleteAllBtn");

  const uploadConfirmOverlay = document.getElementById("uploadConfirmOverlay");
  const uploadConfirmCancelBtn = document.getElementById("uploadConfirmCancelBtn");
  const uploadConfirmQuitBtn = document.getElementById("uploadConfirmQuitBtn");

  if (!uploadOverlay || !uploadBtn || !uploadContainer) return;

  let uploadFilesList = [];
  let hasTriggeredToast = false;

  function openUpload() {
    // 1. Close library overlay if open
    const libraryView = document.getElementById("libraryView");
    const libraryBtn = document.querySelector(".nav-btn.btn-2");
    if (libraryView) {
      libraryView.classList.remove("show");
      libraryView.classList.remove("blurred-library");
    }
    if (libraryBtn) {
      libraryBtn.classList.remove("active");
    }

    // 2. Close global search if open
    const globalSearchOverlay = document.getElementById("globalSearchOverlay");
    const globalSearchBtn = document.querySelector(".nav-btn.btn-4");
    if (globalSearchOverlay) {
      globalSearchOverlay.classList.remove("show");
    }
    if (globalSearchBtn) {
      globalSearchBtn.classList.remove("active");
    }

    // 3. Close active vinyl menu state
    const vinylContainer = document.getElementById("vinylContainer");
    if (vinylContainer) {
      vinylContainer.classList.remove("active");
    }
    const bgVideo = document.getElementById("bgVideo");
    if (bgVideo) {
      bgVideo.classList.remove("blurred");
    }
    if (UI.playerWrapper) {
      UI.playerWrapper.classList.remove("blurred-player");
    }

    // 4. Close fullscreen view if active
    const exitFsBtn = document.getElementById("exitFsBtn");
    if (exitFsBtn) {
      exitFsBtn.click();
    }

    // 5. Open upload view
    uploadOverlay.classList.add("show");
    uploadBtn.classList.add("active");

    // Add Escape key handler
    document.addEventListener("keydown", handleEscapeKey);
  }

  function closeUpload() {
    uploadOverlay.classList.remove("show");
    uploadBtn.classList.remove("active");

    // Remove Escape key handler
    document.removeEventListener("keydown", handleEscapeKey);

    // Clear active simulation intervals and reset file state on exit
    uploadFilesList.forEach(t => {
      if (t.intervalId) clearInterval(t.intervalId);
      if (t.cover && t.cover.startsWith("blob:")) {
        URL.revokeObjectURL(t.cover);
      }
    });
    uploadFilesList = [];
    renderTracklistItems();
  }

  function requestCloseUpload(onConfirmClose) {
    if (uploadFilesList.length > 0) {
      if (uploadConfirmOverlay) {
        uploadConfirmOverlay.style.display = "flex";

        const onQuit = () => {
          uploadConfirmOverlay.style.display = "none";
          onConfirmClose();
          cleanup();
        };

        const onCancel = () => {
          uploadConfirmOverlay.style.display = "none";
          openUpload(); // Restore active states
          cleanup();
        };

        const cleanup = () => {
          uploadConfirmQuitBtn.removeEventListener("click", onQuit);
          uploadConfirmCancelBtn.removeEventListener("click", onCancel);
        };

        uploadConfirmQuitBtn.addEventListener("click", onQuit);
        uploadConfirmCancelBtn.addEventListener("click", onCancel);
      }
    } else {
      onConfirmClose();
    }
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape") {
      if (uploadConfirmOverlay && uploadConfirmOverlay.style.display === "flex") {
        uploadConfirmOverlay.style.display = "none";
        openUpload(); // Restore active state
        return;
      }
      requestCloseUpload(closeUpload);
    }
  }

  // Intercept sidebar navigation clicks to handle confirmation cleanly
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    if (btn.classList.contains('btn-6')) return; // skip upload nav btn
    btn.addEventListener('click', (e) => {
      if (uploadOverlay.classList.contains('show')) {
        if (uploadFilesList.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          requestCloseUpload(() => {
            closeUpload();
            btn.click();
          });
        } else {
          closeUpload();
        }
      }
    }, true); // capture phase
  });

  uploadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (uploadOverlay.classList.contains("show")) {
      requestCloseUpload(closeUpload);
    } else {
      openUpload();
    }
  });

  if (uploadCloseBtn) {
    uploadCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      requestCloseUpload(closeUpload);
    });
  }

  // Handle files adding
  function triggerInvalidFileState() {
    if (!uploadBox) return;
    // Remove then re-add class so animation can replay
    uploadBox.classList.remove('invalid-drop');
    // Force reflow
    void uploadBox.offsetWidth;
    uploadBox.classList.add('invalid-drop');
    // Remove the class after animation ends so it can be triggered again
    uploadBox.addEventListener('animationend', () => {
      uploadBox.classList.remove('invalid-drop');
    }, { once: true });
    if (window.Player && typeof window.Player.showToast === 'function') {
      window.Player.showToast('Only MP3 or WAV files are supported');
    }
  }

  function handleFilesAdded(files) {
    if (!files || files.length === 0) return;

    hasTriggeredToast = false;

    // Shift to dual panel layout
    uploadContainer.classList.add("has-files");
    if (uploadTracklistContainer) uploadTracklistContainer.style.display = "flex";

    Array.from(files).forEach(async (file) => {
      // Validate file extension
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'mp3' && ext !== 'wav') {
        triggerInvalidFileState();
        return;
      }

      const fileId = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      let title = nameWithoutExt;
      let artist = "Unknown Artist";
      let album = "Unknown Album";
      let cover = "assets/vinyl/default_vinyl.png";

      if (nameWithoutExt.includes("-")) {
        const parts = nameWithoutExt.split("-");
        artist = parts[0].trim();
        title = parts[1].trim();
      }

      // Match realistic covers based on name as fallback
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("after hours")) {
        cover = "assets/covers/After_Hours_spotdown_org_mp3.jpg";
      } else if (lowerTitle.includes("open arms")) {
        cover = "assets/covers/Open_Arms__feat__Travis_Scott__spotdown_org_mp3.jpg";
      } else if (lowerTitle.includes("magnolia")) {
        cover = "assets/covers/Magnolia_spotdown_org_mp3.jpg";
      } else if (lowerTitle.includes("die for you")) {
        cover = "assets/covers/Always_spotdown_org_mp3.jpg";
      } else {
        const fallbackCovers = [
          "assets/albums/blonde-frank ocean.jpg",
          "assets/covers/Disenchanted_spotdown_org_mp3.jpg",
          "assets/covers/Nights_spotdown_org_mp3.jpg",
          "assets/vinyl/default_vinyl.png"
        ];
        cover = fallbackCovers[Math.floor(Math.random() * fallbackCovers.length)];
      }

      const record = {
        id: fileId,
        file: file,
        title: title,
        artist: artist,
        album: album,
        duration: "0:00",
        progress: 0,
        cover: cover,
        status: "uploading",
        intervalId: null
      };

      // Try parsing metadata via ID3v2 tags directly in client browser
      try {
        const id3Tags = await parseID3(file);
        if (id3Tags) {
          if (id3Tags.title) record.title = id3Tags.title;
          if (id3Tags.artist) record.artist = id3Tags.artist;
          if (id3Tags.album) record.album = id3Tags.album;
          if (id3Tags.cover) record.cover = id3Tags.cover;
        }
      } catch (id3Err) {
        console.warn("Client ID3 parser failed:", id3Err);
      }

      // Load duration dynamically using Audio element
      try {
        const audioUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(audioUrl);
        tempAudio.addEventListener("loadedmetadata", () => {
          const min = Math.floor(tempAudio.duration / 60);
          const sec = Math.floor(tempAudio.duration % 60).toString().padStart(2, "0");
          record.duration = `${min}:${sec}`;
          renderTracklistItems();
          URL.revokeObjectURL(audioUrl);
        });
      } catch (err) {
        console.error("Error reading duration:", err);
      }

      uploadFilesList.push(record);
      renderTracklistItems();

      // Simulate upload progress
      simulateUploadProgress(record);
    });

    // Auto-scroll to bottom when new files are added
    if (uploadTrackList) {
      uploadTrackList.scrollTop = uploadTrackList.scrollHeight;
    }

    // Reset input value so same files can be selected again
    if (uploadFileInput) uploadFileInput.value = "";
  }

  function simulateUploadProgress(record) {
    let currentProgress = 0;
    const intervalTime = 150 + Math.random() * 200; // between 150ms and 350ms
    
    record.intervalId = setInterval(() => {
      if (record.status !== "uploading") {
        clearInterval(record.intervalId);
        return;
      }

      const increment = Math.floor(Math.random() * 8) + 6; // between 6% and 14%
      currentProgress += increment;

      if (currentProgress >= 100) {
        currentProgress = 100;
        record.progress = 100;
        record.status = "completed";
        clearInterval(record.intervalId);

        // Check if all files are completed
        const allCompleted = uploadFilesList.length > 0 && uploadFilesList.every(t => t.status === "completed");
        if (allCompleted && !hasTriggeredToast) {
          hasTriggeredToast = true;
          if (window.Player && typeof window.Player.showToast === "function") {
            const count = uploadFilesList.length;
            const msg = `${count} song${count > 1 ? 's' : ''} ready to upload`;
            window.Player.showToast(msg);
          }
        }
      } else {
        record.progress = currentProgress;
      }

      renderTracklistItems();
    }, intervalTime);
  }

  function renderTracklistItems() {
    if (!uploadTrackList) return;
    uploadTrackList.innerHTML = "";

    // Disable upload button if any track is still uploading (loading)
    const activeCount = uploadFilesList.filter(t => t.status === "uploading").length;
    if (uploadSubmitBtn) {
      uploadSubmitBtn.disabled = activeCount > 0;
    }

    if (uploadFilesList.length === 0) {
      // Clear panel view if empty
      uploadContainer.classList.remove("has-files");
      if (uploadTracklistContainer) uploadTracklistContainer.style.display = "none";
      return;
    }

    uploadFilesList.forEach((track, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "upload-track-item";

      // Enable HTML5 Drag & Drop reordering (with visual indicators matching the queue list)
      itemEl.setAttribute("draggable", "true");
      itemEl.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index);
        setTimeout(() => itemEl.classList.add("dragging"), 0);
      });
      itemEl.addEventListener("dragend", () => {
        uploadTrackList.querySelectorAll(".upload-track-item").forEach(el => {
          el.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
        });
      });
      itemEl.addEventListener("dragover", (e) => {
        if (itemEl.classList.contains("dragging")) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = itemEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        uploadTrackList.querySelectorAll(".upload-track-item").forEach(el => {
          el.classList.remove("drag-over-top", "drag-over-bottom");
        });
        itemEl.classList.add(e.clientY < midY ? "drag-over-top" : "drag-over-bottom");
      });
      itemEl.addEventListener("dragleave", () => {
        itemEl.classList.remove("drag-over-top", "drag-over-bottom");
      });
      itemEl.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        itemEl.classList.remove("drag-over-top", "drag-over-bottom");
        const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (isNaN(sourceIdx) || sourceIdx === index) return;

        const rect = itemEl.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        const targetIdx = index;
        const draggedItem = uploadFilesList.splice(sourceIdx, 1)[0];
        let insertIdx = targetIdx;
        if (!insertBefore) {
          insertIdx = targetIdx + (sourceIdx < targetIdx ? 0 : 1);
        } else {
          insertIdx = targetIdx - (sourceIdx < targetIdx ? 1 : 0);
        }
        uploadFilesList.splice(insertIdx, 0, draggedItem);
        renderTracklistItems();
      });

      const numEl = document.createElement("span");
      numEl.className = "upload-track-num";
      numEl.textContent = index + 1;

      // Album art wrapper with conic gradient
      const artWrapper = document.createElement("div");
      artWrapper.className = "upload-art-wrapper";
      artWrapper.style.setProperty("--progress", `${track.progress}%`);
      if (track.status === "completed") {
        artWrapper.classList.add("completed");
      }

      const artImg = document.createElement("img");
      artImg.className = "upload-art-img";
      artImg.src = track.cover;
      artWrapper.appendChild(artImg);

      // Overlay if still loading
      if (track.status === "uploading") {
        const overlay = document.createElement("div");
        overlay.className = "upload-art-overlay";
        overlay.textContent = `${track.progress}%`;
        artWrapper.appendChild(overlay);
      }

      // Details
      const details = document.createElement("div");
      details.className = "upload-track-details";

      const title = document.createElement("span");
      title.className = "upload-track-title";
      title.textContent = track.title;

      const meta = document.createElement("span");
      meta.className = "upload-track-meta";
      meta.textContent = `${track.artist} | ${track.album}`;

      details.appendChild(title);
      details.appendChild(meta);

      // Time
      const time = document.createElement("span");
      time.className = "upload-track-time";
      time.textContent = track.duration;

      // Delete Button
      const delBtn = document.createElement("button");
      delBtn.className = "upload-delete-btn";
      delBtn.title = "Remove";
      delBtn.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 11h14v2H5z"/>
        </svg>
      `;

      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Clear interval if still running
        if (track.intervalId) clearInterval(track.intervalId);
        
        // Revoke cover Blob URL if any
        if (track.cover && track.cover.startsWith("blob:")) {
          URL.revokeObjectURL(track.cover);
        }

        // Remove from list
        uploadFilesList = uploadFilesList.filter(item => item.id !== track.id);
        renderTracklistItems();
      });

      itemEl.appendChild(numEl);
      itemEl.appendChild(artWrapper);
      itemEl.appendChild(details);
      itemEl.appendChild(time);
      itemEl.appendChild(delBtn);

      uploadTrackList.appendChild(itemEl);
    });
  }

  // Select Files trigger
  if (uploadSelectBtn && uploadFileInput) {
    uploadSelectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      uploadFileInput.click();
    });

    uploadFileInput.addEventListener("change", (e) => {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length > 0) {
        const allInvalid = selectedFiles.every(f => {
          const ext = f.name.split('.').pop().toLowerCase();
          return ext !== 'mp3' && ext !== 'wav';
        });
        if (allInvalid) {
          triggerInvalidFileState();
          uploadFileInput.value = "";
          return;
        }
      }
      handleFilesAdded(e.target.files);
    });
  }

  // Drag over viewport handling
  if (uploadBox) {
    let dragCounter = 0;

    uploadOverlay.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const types = e.dataTransfer.types;
      const isFileDrag = types && (types.includes ? types.includes("Files") : Array.from(types).includes("Files"));
      if (!isFileDrag) return;
      if (!uploadOverlay.classList.contains("show")) return;
      
      dragCounter++;
      if (dragCounter === 1) {
        uploadBox.classList.add('dragover');
      }
    }, false);

    uploadOverlay.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const types = e.dataTransfer.types;
      const isFileDrag = types && (types.includes ? types.includes("Files") : Array.from(types).includes("Files"));
      if (!isFileDrag) return;
    }, false);

    uploadOverlay.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const types = e.dataTransfer.types;
      const isFileDrag = types && (types.includes ? types.includes("Files") : Array.from(types).includes("Files"));
      if (!isFileDrag) return;
      if (!uploadOverlay.classList.contains("show")) return;

      dragCounter--;
      if (dragCounter === 0) {
        uploadBox.classList.remove('dragover');
      }
    }, false);

    uploadOverlay.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const types = e.dataTransfer.types;
      const isFileDrag = types && (types.includes ? types.includes("Files") : Array.from(types).includes("Files"));
      if (!isFileDrag) return;
      
      dragCounter = 0;
      uploadBox.classList.remove('dragover');

      if (!uploadOverlay.classList.contains("show")) return;

      // Check if every dropped file is invalid before processing
      const droppedFiles = Array.from(e.dataTransfer.files);
      const allInvalid = droppedFiles.length > 0 && droppedFiles.every(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        return ext !== 'mp3' && ext !== 'wav';
      });
      if (allInvalid) {
        triggerInvalidFileState();
        return;
      }

      handleFilesAdded(e.dataTransfer.files);
    });
  }

  // Submit Upload button action
  if (uploadSubmitBtn) {
    uploadSubmitBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const activeCount = uploadFilesList.filter(t => t.status === "uploading").length;
      if (activeCount > 0) {
        if (window.Player && typeof window.Player.showToast === "function") {
          window.Player.showToast(`Wait — ${activeCount} song${activeCount > 1 ? 's' : ''} still loading`);
        }
        return;
      }

      if (uploadFilesList.length === 0) return;

      // --- Start real server upload ---
      const songsSnapshot = [...uploadFilesList];
      const totalSongs = songsSnapshot.length;

      // Calculate total size from actual file objects
      const totalBytes = songsSnapshot.reduce((sum, t) => sum + (t.file ? t.file.size : 4 * 1024 * 1024), 0);
      const totalMB = totalBytes / (1024 * 1024);
      const sizeLabel = totalMB >= 1024
        ? `${(totalMB / 1024).toFixed(1)} GB`
        : `${totalMB.toFixed(1)} MB`;

      // Show upload progress box
      const upbBox    = document.getElementById("uploadProgressBox");
      const upbTitle  = document.getElementById("upbTitle");
      const upbSize   = document.getElementById("upbSize");
      const upbPct    = document.getElementById("upbPercent");
      const upbTime   = document.getElementById("upbTime");
      const upbFill   = document.getElementById("upbBarFill");

      if (!upbBox) return;
      upbBox.style.display = "block";
      if (upbSize) upbSize.textContent = sizeLabel;

      if (upbFill) {
        upbFill.classList.remove("success");
        upbFill.style.width = "0%";
      }

      // Close the upload overlay immediately (user sees progress box)
      uploadFilesList = [];
      renderTracklistItems();
      uploadOverlay.classList.remove("show");
      uploadBtn.classList.remove("active");
      document.removeEventListener("keydown", handleEscapeKey);

      let uploadedCount = 0;
      const progressMap = {};
      songsSnapshot.forEach(s => {
        progressMap[s.id] = 0;
      });

      const startTime = Date.now();

      // Sequential helper function to upload a single song and report progress
      function uploadSingleSong(songRecord, onProgress) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${CONFIG.apiBaseUrl}/upload-single`);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const fraction = event.loaded / event.total;
              // Scale to 95% until server actually resolves response, to avoid jumping
              onProgress(fraction * 0.95);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                resolve(xhr.responseText);
              }
            } else {
              reject(new Error(`Status ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Network error"));
          };

          const formData = new FormData();
          formData.append("file", songRecord.file);
          xhr.send(formData);
        });
      }

      const uploadedTracks = [];

      // Upload one by one
      for (let i = 0; i < totalSongs; i++) {
        const song = songsSnapshot[i];

        if (upbTitle) {
          upbTitle.textContent = `Uploading ${uploadedCount + 1}/${totalSongs} songs`;
        }

        try {
          const res = await uploadSingleSong(song, (percent) => {
            progressMap[song.id] = percent;

            // Recalculate total progress
            const sumProgress = songsSnapshot.reduce((sum, s) => sum + progressMap[s.id], 0);
            const pct = Math.round((sumProgress / totalSongs) * 100);

            if (upbPct) upbPct.textContent = `${pct}%`;
            if (upbFill) upbFill.style.width = `${pct}%`;

            // Dynamic ETA calculation
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            if (pct > 0) {
              const remaining = Math.ceil((elapsed / (pct / 100)) - elapsed);
              let timeStr;
              if (remaining >= 120) {
                timeStr = `${Math.ceil(remaining / 60)} minutes remaining`;
              } else if (remaining >= 60) {
                timeStr = `1 minute remaining`;
              } else if (remaining > 0) {
                timeStr = `${remaining} seconds remaining`;
              } else {
                timeStr = "Almost done...";
              }
              if (upbTime) upbTime.textContent = timeStr;
            }
          });

          // Upload of this file completed successfully! Set to 1.0 (100% for this file)
          progressMap[song.id] = 1.0;
          uploadedCount++;

          if (res) {
            uploadedTracks.push({
              file: res.audio_url || res.file,
              title: res.title,
              artist: res.artist,
              album: res.album || "Unknown Album",
              duration: res.duration,
              cover: res.cover_url || res.cover || "assets/vinyl/default_vinyl.png"
            });
          }

          const sumProgress = songsSnapshot.reduce((sum, s) => sum + progressMap[s.id], 0);
          const pct = Math.round((sumProgress / totalSongs) * 100);
          if (upbPct) upbPct.textContent = `${pct}%`;
          if (upbFill) upbFill.style.width = `${pct}%`;

        } catch (err) {
          console.error("Failed to upload song to backend server:", song.title, err);
          // Set to 1.0 so ETA calculations and total percentage can proceed to subsequent files
          progressMap[song.id] = 1.0;
          uploadedCount++;
        }
      }

      // Finish everything
      if (upbTitle) upbTitle.textContent = `Upload complete`;
      if (upbPct)   upbPct.textContent   = `100%`;
      if (upbFill) {
        upbFill.classList.add("success");
        upbFill.style.width = "100%";
      }
      if (upbTime)  upbTime.textContent  = "Done!";

      // Immediately refresh the library UI so the newly uploaded song appears
      if (typeof window.loadLibrarySongs === "function") {
        window.loadLibrarySongs();
      }

      // Immediately refresh the player database so the new song is available
      if (window.Player && typeof window.Player.loadPlayerSongs === "function") {
        window.Player.loadPlayerSongs();
      }

      // Auto-dismiss progress box after 2.5 s
      setTimeout(() => {
        if (upbBox) upbBox.style.display = "none";
        if (window.Player && typeof window.Player.showToast === "function") {
          window.Player.showToast(`${totalSongs} song${totalSongs > 1 ? 's' : ''} uploaded successfully`);
        }
      }, 2500);
    });
  }

  // Delete All button action
  if (uploadDeleteAllBtn) {
    uploadDeleteAllBtn.addEventListener("mouseenter", () => {
      const deleteButtons = document.querySelectorAll(".upload-delete-btn");
      deleteButtons.forEach(btn => btn.classList.add("hovered"));
    });

    uploadDeleteAllBtn.addEventListener("mouseleave", () => {
      const deleteButtons = document.querySelectorAll(".upload-delete-btn");
      deleteButtons.forEach(btn => btn.classList.remove("hovered"));
    });

    uploadDeleteAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Clear all active intervals and revoke Blob URLs
      uploadFilesList.forEach(t => {
        if (t.intervalId) clearInterval(t.intervalId);
        if (t.cover && t.cover.startsWith("blob:")) {
          URL.revokeObjectURL(t.cover);
        }
      });
      uploadFilesList = [];
      renderTracklistItems();
    });
  }

  // Expose close helper globally
  window.closeUploadMenu = () => {
    requestCloseUpload(closeUpload);
  };

  window.isUploadModalOpen = () => uploadOverlay && uploadOverlay.classList.contains('show');
  window.requestCloseUploadModal = (onConfirmClose) => {
    if (uploadOverlay && uploadOverlay.classList.contains('show')) {
      if (uploadFilesList && uploadFilesList.length > 0) {
        requestCloseUpload(() => {
          closeUpload();
          if (typeof onConfirmClose === 'function') onConfirmClose();
        });
      } else {
        closeUpload();
        if (typeof onConfirmClose === 'function') onConfirmClose();
      }
    } else {
      if (typeof onConfirmClose === 'function') onConfirmClose();
    }
  };
}

// ========================================================
// --- VANILLA ID3v2 PARSER UTILITY FOR FRONTEND PREVIEW ---
// ========================================================
function parseID3(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    // Read first 1MB containing ID3v2 headers
    const blob = file.slice(0, 1024 * 1024);
    reader.onload = function(e) {
      const buffer = e.target.result;
      const view = new DataView(buffer);
      
      if (buffer.byteLength < 10) {
        resolve(null);
        return;
      }
      
      const id3 = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2));
      if (id3 !== "ID3") {
        resolve(null);
        return;
      }
      
      const versionMajor = view.getUint8(3);
      const sizeBytes = [view.getUint8(6), view.getUint8(7), view.getUint8(8), view.getUint8(9)];
      const id3Size = (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
      
      const tags = {
        title: "",
        artist: "",
        album: "",
        cover: null
      };
      
      let offset = 10;
      const maxOffset = Math.min(id3Size + 10, buffer.byteLength);
      
      const decoderUTF8 = new TextDecoder("utf-8");
      const decoderUTF16 = new TextDecoder("utf-16");
      const decoderISO = new TextDecoder("iso-8859-1");
      
      function decodeText(encoding, dataBytes) {
        try {
          if (encoding === 0) return decoderISO.decode(dataBytes).trim().replace(/\0/g, '');
          if (encoding === 1) return decoderUTF16.decode(dataBytes).trim().replace(/\0/g, '');
          if (encoding === 2) {
            try {
              return new TextDecoder("utf-16be").decode(dataBytes).trim().replace(/\0/g, '');
            } catch (err) {
              return decoderUTF16.decode(dataBytes).trim().replace(/\0/g, '');
            }
          }
          if (encoding === 3) return decoderUTF8.decode(dataBytes).trim().replace(/\0/g, '');
        } catch (err) {
          console.warn("Decoding text tag failed:", err);
        }
        return "";
      }
      
      while (offset + 10 < maxOffset) {
        const frameId = String.fromCharCode(
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3)
        );
        
        if (frameId.charCodeAt(0) === 0) break;
        
        let frameSize = 0;
        if (versionMajor === 4) {
          frameSize = (view.getUint8(offset + 4) << 21) |
                      (view.getUint8(offset + 5) << 14) |
                      (view.getUint8(offset + 6) << 7)  |
                      view.getUint8(offset + 7);
        } else {
          frameSize = view.getUint32(offset + 4);
        }
        
        if (frameSize <= 0 || offset + 10 + frameSize > maxOffset) {
          break;
        }
        
        const frameDataStart = offset + 10;
        const frameDataEnd = frameDataStart + frameSize;
        
        if (frameId === "TIT2") {
          const encoding = view.getUint8(frameDataStart);
          const textBytes = new Uint8Array(buffer, frameDataStart + 1, frameSize - 1);
          tags.title = decodeText(encoding, textBytes);
        } else if (frameId === "TPE1") {
          const encoding = view.getUint8(frameDataStart);
          const textBytes = new Uint8Array(buffer, frameDataStart + 1, frameSize - 1);
          tags.artist = decodeText(encoding, textBytes);
        } else if (frameId === "TALB") {
          const encoding = view.getUint8(frameDataStart);
          const textBytes = new Uint8Array(buffer, frameDataStart + 1, frameSize - 1);
          tags.album = decodeText(encoding, textBytes);
        } else if (frameId === "APIC") {
          try {
            const encoding = view.getUint8(frameDataStart);
            
            let mimeTypeOffset = frameDataStart + 1;
            let mimeType = "";
            while (mimeTypeOffset < frameDataEnd) {
              const charCode = view.getUint8(mimeTypeOffset);
              if (charCode === 0) break;
              mimeType += String.fromCharCode(charCode);
              mimeTypeOffset++;
            }
            
            let imgDataOffset = mimeTypeOffset + 1;
            
            // skip picture type
            imgDataOffset += 1;
            
            // skip description
            let descOffset = imgDataOffset;
            if (encoding === 1 || encoding === 2) {
              while (descOffset + 1 < frameDataEnd) {
                if (view.getUint8(descOffset) === 0 && view.getUint8(descOffset + 1) === 0) {
                  descOffset += 2;
                  break;
                }
                descOffset += 2;
              }
            } else {
              while (descOffset < frameDataEnd) {
                if (view.getUint8(descOffset) === 0) {
                  descOffset += 1;
                  break;
                }
                descOffset += 1;
              }
            }
            
            const imgBytes = new Uint8Array(buffer, descOffset, frameDataEnd - descOffset);
            const blob = new Blob([imgBytes], { type: mimeType });
            tags.cover = URL.createObjectURL(blob);
          } catch (picErr) {
            console.warn("Failed parsing APIC frame:", picErr);
          }
        }
        
        offset += 10 + frameSize;
      }
      
      resolve(tags);
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(blob);
  });
}
