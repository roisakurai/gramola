// main.js
import { initVinyl } from './ui/vinyl.js';
import { initVolume } from './ui/volume.js';
import { initPlayer } from './core/player.js'; 
import { initLibrary } from './ui/library.js';
import { initRandomAssets } from './utils/randomAssets.js';

document.addEventListener("DOMContentLoaded", () => {
  initVinyl();
  initVolume();
  initPlayer();
  initLibrary();
  initRandomAssets();
});