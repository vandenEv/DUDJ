import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

// WASM version must match the installed @mediapipe/tasks-vision version in package.json.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const cam = document.getElementById("cam");
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const button = document.getElementById("enable");
const statusEl = document.getElementById("status");
const intro = document.getElementById("intro");
const question = document.getElementById("question");

let detector;
let lastVideoTime = -1;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function cameraErrorMessage(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow it in your browser's site settings and try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found. Plug one in and try again.";
    case "NotReadableError":
      return "Your camera is being used by another app. Close it and try again.";
    default:
      return "Couldn't start the camera. Please try again.";
  }
}

async function createDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.6,
  });
}

function drawLoop() {
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const { detections } = detector.detectForVideo(video, performance.now());

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--box").trim();
    ctx.lineWidth = Math.max(2, canvas.width / 160);

    for (const { boundingBox } of detections) {
      if (!boundingBox) continue;
      const { originX, originY, width, height } = boundingBox;
      ctx.strokeRect(originX, originY, width, height);
    }
  }
  requestAnimationFrame(drawLoop);
}

async function start() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("This browser can't access a camera. Use a recent browser over HTTPS or localhost.", true);
    return;
  }

  button.disabled = true;
  setStatus("Starting camera…");

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
  } catch (err) {
    console.error(err);
    setStatus(cameraErrorMessage(err), true);
    button.disabled = false;
    return;
  }

  try {
    setStatus("Loading face detector…");
    detector ??= await createDetector();
  } catch (err) {
    console.error(err);
    stream.getTracks().forEach((t) => t.stop());
    setStatus("Couldn't load the face detector. Check your connection and reload.", true);
    button.disabled = false;
    return;
  }

  video.srcObject = stream;
  await new Promise((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
    else video.addEventListener("loadedmetadata", resolve, { once: true });
  });
  await video.play();

  // Match the canvas's drawing buffer to the real video resolution so boxes line up.
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  cam.hidden = false;
  intro.hidden = true;
  question.hidden = false;
  requestAnimationFrame(drawLoop);
}

button.addEventListener("click", start);
