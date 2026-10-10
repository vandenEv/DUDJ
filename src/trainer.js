// The trainer screen: recorded clips played back-to-back, with "Answer now" and a
// loading ring over the trainer's face shown at the times listed in CLIPS.

// Times are seconds into each clip. "Answer now" starts as he starts asking and
// runs until the loading ring takes over. Open the site with ?timing on the end of
// the URL to show the current clip and time while you adjust these.
const CLIPS = [
  {
    src: "videos/intro.mp4",
    cues: [
      { show: "answer", from: 10.05, to: 13.65 }, // How old are you?
      { show: "loading", from: 13.65, to: 16.65 },
      { show: "answer", from: 17.25, to: 21.15 }, // Who's opening tonight?
      { show: "loading", from: 21.15, to: 23.15 },
      { show: "answer", from: 23.15, to: 25.05 }, // Who's the main DJ tonight?
      { show: "loading", from: 25.05, to: 25.75 }, // then "Sorry, not tonight."
    ],
  },
  {
    src: "videos/part2.mp4",
    cues: [
      { show: "answer", from: 1.6, to: 3.8 }, // Where are you from?
      { show: "loading", from: 3.8, to: 4.7 }, // then "Sorry, not tonight, chief."
      { show: "answer", from: 8.3, to: 10.5 }, // Who's the main DJ tonight?
      { show: "loading", from: 10.5, to: 11.3 }, // then "Sorry, not tonight."
      { show: "answer", from: 15.5, to: 19.0 }, // Who's the main DJ tonight?
      { show: "loading", from: 19.0, to: 21.4 },
    ],
  },
];

const LOADING_SCALE = 1.6; // loading ring size relative to the detected face width
const FOLLOW = 0.25; // 0–1: how quickly the ring catches up with the face (lower = smoother)
const BREAK_MS = 5000; // loading screen between clips

const trainer = document.getElementById("trainer");
const screen = trainer.querySelector(".screen");
const answerNow = document.getElementById("answer-now");
const loading = document.getElementById("loading");
const breakScreen = document.getElementById("break");
const timing = document.getElementById("timing");
const showTiming = new URLSearchParams(location.search).has("timing");

let videos = [];
let current = 0;
let detector;
let lastFrameTime = -1;
let paused = false;
let breakLeft = 0; // ms of loading screen still to show; 0 when a clip is on screen
let breakTimer;
let breakStartedAt;
// Ring centre and size as fractions of the video, so they survive window resizes.
let ring = { x: 0.5, y: 0.35, size: 0.2 };

function makeVideo(src) {
  const v = document.createElement("video");
  v.src = src;
  v.preload = "auto";
  v.playsInline = true;
  v.disablePictureInPicture = true;
  v.setAttribute("disableremoteplayback", "");
  v.hidden = true;
  screen.prepend(v);
  return v;
}

function cueActive(show, t) {
  return CLIPS[current].cues.some((c) => c.show === show && t >= c.from && t < c.to);
}

function trackFace(video) {
  if (!detector || video.currentTime === lastFrameTime) return;
  lastFrameTime = video.currentTime;
  const face = detector.detectForVideo(video, performance.now()).detections[0]?.boundingBox;
  if (!face) return;
  const target = {
    x: (face.originX + face.width / 2) / video.videoWidth,
    y: (face.originY + face.height / 2) / video.videoHeight,
    size: (face.width * LOADING_SCALE) / video.videoWidth,
  };
  // Jump straight to the face the first time it's found in a loading cue, then follow it smoothly.
  const k = loading.hidden ? 1 : FOLLOW;
  for (const key of Object.keys(ring)) ring[key] += (target[key] - ring[key]) * k;
}

function update() {
  const video = videos[current];
  const t = video.currentTime;

  answerNow.hidden = !cueActive("answer", t);
  const showLoading = cueActive("loading", t);
  if (showLoading) trackFace(video);
  loading.hidden = !showLoading;
  if (showLoading && video.videoWidth) {
    // The video fills the screen and is cropped at the edges (object-fit: cover),
    // so map video positions to screen pixels the same way.
    const scale = Math.max(screen.clientWidth / video.videoWidth, screen.clientHeight / video.videoHeight);
    const shownWidth = video.videoWidth * scale;
    const shownHeight = video.videoHeight * scale;
    loading.style.left = `${(screen.clientWidth - shownWidth) / 2 + ring.x * shownWidth}px`;
    loading.style.top = `${(screen.clientHeight - shownHeight) / 2 + ring.y * shownHeight}px`;
    loading.style.width = `${ring.size * shownWidth}px`;
  }

  if (showTiming) timing.textContent = breakLeft > 0 ? "break" : `clip ${current + 1} · ${t.toFixed(2)}s`;
  requestAnimationFrame(update);
}

function showPaused(value) {
  paused = value;
  screen.classList.toggle("paused", value);
}

// If the browser refuses to start the video, treat it as paused; space starts it.
function play(video) {
  showPaused(false);
  video.play().catch(() => showPaused(true));
}

function startBreakTimer() {
  breakStartedAt = performance.now();
  breakTimer = setTimeout(endBreak, breakLeft);
}

function endBreak() {
  breakLeft = 0;
  breakScreen.hidden = true;
  videos[current].hidden = false;
  play(videos[current]);
}

function setPaused(value) {
  if (breakLeft > 0) {
    // Pausing during the break holds its countdown.
    showPaused(value);
    if (value) {
      clearTimeout(breakTimer);
      breakLeft -= performance.now() - breakStartedAt;
    } else {
      startBreakTimer();
    }
  } else if (value) {
    videos[current].pause();
    showPaused(true);
  } else {
    play(videos[current]);
  }
}

function togglePause() {
  if (current === videos.length - 1 && videos[current].ended) return;
  setPaused(!paused);
}

// Between clips, show the loading screen for BREAK_MS, then start the next clip.
function playNext() {
  if (current === videos.length - 1) return;
  videos[current].hidden = true;
  current += 1;
  breakScreen.hidden = false;
  breakLeft = BREAK_MS;
  startBreakTimer();
}

// Must be called from the click handler: browsers only allow video with sound
// to start from a user's click.
export function startTrainer(createDetector) {
  videos = CLIPS.map((clip) => makeVideo(clip.src));
  videos.forEach((v) => v.addEventListener("ended", playNext));

  // Safari only lets a video play with sound if it was started from a click, so
  // start and immediately stop the later clips now, while we're still in one.
  for (const v of videos.slice(1)) {
    v.play().catch(() => {});
    v.pause();
  }

  videos[0].hidden = false;
  trainer.hidden = false;
  timing.hidden = !showTiming;
  play(videos[0]);

  // The space bar is the only pause control; there's nothing on screen for it.
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat) return;
    e.preventDefault();
    togglePause();
  });
  // Stop the browser's own video menu (with its play/pause controls) from appearing.
  screen.addEventListener("contextmenu", (e) => e.preventDefault());

  createDetector()
    .then((d) => (detector = d))
    .catch((err) => console.error("Trainer face detector failed; loading ring stays put.", err));

  requestAnimationFrame(update);
}
