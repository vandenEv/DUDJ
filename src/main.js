import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { startTrainer } from "./trainer.js";

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
const answerYes = document.getElementById("answer-yes");

let detector;
let lastVideoTime = -1;

const TYPE_DELAY_MS = 45; // time between typed characters
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Copy `source` keeping only its first `count` characters, so markup like <br> and
// <span> appears as the text reaches it. A <br> counts as one character.
function partialClone(source, count) {
  const out = source.cloneNode(false);
  let left = count;
  for (const child of source.childNodes) {
    if (left <= 0) break;
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent.slice(0, left);
      out.append(text);
      left -= text.length;
    } else if (!child.hasChildNodes()) {
      out.append(child.cloneNode());
      left -= 1;
    } else {
      const inner = partialClone(child, left);
      out.append(inner.node);
      left = inner.left;
    }
  }
  return { node: out, left };
}

function visibleLength(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.length;
  if (!node.hasChildNodes()) return 1;
  return [...node.childNodes].reduce((sum, child) => sum + visibleLength(child), 0);
}

// Type out every [data-type] element in `box`, one after another, then reveal its buttons.
async function typeBox(box) {
  const targets = box.querySelectorAll("[data-type]");
  if (reduceMotion) return;

  box.classList.add("typing");
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");

  for (const el of targets) {
    const original = el.cloneNode(true);
    el.style.visibility = "visible";
    const total = visibleLength(original);
    for (let i = 0; i <= total; i++) {
      el.replaceChildren(...partialClone(original, i).node.childNodes, cursor);
      await new Promise((resolve) => setTimeout(resolve, TYPE_DELAY_MS));
    }
  }
  box.classList.remove("typing");
}

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
  typeBox(question);
}

button.addEventListener("click", start);
answerYes.addEventListener("click", () => {
  question.hidden = true;
  startTrainer(createDetector);
});
typeBox(intro);
