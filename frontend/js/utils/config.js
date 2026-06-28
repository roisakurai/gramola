// config.js

export const CONFIG = {
  dragThreshold: 5,
  marginDesktop: 115,
  marginMobile: 80,
  bufferDesktop: 240,
  bufferMobile: 150,
  holdDelayMs: 400,
  holdSpeedMs: 60,
  apiBaseUrl: "http://localhost:8080",
};

export const UI = {
  get vinyl() { return document.getElementById("vinylContainer"); },
  get video() { return document.getElementById("bgVideo"); },
  get playerWrapper() { return document.querySelector(".music-player-wrapper"); },
  get volumeBtn() { return document.getElementById("volumeBtn"); },
  get volumeWheel() { return document.getElementById("volumeWheel"); },
  get volCurrent() { return document.getElementById("volCurrent"); },
  get volNext2() { return document.getElementById("volNext2"); },
  get volPrev2() { return document.getElementById("volPrev2"); },
  get volumeIcon() { return document.getElementById("volumeIcon"); },
  // Expanded Volume Elements
  get exVolumeBtn() { return document.getElementById("exVolumeBtn"); },
  get exVolumePanel() { return document.getElementById("exVolumePanel"); },
  get exVolumeIcon() { return document.getElementById("exVolumeIcon"); },
  get exVolumeWheel() { return document.getElementById("exVolumeWheel"); },
  get exVolCurrent() { return document.getElementById("exVolCurrent"); },
  get exVolNext1() { return document.getElementById("exVolNext1"); },
  get exVolNext2() { return document.getElementById("exVolNext2"); },
  get exVolPrev1() { return document.getElementById("exVolPrev1"); },
  get exVolPrev2() { return document.getElementById("exVolPrev2"); },
  get exVolBarFill() { return document.getElementById("exVolBarFill"); },
};