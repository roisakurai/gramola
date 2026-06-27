// config.js

export const CONFIG = {
  dragThreshold: 5,
  marginDesktop: 115,
  marginMobile: 80,
  bufferDesktop: 240,
  bufferMobile: 150,
  holdDelayMs: 400,
  holdSpeedMs: 60,
};

export const UI = {
  vinyl: document.getElementById("vinylContainer"),
  video: document.getElementById("bgVideo"),
  playerWrapper: document.querySelector(".music-player-wrapper"),
  volumeBtn: document.getElementById("volumeBtn"),
  volumeWheel: document.getElementById("volumeWheel"),
  volCurrent: document.getElementById("volCurrent"),
  volNext2: document.getElementById("volNext2"),
  volPrev2: document.getElementById("volPrev2"),
  volumeIcon: document.getElementById("volumeIcon"),
  // Expanded Volume Elements
  exVolumeBtn: document.getElementById("exVolumeBtn"),
  exVolumePanel: document.getElementById("exVolumePanel"),
  exVolumeIcon: document.getElementById("exVolumeIcon"),
  exVolumeWheel: document.getElementById("exVolumeWheel"),
  exVolCurrent: document.getElementById("exVolCurrent"),
  exVolNext1: document.getElementById("exVolNext1"),
  exVolNext2: document.getElementById("exVolNext2"),
  exVolPrev1: document.getElementById("exVolPrev1"),
  exVolPrev2: document.getElementById("exVolPrev2"),
  exVolBarFill: document.getElementById("exVolBarFill"),
};