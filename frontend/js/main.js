// main.js
import { initVinyl } from './ui/vinyl.js';
import { initVolume } from './ui/volume.js';
import { initPlayer } from './core/player.js'; 
import { initLibrary } from './ui/library.js';
import { initUpload } from './ui/upload.js';
import { initRandomAssets } from './utils/randomAssets.js';
import { initCreatePlaylist } from './ui/createPlaylist.js';

function startApp() {
  initVinyl();
  initVolume();
  initPlayer();
  initLibrary();
  initUpload();
  initRandomAssets();
  initCreatePlaylist();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}