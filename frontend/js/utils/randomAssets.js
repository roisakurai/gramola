// randomAssets.js

const VINYLS = [
  "basic red_vinyl.png",
  "default_vinyl.png",
  "earth.png",
  "flower_vinyl.png",
  "japan nature_vinyl.png",
  "lily_vinyl.png",
  "moon.png",
  "night sky_vinyl.png",
  "red star_vinyl.png",
  "star_vinyl.png",
  "the smith_vinyl.png",
  "wave_vinyl.png",
  "yinyang_vinyl.png"
];

let videoList = [];

function setRandomVinyl() {
  const vinylImg = document.getElementById("vinyl");
  if (vinylImg) {
    const randomVinyl = VINYLS[Math.floor(Math.random() * VINYLS.length)];
    vinylImg.src = `assets/vinyl/${randomVinyl}`;
  }
}

export function setRandomVideo() {
  if (videoList.length === 0) return;
  const videoElement = document.getElementById("bgVideo");
  if (videoElement) {
    const randomVideo = videoList[Math.floor(Math.random() * videoList.length)];
    
    // Ensure we change to a different video if list has multiple entries
    let selectedVideo = randomVideo;
    if (videoList.length > 1) {
      const currentSrc = videoElement.src;
      while (currentSrc.endsWith(encodeURIComponent(selectedVideo)) || currentSrc.endsWith(selectedVideo)) {
        selectedVideo = videoList[Math.floor(Math.random() * videoList.length)];
      }
    }

    videoElement.src = `assets/background-video/${selectedVideo}`;
    videoElement.load();
    videoElement.play().catch(err => console.log("Video play failed:", err));
  }
}

export function initRandomAssets() {
  // 1. Set random vinyl immediately
  setRandomVinyl();

  // 2. Fetch video list and set random background video
  fetch("videos.json")
    .then(res => res.json())
    .then(data => {
      videoList = data;
      setRandomVideo();
    })
    .catch(err => console.error("Error loading video list:", err));
}
